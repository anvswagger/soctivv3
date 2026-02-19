import { supabase } from '@/integrations/supabase/client';
import { fixArabicMojibakeObject } from '@/lib/text';

type SupabaseRepoError = {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
};

type RepoResult<T> = {
    data: T | null;
    error: SupabaseRepoError | null;
};

type QueryResult<T> = Promise<RepoResult<T[]>>;

type QueryBuilder<T> = QueryResult<T> & {
    select: (columns?: string) => QueryBuilder<T>;
    eq: (column: string, value: unknown) => QueryBuilder<T>;
    neq: (column: string, value: unknown) => QueryBuilder<T>;
    in: (column: string, values: readonly unknown[]) => QueryBuilder<T>;
    gte: (column: string, value: unknown) => QueryBuilder<T>;
    lt: (column: string, value: unknown) => QueryBuilder<T>;
    order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
    limit: (count: number) => QueryBuilder<T>;
    insert: (values: unknown) => QueryBuilder<T>;
    update: (values: unknown) => QueryBuilder<T>;
    delete: () => QueryBuilder<T>;
    single: () => Promise<RepoResult<T>>;
    maybeSingle: () => Promise<RepoResult<T>>;
};

type CalendarRepoDbClient = {
    auth: {
        getSession: () => Promise<{
            data: { session: { user: { id: string } } | null };
            error: SupabaseRepoError | null;
        }>;
    };
    from: <T = Record<string, unknown>>(table: string) => QueryBuilder<T>;
};

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

export interface PublicCalendarData {
    config: CalendarConfig;
    availability: AvailabilityRule[];
    bookingTypes: BookingType[];
}

export const calendarRepoDb = supabase as unknown as CalendarRepoDbClient;

export const calendarRepo = {
    async getCurrentClientId(): Promise<string | null> {
        const { data: { session } } = await calendarRepoDb.auth.getSession();
        if (!session) return null;

        const { data: client, error } = await calendarRepoDb
            .from<{ id: string }>('clients')
            .select('id')
            .eq('user_id', session.user.id)
            .single();

        if (error || !client?.id) return null;
        return client.id;
    },

    async listConfigsByClientId(clientId: string): Promise<CalendarConfig[]> {
        const { data, error } = await calendarRepoDb
            .from<CalendarConfig>('calendar_configs')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return fixArabicMojibakeObject(data || []) as CalendarConfig[];
    },

    async createConfig(payload: CalendarConfigInsert): Promise<CalendarConfig | null> {
        const { data, error } = await calendarRepoDb
            .from<CalendarConfig>('calendar_configs')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;
        return data ? (fixArabicMojibakeObject(data) as CalendarConfig) : null;
    },

    async deleteConfig(configId: string): Promise<void> {
        const { error } = await calendarRepoDb
            .from<CalendarConfig>('calendar_configs')
            .delete()
            .eq('id', configId);

        if (error) throw error;
    },

    async updateConfig(configId: string, updates: CalendarConfigUpdate): Promise<CalendarConfig | null> {
        const { data, error } = await calendarRepoDb
            .from<CalendarConfig>('calendar_configs')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', configId)
            .select()
            .single();

        if (error) throw error;
        return data ? (fixArabicMojibakeObject(data) as CalendarConfig) : null;
    },

    async getAvailabilityRules(configId: string): Promise<AvailabilityRule[]> {
        const { data, error } = await calendarRepoDb
            .from<AvailabilityRule>('availability_rules')
            .select('*')
            .eq('calendar_config_id', configId)
            .order('day_of_week', { ascending: true });

        if (error) throw error;
        return (data || []) as AvailabilityRule[];
    },

    async replaceAvailabilityRules(configId: string, rules: AvailabilityRuleInsert[]): Promise<AvailabilityRule[]> {
        const { error: deleteError } = await calendarRepoDb
            .from<AvailabilityRule>('availability_rules')
            .delete()
            .eq('calendar_config_id', configId);

        if (deleteError) throw deleteError;
        if (rules.length === 0) return [];

        const { data, error } = await calendarRepoDb
            .from<AvailabilityRule>('availability_rules')
            .insert(rules.map((rule) => ({ ...rule, calendar_config_id: configId })))
            .select();

        if (error) throw error;
        return (data || []) as AvailabilityRule[];
    },

    async getBookingTypes(configId: string): Promise<BookingType[]> {
        const { data, error } = await calendarRepoDb
            .from<BookingType>('booking_types')
            .select('*')
            .eq('calendar_config_id', configId)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return fixArabicMojibakeObject(data || []) as BookingType[];
    },

    async createBookingType(configId: string, bookingType: BookingTypeInsert): Promise<BookingType> {
        const { data, error } = await calendarRepoDb
            .from<BookingType>('booking_types')
            .insert({ ...bookingType, calendar_config_id: configId })
            .select()
            .single();

        if (error) throw error;
        return fixArabicMojibakeObject(data) as BookingType;
    },

    async updateBookingType(id: string, updates: BookingTypeUpdate): Promise<BookingType> {
        const { data, error } = await calendarRepoDb
            .from<BookingType>('booking_types')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return fixArabicMojibakeObject(data) as BookingType;
    },

    async deleteBookingType(id: string): Promise<void> {
        const { error } = await calendarRepoDb
            .from<BookingType>('booking_types')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};

