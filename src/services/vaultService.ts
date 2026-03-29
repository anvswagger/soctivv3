import { supabase } from "@/integrations/supabase/client";

export interface VaultItem {
  id: string;
  client_id: string;
  title: string;
  content: string;
  category: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVaultItemData {
  client_id: string;
  title: string;
  content: string;
  category?: string;
  is_favorite?: boolean;
}

export type UpdateVaultItemData = Partial<Omit<VaultItem, 'id' | 'client_id' | 'created_at' | 'updated_at'>>;

export const vaultService = {
  async getVaultItems(clientId: string) {
    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .eq('client_id', clientId as any)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as unknown as VaultItem[];
  },

  async createVaultItem(vaultItem: CreateVaultItemData) {
    const { data, error } = await supabase
      .from('vault_items')
      .insert(vaultItem as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as VaultItem;
  },

  async updateVaultItem(id: string, updates: UpdateVaultItemData) {
    const { data, error } = await supabase
      .from('vault_items')
      .update(updates as any)
      .eq('id', id as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as VaultItem;
  },

  async deleteVaultItem(id: string) {
    const { error } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', id as any);

    if (error) throw error;
  }
};
