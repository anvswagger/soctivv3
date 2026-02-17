import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';

export function AnalyticsTracker() {
  const location = useLocation();
  const { user, client } = useAuth();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const path = `${location.pathname}${location.search}${location.hash}`;
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    void analyticsService.trackEvent({
      userId: user.id,
      clientId: client?.id ?? null,
      eventType: 'page_view',
      eventName: location.pathname,
      metadata: {
        path,
        referrer: document.referrer || null,
        title: document.title || null,
      },
    });
  }, [location, user, client?.id]);

  return null;
}
