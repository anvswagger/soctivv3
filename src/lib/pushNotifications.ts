import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// Type definitions for push subscription operations
interface PushSubscriptionData {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: 'pwa' | 'web';
  user_agent?: string;
  is_active: boolean;
  last_seen_at: string;
  updated_at: string;
}

// Helper function for push_subscriptions table operations
async function upsertPushSubscription(data: PushSubscriptionData): Promise<void> {
  const insertData: TablesInsert<'push_subscriptions'> = {
    user_id: data.user_id,
    endpoint: data.endpoint,
    p256dh: data.p256dh,
    auth: data.auth,
    platform: data.platform,
    user_agent: data.user_agent,
    is_active: data.is_active,
    last_seen_at: data.last_seen_at,
    updated_at: data.updated_at,
  };

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(insertData, { onConflict: 'endpoint' });
  if (error) {
    throw new Error(error.message || 'Failed to save push subscription.');
  }
}

async function updatePushSubscription(endpoint: string, data: Partial<PushSubscriptionData>): Promise<void> {
  const updateData: TablesUpdate<'push_subscriptions'> = {
    ...data,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('push_subscriptions')
    .update(updateData)
    .eq('endpoint', endpoint);
  if (error) throw new Error(error.message || 'Failed to update push subscription.');
}

const ENV_VAPID_PUBLIC_KEY = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined)?.trim();
const DEV_PUSH_FLAG = (import.meta.env.VITE_ENABLE_PUSH_DEV as string | undefined)?.toLowerCase();
const PUSH_OPT_IN_STORAGE_KEY = 'soctiv_push_opt_in';

// Maximum number of subscription rotation attempts when RLS conflicts occur
// Prevents infinite loops if there's a persistent authorization issue
const MAX_SUBSCRIPTION_ROTATION_ATTEMPTS = 2;

function isDevPushEnabled() {
  return import.meta.env.DEV && (DEV_PUSH_FLAG === 'true' || DEV_PUSH_FLAG === '1' || DEV_PUSH_FLAG === 'yes' || DEV_PUSH_FLAG === 'on');
}

let cachedVapidPublicKey: string | null | undefined;

async function getVapidPublicKey() {
  if (cachedVapidPublicKey !== undefined) {
    if (!cachedVapidPublicKey) {
      throw new Error('Push settings are incomplete (VAPID public key is missing).');
    }
    return cachedVapidPublicKey;
  }

  if (ENV_VAPID_PUBLIC_KEY) {
    cachedVapidPublicKey = ENV_VAPID_PUBLIC_KEY;
    return cachedVapidPublicKey;
  }

  try {
    // Supabase `functions.invoke()` uses POST by default. `push-config` supports GET/POST.
    const { data, error } = await supabase.functions.invoke('push-config');
    if (error) {
      console.error('[Push] Failed to load VAPID public key (push-config):', error);
      cachedVapidPublicKey = null;
    } else {
      const key = (data as { web_push_public_key?: string } | null)?.web_push_public_key;
      cachedVapidPublicKey = typeof key === 'string' && key.trim() ? key.trim() : null;
    }
  } catch (error) {
    console.error('[Push] Failed to load VAPID public key (push-config):', error);
    cachedVapidPublicKey = null;
  }

  if (!cachedVapidPublicKey) {
    throw new Error('Push settings are incomplete. Ensure VITE_WEB_PUSH_PUBLIC_KEY is set or deploy the push-config Edge Function.');
  }

  return cachedVapidPublicKey;
}

export type PushPermissionState = NotificationPermission | 'unsupported';

export function getPushErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/no active service worker|service worker is not available/i.test(message)) {
    return 'لا يوجد خدمة نشطة في هذا المتصفح. افتح التطبيق عبر HTTPS أو حدّث الصفحة وحاول مرة أخرى.';
  }
  if (/permission|denied|not granted/i.test(message)) {
    return 'لم يتم منح إذن الإشعارات. فعّل الإذن من إعدادات المتصفح.';
  }
  if (/not supported/i.test(message)) {
    return 'إشعارات الويب غير مدعومة على هذا الجهاز أو المتصفح.';
  }
  if (/vapid|push is not configured|missing vapid|push settings/i.test(message)) {
    return 'إعدادات الإشعارات غير مكتملة. تواصل مع الدعم الفني.';
  }
  if (/subscribe|subscription failed/i.test(message)) {
    return 'فشل الاشتراك في الإشعارات. حدّث الصفحة وحاول مرة أخرى.';
  }
  if (/disabled in development/i.test(message)) {
    return 'الإشعارات معطلة في وضع التطوير.';
  }

  return 'فشل تفعيل الإشعارات. حاول مرة أخرى.';
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

interface SafariNavigator extends Navigator {
  standalone?: boolean;
}

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as SafariNavigator).standalone === true;
}

async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();

  const waitForActive = (registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> => {
    if (registration.active) return Promise.resolve(registration);

    return new Promise((resolve) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) {
        // Fallback: if no worker is installing/waiting and it's not active,
        // it might have failed or be in a weird state.
        resolve(registration);
        return;
      }

      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          resolve(registration);
        }
      });
    });
  };

  if (existing) {
    return waitForActive(existing);
  }

  // Allow opt-in push testing in development without turning on SW caching for Vite requests (sw.js skips fetch on localhost).
  if (import.meta.env.PROD || isDevPushEnabled()) {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return waitForActive(registration);
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

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  return registration.pushManager.getSubscription();
}

