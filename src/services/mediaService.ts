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

export interface MediaWithClient extends MediaItem {
  clients: {
    id: string;
    company_name: string;
  } | null;
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
    query = query.eq('client_id', clientId as any);
  }

  const { data, error } = await query as { data: any[] | null, error: any };

  if (error) {
    console.error('Error fetching media:', error);
    throw error;
  }

  return (data || []) as MediaItem[];
}

export async function createMedia(input: CreateMediaInput): Promise<MediaItem> {
  const { data, error } = await supabase
    .from('client_media')
    .insert(input as any)
    .select()
    .single() as { data: any, error: any };

  if (error) {
    console.error('Error creating media:', error);
    throw error;
  }

  return data as unknown as MediaItem;
}

export async function updateMedia(id: string, updates: Partial<CreateMediaInput>): Promise<MediaItem> {
  const { data, error } = await supabase
    .from('client_media')
    .update(updates as any)
    .eq('id', id as any)
    .select()
    .single() as { data: any, error: any };

  if (error) {
    console.error('Error updating media:', error);
    throw error;
  }

  return data as unknown as MediaItem;
}

export async function deleteMedia(id: string): Promise<void> {
  const { error } = await supabase
    .from('client_media')
    .delete()
    .eq('id', id as any);

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
    .eq('user_id', user.id as any)
    .single() as { data: any, error: any };

  if (error) {
    console.error('Error fetching client ID:', error);
    return null;
  }

  return data?.id || null;
}

// Admin functions
export async function getAllMedia(): Promise<MediaWithClient[]> {
  const { data, error } = await supabase
    .from('client_media')
    .select(`
      *,
      clients:client_id (
        id,
        company_name
      )
    `)
    .order('created_at', { ascending: false }) as { data: any[] | null, error: any };

  if (error) {
    console.error('Error fetching all media:', error);
    throw error;
  }

  return (data || []) as MediaWithClient[];
}

export async function getAllClients(): Promise<{ id: string; company_name: string }[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name')
    .order('company_name') as { data: any[] | null, error: any };

  if (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }

  return data || [];
}

export async function getMediaStats(): Promise<{
  totalVideos: number;
  totalClients: number;
  onboardingVideos: number;
  libraryVideos: number;
}> {
  const { data, error } = await supabase
    .from('client_media')
    .select('id, client_id, source') as { data: any[] | null, error: any };

  if (error) {
    console.error('Error fetching media stats:', error);
    throw error;
  }

  const uniqueClients = new Set(data?.map(m => m.client_id) || []);

  return {
    totalVideos: data?.length || 0,
    totalClients: uniqueClients.size,
    onboardingVideos: data?.filter(m => m.source === 'onboarding').length || 0,
    libraryVideos: data?.filter(m => m.source === 'library').length || 0,
  };
}
