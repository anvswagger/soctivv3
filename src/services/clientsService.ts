
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { fixArabicMojibakeObject } from "@/lib/text";

// Type definitions
type Client = Database['public']['Tables']['clients']['Row'];

export const clientsService = {
    async getClients(): Promise<Client[]> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('company_name');

        if (error) {
            // If the query fails due to permissions, return empty array instead of throwing
            console.warn('Failed to fetch clients:', error);
            return [];
        }

        const sanitized = Array.isArray(data) ? (data as any[]).map((client) => fixArabicMojibakeObject(client)) : [];
        return sanitized as unknown as Client[];
    },

    async getClientById(id: string) {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id as any)
            .single();

        if (error) throw error;
        return data ? fixArabicMojibakeObject(data) : data;
    }
};