function setLocalPushOptIn(enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(PUSH_OPT_IN_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(PUSH_OPT_IN_STORAGE_KEY);
    }
  } catch {
    // Non-fatal (storage could be blocked).
  }
}

function getLocalPushOptIn() {
  try {
    return localStorage.getItem(PUSH_OPT_IN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export async function enablePushNotifications(userId: string) {
  if (!isPushSupported()) {
    throw new Error('Web push notifications are not supported on this device or browser.');
  }

  if (import.meta.env.DEV && !isDevPushEnabled()) {
    throw new Error('Web push notifications are disabled in development mode. Set VITE_ENABLE_PUSH_DEV=true to enable testing.');
  }

  const vapidPublicKey = await getVapidPublicKey();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error('Service Worker is not currently available.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const upsertSubscription = async (sub: PushSubscription) => {
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      throw new Error('Invalid push subscription payload.');
    }

    await upsertPushSubscription({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      platform: isStandalonePwa() ? 'pwa' : 'web',
      user_agent: undefined, // Removed for privacy
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      endpoint,
      platform: isStandalonePwa() ? 'pwa' : 'web',
    };
  };

  try {
    const saved = await upsertSubscription(subscription);
    setLocalPushOptIn(true);
    return saved;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const looksLikeRlsOrConflict = /row-level security|permission denied|violates row-level security|duplicate key/i.test(message);

    // If RLS conflict occurs, try rotating the subscription once
    // This handles cases where the same browser was previously subscribed under another user
    if (looksLikeRlsOrConflict) {
      try {
        await subscription.unsubscribe();
        const rotated = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const saved = await upsertSubscription(rotated);
        setLocalPushOptIn(true);
        return saved;
      } catch (rotateError: unknown) {
        // If rotation also fails, throw a more informative error
        // This prevents infinite retry loops
        throw new Error('Push subscription sync failed after rotation attempt: ' + String(rotateError instanceof Error ? rotateError.message : rotateError));
      }
    }

    throw error;
  }
}

export async function syncPushSubscriptionToDatabase(userId: string) {
  if (!isPushSupported()) return { synced: false as const, reason: 'unsupported' as const };

  // Keep dev clean unless explicitly enabled.
  if (import.meta.env.DEV && !isDevPushEnabled()) {
    return { synced: false as const, reason: 'dev_disabled' as const };
  }

  // Never prompt here. We only sync if permission is already granted.
  if (Notification.permission !== 'granted') {
    return { synced: false as const, reason: 'permission_not_granted' as const };
  }

  let vapidPublicKey: string;
  try {
    vapidPublicKey = await getVapidPublicKey();
  } catch (error: unknown) {
    return { synced: false as const, reason: 'missing_vapid_public_key' as const, error: String(error instanceof Error ? error.message : error) };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { synced: false as const, reason: 'no_service_worker' as const };
  }

  let subscription = await registration.pushManager.getSubscription();
  const optedIn = getLocalPushOptIn();

  // If the user opted in previously (or we have an existing subscription), keep it alive.
  if (!subscription) {
    if (!optedIn) {
      return { synced: false as const, reason: 'no_subscription' as const };
    }

    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    } catch (error: unknown) {
      return { synced: false as const, reason: 'subscribe_failed' as const, error: String(error instanceof Error ? error.message : error) };
    }
  }

  const upsert = async (sub: PushSubscription) => {
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      throw new Error('Invalid push subscription payload');
    }

    await upsertPushSubscription({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      platform: isStandalonePwa() ? 'pwa' : 'web',
      user_agent: undefined, // Removed for privacy
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return {
      endpoint,
      platform: isStandalonePwa() ? 'pwa' : 'web',
    };
  };

  try {
    const saved = await upsert(subscription);
    setLocalPushOptIn(true);
    return { synced: true as const, ...saved };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const looksLikeRlsOrConflict = /row-level security|permission denied|violates row-level security|duplicate key/i.test(message);

    // If RLS conflict occurs, try rotating the subscription once
    // This handles cases where the same browser was previously subscribed under another user
    // Rotation is attempted at most once to prevent infinite loops
    if (looksLikeRlsOrConflict) {
      try {
        await subscription.unsubscribe();
        const rotated = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const saved = await upsert(rotated);
        setLocalPushOptIn(true);
        return { synced: true as const, ...saved };
      } catch (rotateError: unknown) {
        // Return failure status instead of throwing to allow graceful degradation
        return {
          synced: false as const, reason: 'sync_failed' as const,
          error: 'Push subscription sync failed after rotation: ' + String(rotateError instanceof Error ? rotateError.message : rotateError)
        };
      }
    }

    return { synced: false as const, reason: 'sync_failed' as const, error: message };
  }
}

export async function disablePushNotifications(userId: string) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await updatePushSubscription(endpoint, { is_active: false });

  setLocalPushOptIn(false);
}
