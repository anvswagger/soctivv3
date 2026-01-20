import { supabase } from '@/integrations/supabase/client';

export interface MediaItem {
  id: string;
  client_id: string;
  file_id: string;
  file_url: string;
  thumbnail_url: string | null;
  file_name: string;
  file_type: string;
  file_size: number | null;
  source: string;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMediaInput {
  client_id: string;
  file_id: string;
  file_url: string;
  thumbnail_url?: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  source: 'onboarding' | 'library';
  title?: string;
  description?: string;
}

export async function getClientMedia(clientId?: string): Promise<MediaItem[]> {
  let query = supabase
    .from('client_media')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching media:', error);
    throw error;
  }

  return data || [];
}

export async function createMedia(input: CreateMediaInput): Promise<MediaItem> {
  const { data, error } = await supabase
    .from('client_media')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating media:', error);
    throw error;
  }

  return data;
}

export async function updateMedia(id: string, updates: Partial<CreateMediaInput>): Promise<MediaItem> {
  const { data, error } = await supabase
    .from('client_media')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating media:', error);
    throw error;
  }

  return data;
}

export async function deleteMedia(id: string): Promise<void> {
  const { error } = await supabase
    .from('client_media')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
}

export async function getMyClientId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching client ID:', error);
    return null;
  }

  return data?.id || null;
}
