import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { analyticsService, facebookPixel } from '@/services/analyticsService';
import { onCLS, onINP, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';

function sendWebVitalMetric(metric: Metric) {
  // Only send in production
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms`);
    return;
  }

  void analyticsService.trackEvent({
    userId: null,
    clientId: null,
    eventType: 'web_vital',
    eventName: metric.name,
    metadata: {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      entries: metric.entries?.length || 0,
    },
  });
}

export function AnalyticsTracker() {
  const location = useLocation();
  const { user, client } = useAuth();
  const lastPathRef = useRef<string | null>(null);
  const webVitalsInitialized = useRef(false);

  useEffect(() => {
    // Initialize web vitals once
    if (!webVitalsInitialized.current) {
      webVitalsInitialized.current = true;
      
      // Track all Core Web Vitals
      onCLS(sendWebVitalMetric);
      onINP(sendWebVitalMetric); // Replacement for FID in modern web-vitals
      onLCP(sendWebVitalMetric);
      onFCP(sendWebVitalMetric);
      onTTFB(sendWebVitalMetric);
    }

    const path = `${location.pathname}${location.search}${location.hash}`;
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    // Always track page view in Facebook Pixel for SPA routes
    // This is crucial for tracking anonymous visitors on the landing page
    facebookPixel.track('PageView');

    if (!user) return;

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
