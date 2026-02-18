import { supabase } from '@/integrations/supabase/client';
import { fixArabicMojibakeObject } from '@/lib/text';

// Use any for Supabase operations until types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Manual types for calendar system (will be auto-generated after migration)
export type CalendarConfig = {
    id: string;
    client_id: string;
    logo_url: string | null;
    company_name: string | null;
    primary_color: string;
    secondary_color: string;
    calendar_title: string;
    description: string | null;
    show_company_logo: boolean;
    timezone: string;
    allow_cancellation: boolean;
    require_confirmation: boolean;
    show_location: boolean;
    custom_location: string | null;
    buffer_minutes: number;
    share_token: string;
    is_public: boolean;
    embed_enabled: boolean;
    created_at: string;
    updated_at: string;
};

export type CalendarConfigInsert = Omit<CalendarConfig, 'id' | 'created_at' | 'updated_at' | 'share_token'>;
export type CalendarConfigUpdate = Partial<CalendarConfigInsert>;

export type AvailabilityRule = {
    id: string;
    calendar_config_id: string;
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    is_available: boolean;
    specific_date: string | null;
    created_at: string;
};

export type AvailabilityRuleInsert = Omit<AvailabilityRule, 'id' | 'created_at' | 'calendar_config_id'>;
export type AvailabilityRuleUpdate = Partial<AvailabilityRuleInsert>;

export type BookingType = {
    id: string;
    calendar_config_id: string;
    name_ar: string;
    name_en: string;
    description: string | null;
    duration_minutes: number;
    is_active: boolean;
    display_order: number;
    created_at: string;
};

export type BookingTypeInsert = Omit<BookingType, 'id' | 'created_at' | 'calendar_config_id'>;
export type BookingTypeUpdate = Partial<BookingTypeInsert>;

export type TimeSlot = {
    start: Date;
    end: Date;
    isAvailable: boolean;
};

export type BookingSlotLock = {
    id: string;
    calendar_config_id: string;
    scheduled_at: string;
    lock_token: string;
    expires_at: string;
    created_at: string;
};

export interface PublicCalendarData {
    config: CalendarConfig;
    availability: AvailabilityRule[];
    bookingTypes: BookingType[];
}

const DEFAULT_COMPANY_NAME = 'مكتبي';
const DEFAULT_CALENDAR_TITLE = 'احجز موعد';
const DEFAULT_PRIMARY_COLOR = '#0f172a';
const DEFAULT_SECONDARY_COLOR = '#ffffff';
const DEFAULT_TIMEZONE = 'Africa/Tripoli';
const ACTIVE_CALENDAR_STORAGE_KEY = 'soctiv_active_calendar_id';

const DEFAULT_AVAILABILITY_RULES: AvailabilityRuleInsert[] = [
    { day_of_week: 0, start_time: '09:00', end_time: '17:00', is_available: false, specific_date: null },
    { day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: true, specific_date: null },
    { day_of_week: 2, start_time: '09:00', end_time: '17:00', is_available: true, specific_date: null },
    { day_of_week: 3, start_time: '09:00', end_time: '17:00', is_available: true, specific_date: null },
    { day_of_week: 4, start_time: '09:00', end_time: '17:00', is_available: true, specific_date: null },
    { day_of_week: 5, start_time: '09:00', end_time: '17:00', is_available: true, specific_date: null },
    { day_of_week: 6, start_time: '09:00', end_time: '17:00', is_available: false, specific_date: null },
];

function getStoredActiveCalendarId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage.getItem(ACTIVE_CALENDAR_STORAGE_KEY);
    } catch {
        return null;
    }
}

function setStoredActiveCalendarId(calendarId: string | null): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        if (calendarId) {
            window.localStorage.setItem(ACTIVE_CALENDAR_STORAGE_KEY, calendarId);
        } else {
            window.localStorage.removeItem(ACTIVE_CALENDAR_STORAGE_KEY);
        }
    } catch {
        // no-op when storage is unavailable
    }
}

async function getCurrentClientId(): Promise<string | null> {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    const { data: client, error } = await db
        .from('clients')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

    if (error || !client?.id) {
        return null;
    }

    return client.id as string;
}

async function resolveClientId(targetId?: string): Promise<string | null> {
    if (targetId) return targetId;
    return getCurrentClientId();
}

