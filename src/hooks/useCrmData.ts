
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { leadsService } from '@/services/leadsService';
import { appointmentsService } from '@/services/appointmentsService';
import { statsService } from '@/services/statsService';
import { LeadStatus } from '@/types/database';
import { LeadWithRelations } from '@/types/app';
import { useToast } from '@/hooks/use-toast';

export function useLeads(isAdmin?: boolean, clientId?: string) {
    return useQuery({
        queryKey: ['leads', { isAdmin, clientId }],
        queryFn: () => leadsService.getLeads(isAdmin, clientId),
    });
}

export function useDashboardStats(isAdmin: boolean) {
    return useQuery({
        queryKey: ['dashboard-stats', { isAdmin }],
        queryFn: async () => {
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const [
                leadsCount,
                newLeadsCount,
                appointmentsCount,
                soldLeadsCount,
                contactedLeadsCount,
                appointmentBookedCount,
                completedAppointmentsCount,
                totalAppointmentsCount,
                usersCount,
                smsCount
            ] = await Promise.all([
                supabase.from('leads').select('id', { count: 'exact', head: true }),
                supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
                supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', weekStart.toISOString()),
                supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
                supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['contacting', 'appointment_booked', 'interviewed', 'sold', 'no_show', 'cancelled']),
                supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['appointment_booked', 'interviewed', 'sold', 'no_show']),
                supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
                supabase.from('appointments').select('id', { count: 'exact', head: true }),
                isAdmin ? supabase.from('profiles').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
                supabase.from('sms_logs').select('id', { count: 'exact', head: true }),
            ]);

            const totalLeads = leadsCount.count || 0;
            const soldLeads = soldLeadsCount.count || 0;
            const contactedLeads = contactedLeadsCount.count || 0;
            const appointmentBookedLeads = appointmentBookedCount.count || 0;
            const completedAppointments = completedAppointmentsCount.count || 0;
            const totalAppointments = totalAppointmentsCount.count || 0;

            return {
                totalLeads,
                newLeads: newLeadsCount.count || 0,
                appointmentsThisWeek: appointmentsCount.count || 0,
                conversionRate: totalLeads > 0 ? Math.round((soldLeads / totalLeads) * 100) : 0,
                closeRate: contactedLeads > 0 ? Math.round((soldLeads / contactedLeads) * 100) : 0,
                showRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
                bookingRate: totalLeads > 0 ? Math.round((appointmentBookedLeads / totalLeads) * 100) : 0,
                totalUsers: usersCount.count || 0,
                totalSms: smsCount.count || 0,
            };
        },
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
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['leads'] });

            // Snapshot the previous value
            const previousLeads = queryClient.getQueryData<LeadWithRelations[]>(['leads']);

            // Optimistically update to the new value
            if (previousLeads) {
                queryClient.setQueryData<LeadWithRelations[]>(['leads'], (old) =>
                    old?.map((lead) =>
                        lead.id === id ? { ...lead, status } : lead
                    )
                );
            }

            return { previousLeads };
        },
        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, variables, context) => {
            if (context?.previousLeads) {
                queryClient.setQueryData(['leads'], context.previousLeads);
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
            const previousLeads = queryClient.getQueryData<LeadWithRelations[]>(['leads']);

            if (previousLeads) {
                queryClient.setQueryData<LeadWithRelations[]>(['leads'], (old) =>
                    old?.filter((lead) => lead.id !== id)
                );
            }

            return { previousLeads };
        },
        onError: (err, id, context) => {
            if (context?.previousLeads) {
                queryClient.setQueryData(['leads'], context.previousLeads);
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
