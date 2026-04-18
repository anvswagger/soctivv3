import { supabase } from '@/integrations/supabase/client';
import { fixArabicMojibake } from '@/lib/text';
import type { TimeSlot } from '@/services/calendarService';
import { CORRELATION_ID_HEADER, createCorrelationId, rememberCorrelationId } from '@/lib/correlationId';
import {
    RETRY_POLICY,
    type RetryDomain,
    shouldRetryInvokeError,
    withRetry,
} from '@/lib/retryPolicy';
import type { TablesUpdate } from '@/integrations/supabase/types';

export interface PublicBookingRequest {
    shareToken: string;
    bookingTypeId: string;
    scheduledAt: Date;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    notes?: string;
}

export interface PublicBookingResult {
    success: boolean;
    leadId?: string;
    appointmentId?: string;
    confirmationNumber?: string;
    smsSent?: boolean;
    error?: string;
}

export interface PublicSlotsRequest {
    shareToken: string;
    bookingTypeId: string;
    date: Date;
    timezone?: string;
}

export interface PublicBookingEventRequest {
    shareToken: string;
    eventType: string;
    eventName?: string;
    bookingTypeId?: string;
    metadata?: Record<string, unknown>;
}

type PublicBookingFunctionResponse = {
    request_id?: string;
    success: boolean;
    lead_id?: string;
    appointment_id?: string;
    confirmation_number?: string;
    sms_sent?: boolean;
    error?: string;
};

type PublicSlotsFunctionResponse = {
    request_id?: string;
    success: boolean;
    slots?: Array<{
        start_at: string;
        end_at: string;
    }>;
    error?: string;
};

type PublicAnalyticsFunctionResponse = {
    request_id?: string;
    success: boolean;
};

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const DEV_PUBLIC_FUNCTIONS_FLAG = (import.meta.env.VITE_ENABLE_PUBLIC_FUNCTIONS_DEV as string | undefined)?.toLowerCase();
const DEV_PUBLIC_FUNCTIONS_ENABLED = DEV_PUBLIC_FUNCTIONS_FLAG === 'true'
    || DEV_PUBLIC_FUNCTIONS_FLAG === '1'
    || DEV_PUBLIC_FUNCTIONS_FLAG === 'yes'
    || DEV_PUBLIC_FUNCTIONS_FLAG === 'on';
const SKIP_PUBLIC_FUNCTIONS_IN_DEV = import.meta.env.DEV && !DEV_PUBLIC_FUNCTIONS_ENABLED;
const DEV_PUBLIC_FUNCTIONS_DISABLED_ERROR = 'DEV_PUBLIC_FUNCTIONS_DISABLED';

function toSafeErrorMessage(value: unknown, fallback: string): string {
    if (typeof value !== 'string') {
        return fallback;
    }

    const fixed = fixArabicMojibake(value).trim();
    if (/^offline$/i.test(fixed) || /network|fetch failed|failed to fetch/i.test(fixed)) {
        return 'تعذر الاتصال بالشبكة. تحقق من الإنترنت ثم أعد المحاولة.';
    }
    if (!fixed || fixed.includes('�')) {
        return fallback;
    }

    return fixed;
}

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTimeZoneDateParts(date: Date, timeZone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
} {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');

    return {
        year: getPart('year'),
        month: getPart('month'),
        day: getPart('day'),
        hour: getPart('hour'),
        minute: getPart('minute'),
        second: getPart('second'),
    };
}

function toDateKeyInTimezone(date: Date, timeZone: string): string {
    const { year, month, day } = getTimeZoneDateParts(date, timeZone);
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTimezoneOffsetMinutesInTimezone(date: Date, timeZone: string): number {
    const { year, month, day, hour, minute, second } = getTimeZoneDateParts(date, timeZone);
    const asUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    return Math.round((date.getTime() - asUtcMillis) / 60_000);
}

function normalizePhone(value: string): string {
    return value
        .trim()
        .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
        .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)))
        .replace(/[^\d+]/g, '')
        .replace(/(?!^)\+/g, '');
}