export const calendarService = {
    getActiveCalendarId(): string | null {
        return getStoredActiveCalendarId();
    },

    setActiveCalendarId(calendarId: string | null): void {
        setStoredActiveCalendarId(calendarId);
    },

    async listConfigs(targetClientId?: string): Promise<CalendarConfig[]> {
        const clientId = await resolveClientId(targetClientId);
        if (!clientId) return [];

        const { data, error } = await db
            .from('calendar_configs')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return fixArabicMojibakeObject(data || []) as CalendarConfig[];
    },

    async createConfig(overrides?: Partial<CalendarConfigUpdate>, targetClientId?: string): Promise<CalendarConfig | null> {
        const clientId = await resolveClientId(targetClientId);
        if (!clientId) return null;

        const payload = {
            client_id: clientId,
            company_name: overrides?.company_name || DEFAULT_COMPANY_NAME,
            calendar_title: overrides?.calendar_title || DEFAULT_CALENDAR_TITLE,
            description: overrides?.description || null,
            primary_color: overrides?.primary_color || DEFAULT_PRIMARY_COLOR,
            secondary_color: overrides?.secondary_color || DEFAULT_SECONDARY_COLOR,
            show_company_logo: overrides?.show_company_logo ?? true,
            logo_url: overrides?.logo_url || null,
            timezone: overrides?.timezone || DEFAULT_TIMEZONE,
            allow_cancellation: overrides?.allow_cancellation ?? true,
            require_confirmation: overrides?.require_confirmation ?? false,
            show_location: overrides?.show_location ?? true,
            custom_location: overrides?.custom_location || null,
            buffer_minutes: overrides?.buffer_minutes ?? 15,
            is_public: overrides?.is_public ?? false,
            embed_enabled: overrides?.embed_enabled ?? true,
        };

        const { data, error } = await db
            .from('calendar_configs')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;
        if (!data) return null;

        await this.ensureDefaults(data.id as string);
        this.setActiveCalendarId(data.id as string);
        return fixArabicMojibakeObject(data) as CalendarConfig;
    },

    async deleteConfig(configId: string): Promise<void> {
        const { error } = await db
            .from('calendar_configs')
            .delete()
            .eq('id', configId);

        if (error) throw error;
        if (this.getActiveCalendarId() === configId) {
            this.setActiveCalendarId(null);
        }
    },

    async ensureDefaults(configId: string): Promise<void> {
        const { data: availabilityRows, error: availabilityError } = await db
            .from('availability_rules')
            .select('id')
            .eq('calendar_config_id', configId)
            .limit(1);

        if (availabilityError) throw availabilityError;

        if (!availabilityRows || availabilityRows.length === 0) {
            const { error: insertAvailabilityError } = await db
                .from('availability_rules')
                .insert(DEFAULT_AVAILABILITY_RULES.map((rule) => ({ ...rule, calendar_config_id: configId })));

            if (insertAvailabilityError) throw insertAvailabilityError;
        }

        const { data: bookingTypeRows, error: bookingTypeError } = await db
            .from('booking_types')
            .select('id')
            .eq('calendar_config_id', configId)
            .limit(1);

        if (bookingTypeError) throw bookingTypeError;

        if (!bookingTypeRows || bookingTypeRows.length === 0) {
            const { error: insertBookingTypeError } = await db
                .from('booking_types')
                .insert({
                    calendar_config_id: configId,
                    name_ar: 'استشارة',
                    name_en: 'Consultation',
                    duration_minutes: 30,
                    is_active: true,
                    display_order: 0,
                });

            if (insertBookingTypeError) throw insertBookingTypeError;
        }
    },
    // Get or create calendar config for current user's client
    async getOrCreateConfig(targetClientId?: string): Promise<CalendarConfig | null> {
        const configs = await this.listConfigs(targetClientId);
        if (configs.length > 0) {
            const activeCalendarId = this.getActiveCalendarId();
            const selectedConfig = configs.find((item) => item.id === activeCalendarId) || configs[0];
            await this.ensureDefaults(selectedConfig.id);
            this.setActiveCalendarId(selectedConfig.id);
            return selectedConfig;
        }

        return this.createConfig(undefined, targetClientId);
    },

    // Update calendar config
    async updateConfig(id: string, updates: Partial<CalendarConfig>): Promise<CalendarConfig | null> {
        const { data, error } = await db
            .from('calendar_configs')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return fixArabicMojibakeObject(data) as CalendarConfig;
    },

    // Get availability rules
    async getAvailabilityRules(configId: string): Promise<AvailabilityRule[]> {
        const { data, error } = await db
            .from('availability_rules')
            .select('*')
            .eq('calendar_config_id', configId)
            .order('day_of_week', { ascending: true });

        if (error) throw error;
        return data as AvailabilityRule[];
    },

    // Update availability rules
    async updateAvailabilityRules(configId: string, rules: AvailabilityRuleInsert[]): Promise<AvailabilityRule[]> {
        const { data: previousRules, error: previousRulesError } = await db
            .from('availability_rules')
            .select('day_of_week, start_time, end_time, is_available, specific_date')
            .eq('calendar_config_id', configId);

        if (previousRulesError) throw previousRulesError;

        const previousRulesPayload = (previousRules || []) as AvailabilityRuleInsert[];

        // Replace existing rules
        const { error: deleteError } = await db
            .from('availability_rules')
            .delete()
            .eq('calendar_config_id', configId);

        if (deleteError) throw deleteError;

        if (rules.length === 0) {
            return [];
        }

        // Insert new rules (with rollback on failure)
        const { data, error } = await db
            .from('availability_rules')
            .insert(rules.map(rule => ({ ...rule, calendar_config_id: configId })))
            .select();

        if (error) {
            if (previousRulesPayload.length > 0) {
                await db
                    .from('availability_rules')
                    .insert(previousRulesPayload.map((rule) => ({ ...rule, calendar_config_id: configId })));
            }
            throw error;
        }
        return data as AvailabilityRule[];
    },

    // Get booking types
    async getBookingTypes(configId: string): Promise<BookingType[]> {
        const { data, error } = await db
            .from('booking_types')
            .select('*')
            .eq('calendar_config_id', configId)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return fixArabicMojibakeObject(data) as BookingType[];
    },

    // Create booking type
    async createBookingType(configId: string, bookingType: BookingTypeInsert): Promise<BookingType> {
        const { data, error } = await db
            .from('booking_types')
            .insert({ ...bookingType, calendar_config_id: configId })
            .select()
            .single();

        if (error) throw error;
        return fixArabicMojibakeObject(data) as BookingType;
    },

    // Update booking type
    async updateBookingType(id: string, updates: Partial<BookingTypeUpdate>): Promise<BookingType> {
        const { data, error } = await db
            .from('booking_types')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return fixArabicMojibakeObject(data) as BookingType;
    },

    // Delete booking type
    async deleteBookingType(id: string): Promise<void> {
        const { error } = await db
            .from('booking_types')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Get public calendar by share token
    async getPublicCalendar(shareToken: string): Promise<PublicCalendarData | null> {
        const { data: config, error: configError } = await db
            .from('calendar_configs')
            .select('*')
            .eq('share_token', shareToken)
            .eq('is_public', true)
            .single();

        if (configError || !config) return null;

        // Fetch ALL availability rules (not just is_available=true) to properly check date availability
        const { data: availability, error: availError } = await db
            .from('availability_rules')
            .select('*')
            .eq('calendar_config_id', config.id);
        // Removed: .eq('is_available', true) - this was causing issues with date availability checking

        if (availError) throw availError;

        const { data: bookingTypes, error: typesError } = await db
            .from('booking_types')
            .select('*')
            .eq('calendar_config_id', config.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (typesError) throw typesError;

        return {
            config: fixArabicMojibakeObject(config) as CalendarConfig,
            availability: availability as AvailabilityRule[],
            bookingTypes: fixArabicMojibakeObject(bookingTypes) as BookingType[],
        };
    },

    // Get available slots for a date range
    async getAvailableSlots(
        configId: string,
        startDate: Date,
        endDate: Date,
        durationMinutes: number = 30
    ): Promise<TimeSlot[]> {
        // Get availability rules
        const { data: availability, error: availabilityError } = await db
            .from('availability_rules')
            .select('*')
            .eq('calendar_config_id', configId);

        if (availabilityError) {
            throw availabilityError;
        }

        if (!availability || availability.length === 0) {
            return [];
        }

        // Get existing appointments in the date range
        const { data: client, error: clientError } = await db
            .from('calendar_configs')
            .select('client_id')
            .eq('id', configId)
            .single();

        if (clientError) {
            throw clientError;
        }

        if (!client?.client_id) {
            return [];
        }

        const clientId = client.client_id;
        const searchStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        const searchEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);

        const { data: appointments, error: apptError } = await db
            .from('appointments')
            .select('scheduled_at, duration_minutes')
            .eq('client_id', clientId)
            .gte('scheduled_at', searchStart.toISOString())
            .lt('scheduled_at', searchEnd.toISOString())
            .neq('status', 'cancelled');

        if (apptError) {
            throw apptError;
        }

        // Get slot locks
        const { data: locks, error: locksError } = await db
            .from('booking_slot_locks')
            .select('*')
            .eq('calendar_config_id', configId)
            .gte('expires_at', new Date().toISOString());

        if (locksError) {
            throw locksError;
        }

        // Get buffer time from config
        const { data: config, error: configError } = await db
            .from('calendar_configs')
            .select('buffer_minutes')
            .eq('id', configId)
            .single();

        if (configError) {
            throw configError;
        }

        const bufferMinutes = config?.buffer_minutes || 15;

        // Calculate available slots
        return calculateAvailableSlots(
            startDate,
            endDate,
            availability as AvailabilityRule[],
            appointments || [],
            locks || [],
            durationMinutes,
            bufferMinutes
        );
    },

    // Lock a slot during booking
    async lockSlot(configId: string, scheduledAt: Date): Promise<string | null> {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // lock for 5 minutes from now

        const { data, error } = await db
            .from('booking_slot_locks')
            .insert({
                calendar_config_id: configId,
                scheduled_at: scheduledAt.toISOString(),
                expires_at: expiresAt.toISOString(),
            })
            .select('lock_token')
            .single();

        if (error) return null;
        return (data as BookingSlotLock).lock_token;
    },

    // Release a slot lock
    async releaseLock(configId: string, lockToken: string): Promise<void> {
        await db
            .from('booking_slot_locks')
            .delete()
            .eq('calendar_config_id', configId)
            .eq('lock_token', lockToken);
    },

    // Check if slot is available
    async checkSlotAvailability(configId: string, scheduledAt: Date): Promise<boolean> {
        const { data: locks } = await db
            .from('booking_slot_locks')
            .select('id')
            .eq('calendar_config_id', configId)
            .eq('scheduled_at', scheduledAt.toISOString())
            .gte('expires_at', new Date().toISOString());

        return !locks || locks.length === 0;
    },

    // Get share URL
    getShareUrl(shareToken: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/book/${shareToken}`;
    },

    // Get embed code
    getEmbedCode(shareToken: string, options?: { width?: string; height?: string }): string {
        const width = options?.width || '100%';
        const height = options?.height || '700';
        const url = `${window.location.origin}/book/${shareToken}?embed=true`;
        return `<iframe src="${url}" width="${width}" height="${height}" frameborder="0"></iframe>`;
    },
};

// Helper function to calculate available slots
function calculateAvailableSlots(
    startDate: Date,
    endDate: Date,
    availability: AvailabilityRule[],
    appointments: { scheduled_at: string; duration_minutes: number | null }[],
    locks: BookingSlotLock[],
    durationMinutes: number,
    bufferMinutes: number
): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotKeys = new Set<number>();
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const endExclusive = new Date(endDate);
    const hasTimePart = endExclusive.getHours() !== 0
        || endExclusive.getMinutes() !== 0
        || endExclusive.getSeconds() !== 0
        || endExclusive.getMilliseconds() !== 0;
    endExclusive.setHours(0, 0, 0, 0);
    if (hasTimePart || endExclusive.getTime() <= current.getTime()) {
        endExclusive.setDate(endExclusive.getDate() + 1);
    }

    const now = Date.now();

    while (current < endExclusive) {
        const dayOfWeek = current.getDay();
        const dateKey = formatDateKey(current);

        // Specific-date rules take precedence over weekday defaults.
        const specificRules = availability.filter((rule) => rule.specific_date === dateKey);
        const dayRules = (specificRules.length > 0
            ? specificRules.filter((rule) => rule.is_available)
            : availability.filter((rule) => !rule.specific_date && rule.is_available && rule.day_of_week === dayOfWeek)
        ).sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

        for (const rule of dayRules) {
            const [startHour, startMin] = rule.start_time.split(':').map(Number);
            const [endHour, endMin] = rule.end_time.split(':').map(Number);

            const slotStart = new Date(current);
            slotStart.setHours(startHour, startMin, 0, 0);

            const slotEnd = new Date(current);
            slotEnd.setHours(endHour, endMin, 0, 0);

            // Generate slots within the time range
            while (slotStart < slotEnd) {
                const slotEndTime = new Date(slotStart.getTime() + durationMinutes * 60000);

                if (slotEndTime <= slotEnd) {
                    // Check if slot is taken
                    const isTaken = appointments.some((appt) => {
                        const apptStart = new Date(appt.scheduled_at);
                        const apptDuration = Number(appt.duration_minutes || durationMinutes);
                        const apptEnd = new Date(apptStart.getTime() + (apptDuration + bufferMinutes) * 60000);
                        return slotStart < apptEnd && slotEndTime > apptStart;
                    });

                    // Check if slot is locked
                    const isLocked = locks.some((lock) => {
                        const lockStart = new Date(lock.scheduled_at);
                        return lockStart.getTime() === slotStart.getTime();
                    });

                    // Only add future slots
                    const slotTimestamp = slotStart.getTime();
                    if (!isTaken && !isLocked && slotTimestamp > now && !slotKeys.has(slotTimestamp)) {
                        slotKeys.add(slotTimestamp);
                        slots.push({
                            start: new Date(slotStart),
                            end: slotEndTime,
                            isAvailable: true,
                        });
                    }
                }

                slotStart.setTime(slotStart.getTime() + durationMinutes * 60000);
            }
        }

        current.setDate(current.getDate() + 1);
    }

    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function timeToMinutes(timeValue: string): number {
    const [hours = '0', minutes = '0'] = timeValue.split(':');
    return Number(hours) * 60 + Number(minutes);
}


