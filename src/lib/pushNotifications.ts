import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;

export type PushPermissionState = NotificationPermission | 'unsupported';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  if (import.meta.env.PROD) {
    return navigator.serviceWorker.register('/sw.js');
  }

  return null;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getPushPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;

  return registration.pushManager.getSubscription();
}

export async function enablePushNotifications(userId: string) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device/browser');
  }

  if (import.meta.env.DEV) {
    throw new Error('Push notifications are disabled in development mode');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VITE_WEB_PUSH_PUBLIC_KEY is missing');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error('Service worker is not available');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription payload');
  }

  const { error } = await db
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      platform: isStandalonePwa() ? 'pwa' : 'web',
      user_agent: navigator.userAgent,
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });

  if (error) {
    throw new Error(error.message || 'Failed to save push subscription');
  }

  return {
    endpoint,
    platform: isStandalonePwa() ? 'pwa' : 'web',
  };
}

export async function disablePushNotifications(userId: string) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await db
    .from('push_subscriptions')
    .update({
      is_active: false,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
}