function isLikelyValidPhone(value: string): boolean {
    const digitsOnly = value.replace(/[^\d]/g, '');
    return digitsOnly.length >= 8;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!metadata) return null;

    const next: Record<string, unknown> = {};
    const entries = Object.entries(metadata).slice(0, 20);
    for (const [key, value] of entries) {
        if (!key) continue;

        if (typeof value === 'string') {
            next[key] = value.length > 300 ? `${value.slice(0, 300)}...[truncated]` : value;
            continue;
        }

        if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
            next[key] = value;
            continue;
        }

        if (Array.isArray(value)) {
            next[key] = value.slice(0, 15).map((item) => (typeof item === 'string' ? item.slice(0, 120) : item));
            continue;
        }

        if (typeof value === 'object') {
            next[key] = '[object]';
        }
    }

    return Object.keys(next).length > 0 ? next : null;
}

function createCorrelationHeaders(prefix: string) {
    const correlationId = createCorrelationId(prefix);
    rememberCorrelationId(correlationId);

    return {
        headers: {
            [CORRELATION_ID_HEADER]: correlationId,
        },
    };
}

async function invokePublicFunction<TResponse>(
    functionName: string,
    body: Record<string, unknown>,
    correlationPrefix: string,
    retryDomain: RetryDomain,
): Promise<TResponse | null> {
    const { headers } = createCorrelationHeaders(correlationPrefix);

    return withRetry(
        async () => {
            const { data, error } = await supabase.functions.invoke(functionName, {
                headers,
                body,
            });

            if (error) {
                throw error;
            }

            return (data as TResponse | null) ?? null;
        },
        RETRY_POLICY[retryDomain],
        shouldRetryInvokeError,
    );
}

