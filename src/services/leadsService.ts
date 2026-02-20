
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { LeadWithRelations, PaginatedResponse, LeadsFilter } from "@/types/app";
import { LeadStatus } from "@/types/database";
import { analyticsService } from "@/services/analyticsService";
import { fixArabicMojibakeObject } from "@/lib/text";

// Type definitions to avoid "any"
type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

// Type guard for LeadStatus
function isValidLeadStatus(status: unknown): status is LeadStatus {
    const validStatuses: LeadStatus[] = [
        'new', 'contacting', 'appointment_booked',
        'interviewed', 'no_show', 'sold', 'cancelled'
    ];
    return typeof status === 'string' && validStatuses.includes(status as LeadStatus);
}

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
                if (filters.clientId.length === 0) {
                    return { data: [], count: 0 };
                }
                query = query.in('client_id', filters.clientId);
            } else if (filters.clientId !== 'all') {
                query = query.eq('client_id', filters.clientId);
            }
        }

        if (filters.status && isValidLeadStatus(filters.status)) {
            query = query.eq('status', filters.status);
        }

        if (filters.search) {
            // Escape special PostgreSQL LIKE characters to prevent wildcard injection
            const escapedSearch = filters.search
                .substring(0, 200) // Limit length to prevent DoS
                .replace(/\\/g, '\\\\')  // Escape backslashes first
                .replace(/%/g, '\\%')    // Escape percent wildcards
                .replace(/_/g, '\\_');   // Escape underscore wildcards
            query = query.or(`first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%`);
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

        const sanitized = Array.isArray(data) ? data.map((lead) => fixArabicMojibakeObject(lead)) : [];

        return {
            data: sanitized as any,
            count: count || 0
        };
    },

    async createLead(lead: LeadInsert) {
        const startTime = Date.now();
        console.log('[LEAD_DEBUG] Starting lead creation...');

        const { data, error } = await supabase
            .from('leads')
            .insert(lead)
            .select()
            .single();

        console.log(`[LEAD_DEBUG] Lead inserted in ${Date.now() - startTime}ms`);
        if (error) throw error;

        // Fire SMS and analytics in background - don't await (non-blocking)
        // This prevents lag when adding leads
        leadsService.sendLeadCreatedSms(data).catch(err =>
            console.error('[LEAD_DEBUG] SMS send failed:', err)
        );
        leadsService.trackLeadCreatedAnalytics(data).catch(err =>
            console.error('[LEAD_DEBUG] Analytics failed:', err)
        );

        console.log(`[LEAD_DEBUG] Total lead creation took ${Date.now() - startTime}ms (non-blocking ops started)`);
        return data;
    },

    // Separate method for non-blocking SMS sending
    async sendLeadCreatedSms(data: Lead) {
        const smsStartTime = Date.now();
        console.log('[LEAD_DEBUG] Starting SMS send...');
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
                            { lead_full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'العميل' },
                            { c_number: clientData?.phone || '' }
                        ]
                    }
                });
            }
        } catch (smsError) {
            console.error('Failed to send lead-created SMS:', smsError);
        }
        console.log(`[LEAD_DEBUG] SMS sent/completed in ${Date.now() - smsStartTime}ms`);
    },

    // Separate method for non-blocking analytics tracking
    async trackLeadCreatedAnalytics(data: Lead) {
        const analyticsStartTime = Date.now();
        console.log('[LEAD_DEBUG] Starting analytics tracking...');
        try {
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData.user?.id;
            if (userId) {
                await analyticsService.trackEvent({
                    userId,
                    clientId: data.client_id ?? null,
                    leadId: data.id,
                    eventType: 'lead_created',
                    eventName: data.source || 'unknown',
                    metadata: {
                        status: data.status,
                    },
                });
            }
            console.log(`[LEAD_DEBUG] Analytics tracked in ${Date.now() - analyticsStartTime}ms`);
        } catch {
            // Non-blocking analytics
        }
    },

    async updateLead(id: string, updates: LeadUpdate) {
        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Track analytics for lead update
        if (data) {
            try {
                const { data: authData } = await supabase.auth.getUser();
                const userId = authData.user?.id;
                if (userId) {
                    // Determine if this is a status change
                    const eventType = updates.status ? 'lead_status_changed' : 'lead_updated';
                    void analyticsService.trackEvent({
                        userId,
                        clientId: data.client_id ?? null,
                        leadId: data.id,
                        eventType,
                        eventName: data.source || 'unknown',
                        metadata: {
                            previous_status: null, // We don't have previous status here
                            new_status: data.status,
                            updated_fields: Object.keys(updates),
                        },
                    });
                }
            } catch {
                // Non-blocking analytics
            }
        }

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
