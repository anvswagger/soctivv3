
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { leadsService } from '@/services/leadsService';
import { statsService } from '@/services/statsService';
import { LeadStatus } from '@/types/database';
import { LeadWithRelations, PaginatedResponse } from '@/types/app';
import { useToast } from '@/hooks/use-toast';


export function useLeads(
    page: number = 1,
    pageSize: number = 50,
    filters: any = {} // Using any for now to avoid circular dependency issues if types aren't perfect yet
) {
    return useQuery({
        queryKey: ['leads', { page, pageSize, ...filters }],
        queryFn: () => leadsService.getLeads(page, pageSize, filters),
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
        retry: 1,
    });
}

export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            try {
                // TRY: Optimized RPC Call - server verifies admin status internally
                const data = await statsService.getDashboardStats() as any;

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

                // FALLBACK: Legacy Parallel Fetching (RLS will handle access control)
                const now = new Date();
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);

                const [
                    { data: leads = [] },
                    { data: appointments = [] },
                    usersCount,
                    smsCount
                ] = await Promise.all([
                    supabase.from('leads').select('status'),
                    supabase.from('appointments').select('status, scheduled_at'),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }),
                    supabase.from('sms_logs').select('id', { count: 'exact', head: true }),
                ]);

                const totalLeads = leads?.length || 0;
                const newLeads = leads?.filter(l => l.status === 'new').length || 0;
                const soldLeads = leads?.filter(l => l.status === 'sold').length || 0;
                const contactedLeads = leads?.filter(l => ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled'].includes(l.status)).length || 0;
                const appointmentBookedLeads = leads?.filter(l => ['appointment_booked', 'interviewed', 'sold', 'no_show'].includes(l.status)).length || 0;

                const totalAppointments = appointments?.length || 0;
                const appointmentsThisWeek = appointments?.filter(a => new Date(a.scheduled_at) >= weekStart).length || 0;
                const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0;

                return {
                    totalLeads,
                    newLeads,
                    appointmentsThisWeek,
                    conversionRate: totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0,
                    closeRate: contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0,
                    showRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
                    bookingRate: totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0,
                    totalUsers: usersCount.count || 0,
                    totalSms: smsCount.count || 0,
                };
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function useSmsLogs() {
    return useQuery({
        queryKey: ['sms-logs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sms_logs')
                .select('*, lead:leads(first_name, last_name, phone)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });
}

export function useSmsTemplates() {
    return useQuery({
        queryKey: ['sms-templates'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sms_templates')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
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
            await queryClient.cancelQueries({ queryKey: ['leads'] });

            const previousLeadQueries = queryClient.getQueriesData<PaginatedResponse<LeadWithRelations>>({
                queryKey: ['leads'],
            });

            queryClient.setQueriesData<PaginatedResponse<LeadWithRelations>>(
                { queryKey: ['leads'] },
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
        // Always refetch after error or success:
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });
}

export function useDeleteLead() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: (id: string) => leadsService.deleteLead(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['leads'] });
            const previousLeadQueries = queryClient.getQueriesData<PaginatedResponse<LeadWithRelations>>({
                queryKey: ['leads'],
            });

            queryClient.setQueriesData<PaginatedResponse<LeadWithRelations>>(
                { queryKey: ['leads'] },
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
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });
}
