import { supabase } from '@/integrations/supabase/client';
import type { AppointmentStatus, LeadStatus, SmsStatus } from '@/types/database';

type HeadCountResult = {
    count: number | null;
    error: { message: string } | null;
};

async function countWithBuilder(builder: PromiseLike<HeadCountResult>): Promise<number> {
    const result = await builder;
    if (result.error) {
        return 0;
    }
    return result.count ?? 0;
}

export const leadRepo = {
    countLeads: async (): Promise<number> =>
        countWithBuilder(supabase.from('leads').select('id', { count: 'exact', head: true })),

    countLeadsByStatus: async (status: LeadStatus): Promise<number> =>
        countWithBuilder(
            supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', status) as unknown as PromiseLike<HeadCountResult>
        ),

    countLeadsByStatuses: async (statuses: LeadStatus[]): Promise<number> =>
        countWithBuilder(
            supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', statuses) as unknown as PromiseLike<HeadCountResult>
        ),

    countLeadsByClient: async (clientId: string): Promise<number> =>
        countWithBuilder(
            supabase.from('leads').select('id', { count: 'exact', head: true }).eq('client_id', clientId) as unknown as PromiseLike<HeadCountResult>
        ),

    countLeadsByClientAndStatus: async (clientId: string, status: LeadStatus): Promise<number> =>
        countWithBuilder(
            supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', clientId)
                .eq('status', status) as unknown as PromiseLike<HeadCountResult>,
        ),

    countAppointments: async (): Promise<number> =>
        countWithBuilder(supabase.from('appointments').select('id', { count: 'exact', head: true })),

    countAppointmentsSince: async (dateIso: string): Promise<number> =>
        countWithBuilder(
            supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', dateIso),
        ),

    countAppointmentsByStatus: async (status: AppointmentStatus): Promise<number> =>
        countWithBuilder(
            supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', status) as unknown as PromiseLike<HeadCountResult>,
        ),

    countAppointmentsByClient: async (clientId: string): Promise<number> =>
        countWithBuilder(
            supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('client_id', clientId) as unknown as PromiseLike<HeadCountResult>,
        ),

    countClients: async (): Promise<number> =>
        countWithBuilder(supabase.from('clients').select('id', { count: 'exact', head: true })),

    countProfiles: async (): Promise<number> =>
        countWithBuilder(supabase.from('profiles').select('id', { count: 'exact', head: true })),

    countSmsLogs: async (): Promise<number> =>
        countWithBuilder(supabase.from('sms_logs').select('id', { count: 'exact', head: true })),

    countSmsLogsByStatus: async (status: SmsStatus): Promise<number> =>
        countWithBuilder(
            supabase.from('sms_logs').select('id', { count: 'exact', head: true }).eq('status', status) as unknown as PromiseLike<HeadCountResult>,
        ),
};
