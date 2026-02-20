import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fixArabicMojibakeObject } from "@/lib/text";

type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type AppointmentStatus = Database['public']['Enums']['appointment_status'];

const APPOINTMENT_STATUS_TO_LEAD_STATUS: Record<AppointmentStatus, LeadStatus> = {
    scheduled: 'appointment_booked',
    completed: 'interviewed',
    no_show: 'no_show',
    cancelled: 'cancelled',
};

async function syncLeadStatusFromAppointment(leadId: string, appointmentStatus: AppointmentStatus | null | undefined): Promise<void> {
    if (!leadId || !appointmentStatus) return;

    const mappedStatus = APPOINTMENT_STATUS_TO_LEAD_STATUS[appointmentStatus];
    if (!mappedStatus) return;

    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('status')
        .eq('id', leadId)
        .single();

    if (leadError || !lead) {
        console.error('Failed to load lead for status sync:', leadError);
        return;
    }

    // Keep sold leads intact and avoid unnecessary writes.
    if (lead.status === 'sold' || lead.status === mappedStatus) {
        return;
    }

    const { error: updateLeadError } = await supabase
        .from('leads')
        .update({ status: mappedStatus })
        .eq('id', leadId);

    if (updateLeadError) {
        console.error('Failed to sync lead status from appointment:', updateLeadError);
    }
}

export const appointmentsService = {
    async getAppointments(clientFilter?: string[] | null) {
        let query = supabase
            .from('appointments')
            .select(`
        *,
        lead:leads(id, first_name, last_name, phone, email, status, source, notes, created_at, client_id),
        client:clients(company_name)
      `)
            .order('scheduled_at', { ascending: true });

        if (clientFilter !== undefined && clientFilter !== null) {
            if (clientFilter.length === 0) {
                return [];
            }
            query = query.in('client_id', clientFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        const sanitized = Array.isArray(data) ? data.map((appointment) => fixArabicMojibakeObject(appointment)) : data;
        return sanitized;
    },

    async createAppointment(appointment: AppointmentInsert) {
        const { data, error } = await supabase
            .from('appointments')
            .insert(appointment)
            .select()
            .single();

        if (error) throw error;

        await syncLeadStatusFromAppointment(data.lead_id, data.status);

        // Try to send immediate confirmation SMS if template exists.
        try {
            const [leadResult, clientResult] = await Promise.all([
                supabase.from('leads').select('phone, first_name, last_name').eq('id', data.lead_id).single(),
                supabase.from('clients').select('company_name, phone').eq('id', data.client_id).single(),
            ]);

            const leadData = leadResult.data;
            const clientData = clientResult.data;

            if (leadData?.phone) {
                const scheduledDate = new Date(data.scheduled_at);
                const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const appointmentDayArabic = days[scheduledDate.getDay()];
                const leadFullName = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim();

                // Format time in 12-hour format with AM/PM for Arabic
                const timeFormatter = new Intl.DateTimeFormat('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Africa/Tripoli'
                });
                const formattedTime = timeFormatter.format(scheduledDate);

                await supabase.functions.invoke('send-sms', {
                    body: {
                        template_id: 'appointment-confirmed',
                        lead_id: data.lead_id,
                        appointment_id: data.id,
                        phone_number: leadData.phone,
                        params: [
                            { company_name: (clientData?.company_name || '').substring(0, 10) || 'الشركة' },
                            { lead_first_name: leadData.first_name || 'العميل' },
                            { lead_last_name: leadData.last_name || '' },
                            { lead_full_name: leadFullName || 'العميل' },
                            { appointment_date: format(scheduledDate, 'yyyy/MM/dd') },
                            { appointment_time: formattedTime },
                            { appointment_day: appointmentDayArabic },
                            { appointment_hour: formattedTime },
                            { appointment_location: data.location || 'سيتم تحديده لاحقاً' },
                            { c_number: clientData?.phone || '' },
                            { c_phone: clientData?.phone || '' },
                        ],
                    },
                });
            } else {
                console.warn('Lead has no phone number, skipping confirmation SMS');
            }
        } catch (smsError) {
            console.error('Failed to send confirmation SMS:', smsError);
        }

        return data;
    },

    async updateAppointment(id: string, updates: AppointmentUpdate, originalScheduledAt?: string) {
        const { data, error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (typeof updates.status !== 'undefined') {
            await syncLeadStatusFromAppointment(data.lead_id, data.status);
        }

        if (originalScheduledAt && updates.scheduled_at) {
            const oldTime = new Date(originalScheduledAt).getTime();
            const newTime = new Date(updates.scheduled_at).getTime();
            if (oldTime !== newTime) {
                await supabase.from('appointment_reminders').delete().eq('appointment_id', id);
            }
        }

        return data;
    },

    async deleteAppointment(id: string) {
        await supabase.from('appointment_reminders').delete().eq('appointment_id', id);

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },
};
