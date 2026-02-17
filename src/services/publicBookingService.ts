import { supabase } from '@/integrations/supabase/client';
import { fixArabicMojibake } from '@/lib/text';
import type { TimeSlot } from '@/services/calendarService';

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

type PublicBookingFunctionResponse = {
    success: boolean;
    lead_id?: string;
    appointment_id?: string;
    confirmation_number?: string;
    sms_sent?: boolean;
    error?: string;
};

type PublicSlotsFunctionResponse = {
    success: boolean;
    slots?: Array<{
        start_at: string;
        end_at: string;
    }>;
    error?: string;
};

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toSafeErrorMessage(value: unknown, fallback: string): string {
    if (typeof value !== 'string') {
        return fallback;
    }

    const fixed = fixArabicMojibake(value).trim();
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

export const publicBookingService = {
    async getAvailableSlots(request: PublicSlotsRequest): Promise<TimeSlot[]> {
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

        const { data, error } = await supabase.functions.invoke('public-calendar-slots', {
            body: {
                share_token: request.shareToken,
                booking_type_id: request.bookingTypeId,
                date_key: dateKey,
                timezone_offset_minutes: timezoneOffsetMinutes,
            },
        });

        if (error) {
            throw new Error('تعذر تحميل الأوقات المتاحة حالياً');
        }

        const response = data as PublicSlotsFunctionResponse | null;
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

            if (!firstName || !lastName || !phone) {
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

            const { data, error } = await supabase.functions.invoke('public-calendar-booking', {
                body: {
                    share_token: request.shareToken,
                    booking_type_id: request.bookingTypeId,
                    scheduled_at: request.scheduledAt.toISOString(),
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    email,
                    notes,
                },
            });

            if (error) {
                return {
                    success: false,
                    error: 'تعذر الاتصال بخدمة الحجز. حاول مرة أخرى.',
                };
            }

            const response = data as PublicBookingFunctionResponse | null;

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
        const { data: appointment, error } = await supabase
            .from('appointments')
            .update({ status: 'scheduled' })
            .eq('id', appointmentId)
            .select('lead_id')
            .single();

        if (!error && appointment?.lead_id) {
            await supabase
                .from('leads')
                .update({ status: 'appointment_booked' })
                .eq('id', appointment.lead_id);
        }

        return !error;
    },

    async cancelBooking(appointmentId: string, reason?: string): Promise<boolean> {
        const { data: appointment, error } = await supabase
            .from('appointments')
            .update({
                status: 'cancelled',
                notes: reason ? `تم الإلغاء: ${reason}` : 'تم الإلغاء بواسطة العميل',
            })
            .eq('id', appointmentId)
            .select('lead_id')
            .single();

        if (!error && appointment?.lead_id) {
            await supabase
                .from('leads')
                .update({ status: 'cancelled' })
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
