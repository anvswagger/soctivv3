
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { fixArabicMojibakeObject } from "@/lib/text";

// Type definitions
type Client = Database['public']['Tables']['clients']['Row'];

export const clientsService = {
    async getClients() {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('company_name');

        if (error) {
            // If the query fails due to permissions, return empty array instead of throwing
            console.warn('Failed to fetch clients:', error);
            return [];
        }

        const sanitized = Array.isArray(data) ? data.map((client) => fixArabicMojibakeObject(client)) : [];
        return sanitized;
    },

    async getClientById(id: string) {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data ? fixArabicMojibakeObject(data) : data;
    }
};