export const publicBookingService = {
    async trackPublicEvent(request: PublicBookingEventRequest): Promise<void> {
        if (SKIP_PUBLIC_FUNCTIONS_IN_DEV) return;

        const shareToken = request.shareToken?.trim();
        const eventType = request.eventType?.trim();
        if (!shareToken || !eventType) return;

        try {
            const response = await invokePublicFunction<PublicAnalyticsFunctionResponse>(
                'public-calendar-analytics',
                {
                    share_token: shareToken,
                    event_type: eventType,
                    event_name: request.eventName?.trim() || null,
                    booking_type_id: request.bookingTypeId || null,
                    metadata: sanitizeMetadata(request.metadata),
                },
                'public-analytics',
                'analytics',
            );
            if (response?.request_id) {
                rememberCorrelationId(response.request_id);
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn('Failed to track public booking event:', error);
            }
        }
    },

    async getAvailableSlots(request: PublicSlotsRequest): Promise<TimeSlot[]> {
        if (SKIP_PUBLIC_FUNCTIONS_IN_DEV) {
            throw new Error(DEV_PUBLIC_FUNCTIONS_DISABLED_ERROR);
        }

        let dateKey = toDateKey(request.date);
        let timezoneOffsetMinutes = request.date.getTimezoneOffset();

        if (request.timezone) {
            try {
                dateKey = toDateKeyInTimezone(request.date, request.timezone);
                timezoneOffsetMinutes = getTimezoneOffsetMinutesInTimezone(request.date, request.timezone);
            } catch {
                dateKey = toDateKey(request.date);
                timezoneOffsetMinutes = request.date.getTimezoneOffset();
            }
        }

        const response = await invokePublicFunction<PublicSlotsFunctionResponse>(
            'public-calendar-slots',
            {
                share_token: request.shareToken,
                booking_type_id: request.bookingTypeId,
                date_key: dateKey,
                timezone_offset_minutes: timezoneOffsetMinutes,
            },
            'public-slots',
            'bookingSlots',
        );
        if (response?.request_id) {
            rememberCorrelationId(response.request_id);
        }
        if (!response?.success || !Array.isArray(response.slots)) {
            const safeError = toSafeErrorMessage(response?.error, 'تعذر تحميل الأوقات المتاحة حالياً');
            throw new Error(safeError);
        }

        return response.slots
            .map((item) => ({
                start: new Date(item.start_at),
                end: new Date(item.end_at),
                isAvailable: true,
            }))
            .filter((slot) => Number.isFinite(slot.start.getTime()) && Number.isFinite(slot.end.getTime()))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    },

    async submitBooking(request: PublicBookingRequest): Promise<PublicBookingResult> {
        try {
            const firstName = request.firstName.trim();
            const lastName = request.lastName.trim();
            const phone = normalizePhone(request.phone);
            const email = request.email?.trim().toLowerCase() || null;
            const notes = request.notes?.trim() || null;
            const safeLastName = lastName || firstName;

            if (!firstName || !phone) {
                return {
                    success: false,
                    error: 'يرجى تعبئة جميع الحقول المطلوبة',
                };
            }

            if (!isLikelyValidPhone(phone)) {
                return {
                    success: false,
                    error: 'رقم الهاتف غير صالح',
                };
            }

            const response = await invokePublicFunction<PublicBookingFunctionResponse>(
                'public-calendar-booking',
                {
                    share_token: request.shareToken,
                    booking_type_id: request.bookingTypeId,
                    scheduled_at: request.scheduledAt.toISOString(),
                    first_name: firstName,
                    last_name: safeLastName,
                    phone,
                    email,
                    notes,
                },
                'public-booking',
                'bookingSubmit',
            );
            if (response?.request_id) {
                rememberCorrelationId(response.request_id);
            }

            if (!response?.success) {
                const fixedError = toSafeErrorMessage(response?.error, 'تعذر إتمام الحجز في الوقت الحالي');
                return {
                    success: false,
                    error: fixedError,
                };
            }

            return {
                success: true,
                leadId: response.lead_id,
                appointmentId: response.appointment_id,
                confirmationNumber: response.confirmation_number,
                smsSent: response.sms_sent,
            };
        } catch (error) {
            console.error('Public booking submit error:', error);
            return {
                success: false,
                error: toSafeErrorMessage(
                    error instanceof Error ? error.message : '',
                    'حدث خطأ غير متوقع أثناء الحجز'
                ),
            };
        }
    },

    async verifyBooking(appointmentId: string): Promise<boolean> {
        const appointmentUpdate: TablesUpdate<'appointments'> = { status: 'scheduled' };
        const { data: appointment, error } = await supabase
            .from('appointments')
            .update(appointmentUpdate)
            .eq('id', appointmentId)
            .select('lead_id')
            .single();

        if (!error && appointment?.lead_id) {
            const leadUpdate: TablesUpdate<'leads'> = { status: 'appointment_booked' };
            await supabase
                .from('leads')
                .update(leadUpdate)
                .eq('id', appointment.lead_id);
        }

        return !error;
    },

    async cancelBooking(appointmentId: string, reason?: string): Promise<boolean> {
        const appointmentUpdate: TablesUpdate<'appointments'> = {
            status: 'cancelled',
            notes: reason ? `تم الإلغاء: ${reason}` : 'تم الإلغاء بواسطة العميل',
        };
        const { data: appointment, error } = await supabase
            .from('appointments')
            .update(appointmentUpdate)
            .eq('id', appointmentId)
            .select('lead_id')
            .single();

        if (!error && appointment?.lead_id) {
            const leadUpdate: TablesUpdate<'leads'> = { status: 'cancelled' };
            await supabase
                .from('leads')
                .update(leadUpdate)
                .eq('id', appointment.lead_id);
        }

        return !error;
    },

    async getBookingDetails(appointmentId: string) {
        const { data, error } = await supabase
            .from('appointments')
            .select(`
        *,
        leads (
          first_name,
          last_name,
          phone,
          email
        ),
        calendar_configs (
          company_name,
          calendar_title,
          custom_location
        )
      `)
            .eq('id', appointmentId)
            .single();

        if (error) return null;
        return data;
    },
};
