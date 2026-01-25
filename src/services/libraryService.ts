import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type SmsTemplate = Database['public']['Tables']['sms_templates']['Row'];
export type SmsTemplateInsert = Database['public']['Tables']['sms_templates']['Insert'];
export type SmsTemplateUpdate = Database['public']['Tables']['sms_templates']['Update'];

export const libraryService = {
    // SMS Templates
    async getTemplates() {
        const { data, error } = await supabase
            .from('sms_templates')
            .select('*')
            .order('name');

        if (error) throw error;
        return data;
    },

    async createTemplate(template: SmsTemplateInsert) {
        const { data, error } = await supabase
            .from('sms_templates')
            .insert(template)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateTemplate(id: string, updates: SmsTemplateUpdate) {
        const { data, error } = await supabase
            .from('sms_templates')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteTemplate(id: string) {
        const { error } = await supabase
            .from('sms_templates')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
