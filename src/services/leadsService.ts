
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Type definitions to avoid "any"
type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

// Service Object
export const leadsService = {

    async getLeads(isAdmin?: boolean, clientId?: string) {
        let query = supabase
            .from('leads')
            .select('*, client:clients(id, company_name)')
            .order('created_at', { ascending: false });

        // Apply filtering if provided (server-side filtering is better than client-side)
        // For now, we fetch all and let component filter or we enforce RLS?
        // Supabase RLS handles security. Client filtering handles UI views.
        // If admin wants to see all, RLS allows.

        // Optimizing selection for speed could be done here too.

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async createLead(lead: LeadInsert) {
        const { data, error } = await supabase
            .from('leads')
            .insert(lead)
            .select()
            .single();

        if (error) throw error;
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
