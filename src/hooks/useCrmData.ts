
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { leadsService } from '@/services/leadsService';
import { statsService } from '@/services/statsService';
import { analyticsService } from '@/services/analyticsService';
import { LeadStatus } from '@/types/database';
import { LeadWithRelations, PaginatedResponse } from '@/types/app';
import { useToast } from '@/hooks/use-toast';
import { fixArabicMojibakeObject } from '@/lib/text';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_POLICY } from '@/lib/queryPolicy';
import { queryInvalidation } from '@/lib/queryInvalidation';

type LeadStatusCountKey = LeadStatus | 'no_show' | 'cancelled';

interface DashboardStatsRpc {
    total_leads?: number;
    new_leads_24h?: number;
    appointments_this_week?: number;
    total_appointments?: number;
    completed_appointments?: number;
    total_users?: number;
    total_sms?: number;
    status_counts?: Partial<Record<LeadStatusCountKey, number>>;
}

export function useLeads(
    page: number = 1,
    pageSize: number = 50,
    filters: Record<string, unknown> = {}
) {
    return useQuery({
        queryKey: queryKeys.leads.list(page, pageSize, filters),
        queryFn: () => leadsService.getLeads(page, pageSize, filters),
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
        staleTime: QUERY_POLICY.crm.leads.staleTime,
        gcTime: QUERY_POLICY.crm.leads.gcTime,
        retry: 1,
    });
}

export function useDashboardStats(clientFilter: string[] | null = null) {
    return useQuery({
        queryKey: [...queryKeys.dashboard.stats, clientFilter],
        queryFn: async () => {
            try {
                // TRY: Optimized RPC Call - server verifies admin status internally
                const data = await statsService.getDashboardStats() as DashboardStatsRpc | null;

                if (!data) throw new Error('Empty RPC response');

                // Derive additional rates from RPC data for UI compatibility
                const totalLeads = data.total_leads || 0;
                const statusCounts = data.status_counts || {};

                const soldLeads = statusCounts.sold || 0;
                const contactedLeads = (statusCounts.contacting || 0) +
                    (statusCounts.appointment_booked || 0) +
                    (statusCounts.interviewed || 0) +
                    (statusCounts.sold || 0) +
                    (statusCounts.no_show || 0) +
                    (statusCounts.cancelled || 0);

                const appointmentBookedLeads = (statusCounts.appointment_booked || 0) +
                    (statusCounts.interviewed || 0) +
                    (statusCounts.sold || 0) +
                    (statusCounts.no_show || 0);

                return {
                    totalLeads: data.total_leads || 0,
                    newLeads: data.new_leads_24h || 0,
                    appointmentsThisWeek: data.appointments_this_week || 0,
                    conversionRate: totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0,
                    closeRate: contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0,
                    showRate: (data.total_appointments || 0) > 0 ? Math.round(((data.completed_appointments || 0) / data.total_appointments) * 100) : 0,
                    bookingRate: totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0,
                    totalUsers: data.total_users || 0,
                    totalSms: data.total_sms || 0,
                };
            } catch (error) {
                console.warn('Dashboard RPC failed, falling back to legacy fetching:', error);

                if (clientFilter !== null && clientFilter.length === 0) {
                    return {
                        totalLeads: 0,
                        newLeads: 0,
                        appointmentsThisWeek: 0,
                        conversionRate: 0,
                        closeRate: 0,
                        showRate: 0,
                        bookingRate: 0,
                        totalUsers: 0,
                        totalSms: 0,
                    };
                }

                // FALLBACK: Count-based queries to avoid transferring full tables.
                const now = new Date();
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);

                let leadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true });
                let newLeadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
                let soldLeadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sold');
                let contactedLeadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']);
                let appointmentBookedLeadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['appointment_booked', 'interviewed', 'sold', 'no_show']);
                let appointmentsQuery = supabase.from('appointments').select('id', { count: 'exact', head: true });
                let appointmentsThisWeekQuery = supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', weekStart.toISOString());
                let completedAppointmentsQuery = supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed');

                if (clientFilter !== null) {
                    leadsQuery = leadsQuery.in('client_id', clientFilter);
                    newLeadsQuery = newLeadsQuery.in('client_id', clientFilter);
                    soldLeadsQuery = soldLeadsQuery.in('client_id', clientFilter);
                    contactedLeadsQuery = contactedLeadsQuery.in('client_id', clientFilter);
                    appointmentBookedLeadsQuery = appointmentBookedLeadsQuery.in('client_id', clientFilter);
                    appointmentsQuery = appointmentsQuery.in('client_id', clientFilter);
                    appointmentsThisWeekQuery = appointmentsThisWeekQuery.in('client_id', clientFilter);
                    completedAppointmentsQuery = completedAppointmentsQuery.in('client_id', clientFilter);
                }

                const [
                    totalLeadsRes,
                    newLeadsRes,
                    soldLeadsRes,
                    contactedLeadsRes,
                    appointmentBookedLeadsRes,
                    totalAppointmentsRes,
                    appointmentsThisWeekRes,
                    completedAppointmentsRes,
                    totalUsersRes,
                    totalSmsRes,
                ] = await Promise.all([
                    leadsQuery,
                    newLeadsQuery,
                    soldLeadsQuery,
                    contactedLeadsQuery,
                    appointmentBookedLeadsQuery,
                    appointmentsQuery,
                    appointmentsThisWeekQuery,
                    completedAppointmentsQuery,
                    supabase.from('profiles').select('id', { count: 'exact', head: true }),
                    supabase.from('sms_logs').select('id', { count: 'exact', head: true }),
                ]);

                type CountResult = { count: number | null; error: { message: string } | null };
                const readCount = (label: string, result: CountResult) => {
                    if (result.error) {
                        console.warn(`Dashboard fallback count failed for ${label}:`, result.error.message);
                    }
                    return result.count ?? 0;
                };

                const totalLeads = readCount('leads.total', totalLeadsRes);
                const newLeads = readCount('leads.new', newLeadsRes);
                const soldLeads = readCount('leads.sold', soldLeadsRes);
                const contactedLeads = readCount('leads.contacted', contactedLeadsRes);
                const appointmentBookedLeads = readCount('leads.appointmentBooked', appointmentBookedLeadsRes);
                const totalAppointments = readCount('appointments.total', totalAppointmentsRes);
                const appointmentsThisWeek = readCount('appointments.thisWeek', appointmentsThisWeekRes);
                const completedAppointments = readCount('appointments.completed', completedAppointmentsRes);

                return {
                    totalLeads,
                    newLeads,
                    appointmentsThisWeek,
                    conversionRate: totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0,
                    closeRate: contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0,
                    showRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
                    bookingRate: totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0,
                    totalUsers: readCount('profiles.total', totalUsersRes),
                    totalSms: readCount('sms.total', totalSmsRes),
                };
            }
        },
        staleTime: QUERY_POLICY.crm.dashboardStats.staleTime,
        gcTime: QUERY_POLICY.crm.dashboardStats.gcTime,
    });
}

