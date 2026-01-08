
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Type definitions
type Client = Database['public']['Tables']['clients']['Row'];

export const clientsService = {
    async getClients() {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('company_name');

        if (error) throw error;
        return data;
    },

    async getClientById(id: string) {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }
};
