import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  queryInvalidation,
  type InvalidationDomain,
  type QueryRefetchType,
} from '@/lib/queryInvalidation';

/**
 * Centralized realtime invalidation so pages stay in sync across sessions/devices.
 *
 * Performance notes:
 * - Batch rapid realtime events to avoid refetch storms.
 * - When the tab is hidden, mark queries stale without forcing immediate refetch.
 * - Invalidate by explicit contracts, not ad-hoc keys.
 */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const pendingDomains = new Set<InvalidationDomain>();
    let flushTimer: number | null = null;

    const flushInvalidations = () => {
      const queuedDomains = Array.from(pendingDomains);
      pendingDomains.clear();
      flushTimer = null;

      const refetchType: QueryRefetchType = document.visibilityState === 'visible' ? 'active' : 'none';
      queuedDomains.forEach((domain) => {
        void queryInvalidation.invalidateDomain(queryClient, domain, refetchType);
      });
    };

    const queueInvalidate = (domain: InvalidationDomain) => {
      pendingDomains.add(domain);
      if (flushTimer) return;
      flushTimer = window.setTimeout(flushInvalidations, 120);
    };

    const channel = supabase
      .channel('app-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queueInvalidate('leads');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        queueInvalidate('appointments');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_logs' }, () => {
        queueInvalidate('sms');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        queueInvalidate('notifications');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => {
        queueInvalidate('setterStats');
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error: app-realtime-sync');
        }
      });

    return () => {
      if (flushTimer) {
        window.clearTimeout(flushTimer);
      }
      pendingDomains.clear();
      void supabase.removeChannel(channel);
    };
  }, [queryClient, enabled]);
}