export function useSmsLogs() {
    return useQuery({
        queryKey: queryKeys.sms.logs,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sms_logs')
                .select('*, lead:leads(first_name, last_name, phone)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return Array.isArray(data) ? data.map((row) => fixArabicMojibakeObject(row)) : data;
        },
        staleTime: QUERY_POLICY.crm.smsLogs.staleTime,
        gcTime: QUERY_POLICY.crm.smsLogs.gcTime,
    });
}

export function useSmsTemplates() {
    return useQuery({
        queryKey: queryKeys.sms.templates,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sms_templates')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return Array.isArray(data) ? data.map((row) => fixArabicMojibakeObject(row)) : data;
        },
        staleTime: QUERY_POLICY.crm.smsTemplates.staleTime,
        gcTime: QUERY_POLICY.crm.smsTemplates.gcTime,
    });
}

// --- OPTIMISTIC MUTATIONS ---

export function useUpdateLeadStatus() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
            leadsService.updateLead(id, { status }),

        // Optimistic Update logic
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.leads.root });

            const previousLeadQueries = queryClient.getQueriesData<PaginatedResponse<LeadWithRelations>>({
                queryKey: queryKeys.leads.root,
            });

            queryClient.setQueriesData<PaginatedResponse<LeadWithRelations>>(
                { queryKey: queryKeys.leads.root },
                (old) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.map((lead) =>
                            lead.id === id ? { ...lead, status } : lead
                        ),
                    };
                }
            );

            return { previousLeadQueries };
        },
        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, variables, context) => {
            if (context?.previousLeadQueries) {
                context.previousLeadQueries.forEach(([queryKey, queryData]) => {
                    queryClient.setQueryData(queryKey, queryData);
                });
            }
            toast({
                title: 'خطأ',
                description: 'فشل في تحديث حالة العميل',
                variant: 'destructive',
            });
        },
        // Track analytics on success
        onSuccess: async (data, variables) => {
            if (data) {
                try {
                    const { data: authData } = await supabase.auth.getUser();
                    const userId = authData.user?.id;
                    if (userId) {
                        void analyticsService.trackEvent({
                            userId,
                            clientId: data.client_id ?? null,
                            leadId: data.id,
                            eventType: 'lead_status_changed',
                            eventName: data.source || 'unknown',
                            metadata: {
                                new_status: variables.status,
                            },
                        });
                    }
                } catch {
                    // Non-blocking analytics
                }
            }
        },
        // Always refetch after error or success:
        onSettled: () => {
            void queryInvalidation.invalidateDomain(queryClient, 'leads');
        },
    });
}

export function useDeleteLead() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: (id: string) => leadsService.deleteLead(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.leads.root });
            const previousLeadQueries = queryClient.getQueriesData<PaginatedResponse<LeadWithRelations>>({
                queryKey: queryKeys.leads.root,
            });

            queryClient.setQueriesData<PaginatedResponse<LeadWithRelations>>(
                { queryKey: queryKeys.leads.root },
                (old) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.filter((lead) => lead.id !== id),
                        count: Math.max((old.count || 0) - 1, 0),
                    };
                }
            );

            return { previousLeadQueries };
        },
        onError: (err, id, context) => {
            if (context?.previousLeadQueries) {
                context.previousLeadQueries.forEach(([queryKey, queryData]) => {
                    queryClient.setQueryData(queryKey, queryData);
                });
            }
            toast({
                title: 'خطأ',
                description: 'فشل في حذف العميل',
                variant: 'destructive',
            });
        },
        onSettled: () => {
            void queryInvalidation.invalidateDomain(queryClient, 'leads');
        },
    });
}
