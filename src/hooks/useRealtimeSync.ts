import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized realtime invalidation so pages stay in sync across sessions/devices.
 */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = (queryKey: readonly unknown[]) => {
      queryClient.invalidateQueries({ queryKey });
    };

    const channel = supabase
      .channel('app-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        invalidate(['leads']);
        invalidate(['dashboard-stats']);
        invalidate(['leaderboard']);
        invalidate(['leads-search']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        invalidate(['appointments']);
        invalidate(['dashboard-stats']);
        invalidate(['lead-activities']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_logs' }, () => {
        invalidate(['sms-logs']);
        invalidate(['dashboard-stats']);
        invalidate(['lead-activities']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_templates' }, () => {
        invalidate(['sms-templates']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        invalidate(['notifications']);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => {
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
