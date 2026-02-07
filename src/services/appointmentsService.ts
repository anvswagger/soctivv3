import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

type Appointment = Database['public']['Tables']['appointments']['Row'];
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

export const appointmentsService = {

    async getAppointments(isAdmin?: boolean) {
        // Join with leads and clients
        // The previous code had manual casting. Here we trust the inferred types.
        const { data, error } = await supabase
            .from('appointments')
            .select(`
        *,
        lead:leads(id, first_name, last_name, phone, email, status, source, notes, created_at, client_id),
        client:clients(company_name)
      `)
            .order('scheduled_at', { ascending: true });

        if (error) throw error;
        return data;
    },

    async createAppointment(appointment: AppointmentInsert) {
        const { data, error } = await supabase
            .from('appointments')
            .insert(appointment)
            .select()
            .single();

        if (error) throw error;

        // Try to send immediate confirmation SMS if template exists
        try {
            // Fetch lead phone number and client details
            const [leadResult, clientResult] = await Promise.all([
                supabase.from('leads').select('phone, first_name, last_name').eq('id', data.lead_id).single(),
                supabase.from('clients').select('company_name, phone').eq('id', data.client_id).single()
            ]);

            const leadData = leadResult.data;
            const clientData = clientResult.data;

            if (leadData?.phone) {
                const scheduledDate = new Date(data.scheduled_at);
                // Format: 6:00
                const appointmentHour = format(scheduledDate, 'h:mm');
                // Format: Sunday
                const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const appointmentDayArabic = days[scheduledDate.getDay()];

                const leadFullName = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim();

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
                            { appointment_time: format(scheduledDate, 'HH:mm') },
                            { appointment_day: appointmentDayArabic },
                            { appointment_hour: format(scheduledDate, 'HH:mm') },
                            { appointment_location: data.location || 'سيتم تحديده لاحقاً' },
                            { c_number: clientData?.phone || '' },
                            { c_phone: clientData?.phone || '' }
                        ]
                    }
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

        // Handle reminders reset logic here? 
        // Ideally business logic stays in service.
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
        // Cleanup reminders first
        await supabase.from('appointment_reminders').delete().eq('appointment_id', id);

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
