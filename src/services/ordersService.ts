/**
 * @module ordersService
 * Service layer for CRUD operations on leads, including SMS notifications,
 * analytics tracking, and product stock management. All data access goes
 * through the Supabase client.
 */

import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { LeadWithRelations, PaginatedResponse, LeadsFilter } from "@/types/app";
import { LeadStatus } from "@/types/database";
import { analyticsService } from "@/services/analyticsService";
import { fixArabicMojibakeObject } from "@/lib/text";
import { escapeSearch } from "@/lib/search";

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

export const ordersService = {

    /**
     * Fetches a paginated, filtered list of leads with their related client data.
     * Supports filtering by client, status, search text, and date range.
     * Search input is escaped to prevent SQL wildcard injection.
     *
     * @param page - 1-indexed page number (default 1)
     * @param pageSize - Number of records per page (default 50)
     * @param filters - Optional filter criteria (clientId, status, search, startDate, endDate)
     * @returns Paginated response containing leads and total count
     */
    async getLeads(
        page: number = 1,
        pageSize: number = 50,
        filters: LeadsFilter = {}
    ): Promise<PaginatedResponse<LeadWithRelations>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('leads')
            .select('*, client:clients(id, company_name), product:products(name)', { count: 'exact' });

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
            query = query.eq('status', filters.status as Database['public']['Enums']['lead_status']);
        }

        if (filters.search) {
            const escaped = escapeSearch(filters.search);
            query = query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
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
            data: sanitized as unknown as LeadWithRelations[],
            count: count ?? 0
        };
    },

    /**
     * Creates a new lead record. After insertion, triggers non-blocking
     * side-effects: product stock decrement, SMS notification, and analytics.
     *
     * @param lead - The lead data to insert
     * @returns The newly created lead row
     */
    async createLead(lead: LeadInsert) {
        const { data, error } = await supabase
            .from('leads')
            .insert(lead)
            .select()
            .single();

        if (error) throw error;

        if (lead.product_id && lead.quantity > 0) {
            ordersService.decrementProductStock(lead.product_id, lead.quantity).catch(err =>
                console.error('[LEAD_DEBUG] Stock decrement failed:', err)
            );
        }

        // Fire SMS and analytics in background - don't await (non-blocking)
        // This prevents lag when adding leads
        ordersService.sendLeadCreatedSms(data).catch(err =>
            console.error('[LEAD_DEBUG] SMS send failed:', err)
        );
        ordersService.trackLeadCreatedAnalytics(data).catch(err =>
            console.error('[LEAD_DEBUG] Analytics failed:', err)
        );

        return data;
    },

    /**
     * Sends a lead-created SMS via the Supabase edge function.
     * Errors are caught and logged silently to avoid blocking the caller.
     *
     * @param data - The newly created lead row
     */
    async sendLeadCreatedSms(data: Lead) {
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
    },

    /**
     * Tracks a lead_created analytics event for the authenticated user.
     * Errors are silently ignored to keep this non-blocking.
     *
     * @param data - The newly created lead row
     */
    async trackLeadCreatedAnalytics(data: Lead) {
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
        } catch {
            // Non-blocking analytics
        }
    },

    /**
     * Atomically decrements product stock via the `decrement_stock` RPC.
     * No-ops when productId is empty or quantity is non-positive.
     *
     * @param productId - UUID of the product
     * @param quantity - Number of units to deduct
     */
    async decrementProductStock(productId: string, quantity: number) {
        if (!productId || quantity <= 0) return;
        const { data, error } = await supabase.rpc('decrement_stock', {
            p_product_id: productId,
            p_quantity: quantity,
        });
        if (error) {
            console.error('[STOCK] Failed to decrement stock:', error);
            return;
        }
        if (!data) {
            console.warn('[STOCK] Insufficient stock for product:', productId, 'requested:', quantity);
        }
    },

    /**
     * Updates an existing lead by ID. Tracks analytics for the update event
     * (or lead_status_changed when the status field is modified).
     *
     * @param id - UUID of the lead to update
     * @param updates - Partial lead fields to apply
     * @returns The updated lead row
     */
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

    /**
     * Permanently deletes a lead by ID.
     *
     * @param id - UUID of the lead to delete
     * @returns `true` on success
     */
    async deleteLead(id: string) {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
