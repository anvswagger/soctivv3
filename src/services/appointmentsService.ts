import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

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
        lead:leads(first_name, last_name, phone, email, source, client_id),
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
            await supabase.functions.invoke('send-sms', {
                body: {
                    lead_id: data.lead_id,
                    appointment_id: data.id,
                    template_id: 'appointment-confirmation', // Assuming this template exists or can be fallback
                    phone_number: '', // Will be fetched by the Edge Function
                    message: 'تم تأكيد موعدك بنجاح.' // Fallback message if template not found
                }
            });
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
