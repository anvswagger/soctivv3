
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { LeadWithRelations, PaginatedResponse, LeadsFilter } from "@/types/app";

// Type definitions to avoid "any"
type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

// Service Object
export const leadsService = {

    async getLeads(
        page: number = 1,
        pageSize: number = 50,
        filters: LeadsFilter = {}
    ): Promise<PaginatedResponse<LeadWithRelations>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('leads')
            .select('*, client:clients(id, company_name)', { count: 'exact' });

        // Filters
        if (filters.clientId) {
            if (Array.isArray(filters.clientId)) {
                query = query.in('client_id', filters.clientId);
            } else if (filters.clientId !== 'all') {
                query = query.eq('client_id', filters.clientId);
            }
        }

        if (filters.status) {
            query = query.eq('status', filters.status as any);
        }

        if (filters.search) {
            // Note: This is a simple ILIKE. For better performance on large datasets, use Text Search / pg_trgm
            const searchTerm = `%${filters.search}%`;
            query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`);
        }

        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }

        if (filters.endDate) {
            // Adjust end date to cover the entire day
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            query = query.lte('created_at', end.toISOString());
        }

        // Sorting & Pagination
        query = query.order('created_at', { ascending: false })
            .range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            data: (data as any) || [],
            count: count || 0
        };
    },

    async createLead(lead: LeadInsert) {
        const { data, error } = await supabase
            .from('leads')
            .insert(lead)
            .select()
            .single();

        if (error) throw error;

        // Send 'lead-created' template SMS (same structure as appointment-reminders)
        try {
            if (data.phone && data.client_id) {
                // Fetch client data for template params
                const { data: clientData } = await supabase
                    .from('clients')
                    .select('company_name, phone')
                    .eq('id', data.client_id)
                    .single();

                const companyName = (clientData?.company_name || '').substring(0, 10);

                await supabase.functions.invoke('send-sms', {
                    body: {
                        template_id: 'lead-created',
                        lead_id: data.id,
                        phone_number: data.phone,
                        params: [
                            { company_name: companyName || 'الشركة' },
                            { lead_first_name: data.first_name || 'العميل' },
                            { lead_last_name: data.last_name || '' },
                            { lead_full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'العميل' },
                            { appointment_date: '' },
                            { appointment_time: '' },
                            { appointment_day: '' },
                            { appointment_hour: '' },
                            { appointment_location: '' }
                        ]
                    }
                });
            }
        } catch (smsError) {
            console.error('Failed to send lead-created SMS:', smsError);
            // Don't block lead creation if SMS fails
        }

        return data;
    },

    async updateLead(id: string, updates: LeadUpdate) {
        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteLead(id: string) {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
