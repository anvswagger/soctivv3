/**
 * @module confirmedOrdersService
 * Service layer for appointment CRUD operations. Handles lead status
 * synchronisation, confirmation SMS dispatch, and reminder cleanup
 * on reschedule/delete.
 */

import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fixArabicMojibakeObject } from "@/lib/text";

type Appointment = Database['public']['Tables']['appointments']['Row'];
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type AppointmentStatus = Database['public']['Enums']['appointment_status'];

/** Maps each appointment status to the corresponding lead pipeline status. */
const APPOINTMENT_STATUS_TO_LEAD_STATUS: Record<AppointmentStatus, LeadStatus> = {
    scheduled: 'appointment_booked',
    completed: 'interviewed',
    no_show: 'no_show',
    cancelled: 'cancelled',
};

/**
 * Strips empty-string UUIDs, undefined keys, and coerces empty optional fields
 * to null so that PostgREST does not reject the request.
 */
function sanitizeAppointmentPayload<T extends AppointmentInsert | AppointmentUpdate>(payload: T): T {
    const next = { ...payload } as Record<string, unknown>;

    // Prevent PostgREST 400s from empty-string UUIDs or invalid optional values.
    if (next.lead_id === '') delete next.lead_id;
    if (next.client_id === '') delete next.client_id;
    if (next.location === '') next.location = null;
    if (next.notes === '') next.notes = null;

    // Drop undefined keys so PATCH only sends intended columns.
    Object.keys(next).forEach((key) => {
        if (typeof next[key] === 'undefined') delete next[key];
    });

    return next as T;
}

/**
 * Synchronises the parent lead's status whenever an appointment status changes.
 * Skips updates for leads already marked as "sold" or already at the target status.
 */
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

export const confirmedOrdersService = {
    /**
     * Retrieves all appointments (optionally filtered by client IDs) with
     * joined lead and client data, ordered by scheduled date ascending.
     *
     * @param clientFilter - Optional array of client UUIDs to filter by; null = no filter; empty = return nothing
     * @returns Array of appointments with related lead and client objects
     */
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

        const sanitized = Array.isArray(data) ? data.map((appointment) => fixArabicMojibakeObject(appointment)) : [];
        return sanitized as unknown as (Appointment & { lead: unknown; client: unknown })[];
    },

    /**
     * Creates a new appointment, syncs the associated lead's status,
     * and sends a confirmation SMS to the lead if a phone number exists.
     *
     * @param appointment - The appointment data to insert
     * @returns The newly created appointment row
     */
    async createAppointment(appointment: AppointmentInsert) {
        const payload = sanitizeAppointmentPayload(appointment);
        const { data, error } = await supabase
            .from('appointments')
            .insert(payload)
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

    /**
     * Updates an existing appointment. Syncs lead status if the appointment
     * status changed, and clears pending reminders when the scheduled time
     * is rescheduled.
     *
     * @param id - UUID of the appointment to update
     * @param updates - Partial appointment fields to apply
     * @param originalScheduledAt - Previous scheduled_at value, used to detect reschedule
     * @returns The updated appointment row
     */
    async updateAppointment(id: string, updates: AppointmentUpdate, originalScheduledAt?: string) {
        const sanitized = sanitizeAppointmentPayload(updates);
        const payload = sanitizeAppointmentPayload({
            scheduled_at: sanitized.scheduled_at,
            duration_minutes: sanitized.duration_minutes,
            location: sanitized.location,
            notes: sanitized.notes,
            status: sanitized.status,
        } as AppointmentUpdate);
        const { data, error } = await supabase
            .from('appointments')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Failed to update appointment', { id, payload, error });
            throw error;
        }

        if (typeof payload.status !== 'undefined') {
            await syncLeadStatusFromAppointment(data.lead_id, data.status);
        }

        if (originalScheduledAt && payload.scheduled_at) {
            const oldTime = new Date(originalScheduledAt).getTime();
            const newTime = new Date(payload.scheduled_at).getTime();
            if (oldTime !== newTime) {
                await supabase.from('appointment_reminders').delete().eq('appointment_id', id);
            }
        }

        return data;
    },

    /**
     * Deletes an appointment and its associated reminders.
     *
     * @param id - UUID of the appointment to delete
     * @returns `true` on success
     */
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
