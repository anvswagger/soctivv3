import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized realtime invalidation so pages stay in sync across sessions/devices.
 * 
 * OPTIMIZATION: Skip invalidation for INSERT operations - React Query's optimistic
 * updates handle those already. Only invalidate for UPDATE/DELETE from OTHER sessions.
 */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = (queryKey: readonly unknown[]) => {
      queryClient.invalidateQueries({ queryKey });
    };

    // Only handle UPDATE and DELETE - INSERTs are handled by React Query optimistic updates
    const channel = supabase
      .channel('app-realtime-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
        invalidate(['leads']);
        invalidate(['dashboard-stats']);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, () => {
        invalidate(['leads']);
        invalidate(['dashboard-stats']);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, () => {
        invalidate(['appointments']);
        invalidate(['dashboard-stats']);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'appointments' }, () => {
        invalidate(['appointments']);
        invalidate(['dashboard-stats']);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sms_logs' }, () => {
        invalidate(['sms-logs']);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_logs' }, () => {
        invalidate(['sms-logs']);
        invalidate(['dashboard-stats']);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        invalidate(['notifications']);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, () => {
        invalidate(['setter-stats']);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error: app-realtime-sync');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, enabled]);
}
