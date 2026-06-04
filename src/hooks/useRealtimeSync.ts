import { useEffect, useRef, useCallback } from 'react';
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
 * - On tab regain focus, refetch active queries AND reconnect the channel if needed.
 * - Invalidate by explicit contracts, not ad-hoc keys.
 */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingDomains = useRef(new Set<InvalidationDomain>());
  const flushTimer = useRef<number | null>(null);

  const flushInvalidations = useCallback(() => {
    const queuedDomains = Array.from(pendingDomains.current);
    pendingDomains.current.clear();
    flushTimer.current = null;

    const refetchType: QueryRefetchType = document.visibilityState === 'visible' ? 'active' : 'none';
    queuedDomains.forEach((domain) => {
      void queryInvalidation.invalidateDomain(queryClient, domain, refetchType);
    });
  }, [queryClient]);

  const queueInvalidate = useCallback((domain: InvalidationDomain) => {
    pendingDomains.current.add(domain);
    if (flushTimer.current) return;
    flushTimer.current = window.setTimeout(flushInvalidations, 120);
  }, [flushInvalidations]);

  const createChannel = useCallback(() => {
    return supabase
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
  }, [queueInvalidate]);

  useEffect(() => {
    if (!enabled) return;

    channelRef.current = createChannel();

    // When the tab regains focus:
    // 1. Refetch all active (stale) queries so fresh data appears.
    // 2. If the realtime channel dropped, reconnect it.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      // Refetch any stale active queries (leads, dashboard, notifications, etc.)
      void queryClient.refetchQueries({ type: 'active', stale: true });

      // Reconnect realtime channel if it dropped while tab was hidden
      const channel = channelRef.current;
      if (channel) {
        const state = (channel as any).state as string | undefined;
        // Supabase channels track their state; 'closed' or 'errored' means we need to re-subscribe
        if (state === 'closed' || state === 'errored' || !state) {
          console.log('[RealtimeSync] Channel dropped, reconnecting...');
          try {
            void supabase.removeChannel(channel);
          } catch {
            // Ignore cleanup errors
          }
          channelRef.current = createChannel();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (flushTimer.current) {
        window.clearTimeout(flushTimer.current);
      }
      pendingDomains.current.clear();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, enabled, createChannel]);
}