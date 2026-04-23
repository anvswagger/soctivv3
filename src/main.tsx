import React from "react";
import { createRoot } from "react-dom/client";
import { isSupabaseConfigured, supabaseConfigError } from "@/integrations/supabase/client";
import "./lib/i18n";
import "./index.css";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? import.meta.url;
const APP_VERSION_STORAGE_KEY = 'soctiv:app-version';
const APP_VERSION_RESET_IN_PROGRESS_KEY = 'soctiv:app-version-reset-in-progress';
const CHUNK_ERROR_RECOVERY_KEY = 'soctiv:chunk-error-recovery-version';
const DEV_PUSH_FLAG = (import.meta.env.VITE_ENABLE_PUSH_DEV as string | undefined)?.toLowerCase();
const DEV_PUSH_ENABLED = import.meta.env.DEV && (DEV_PUSH_FLAG === 'true' || DEV_PUSH_FLAG === '1' || DEV_PUSH_FLAG === 'yes' || DEV_PUSH_FLAG === 'on');
let chunkRecoveryInProgress = false;

type StorageKind = 'local' | 'session';

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeStorageGet(kind: StorageKind, key: string): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(kind: StorageKind, key: string, value: string): void {
  try {
    getStorage(kind)?.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

function safeStorageRemove(kind: StorageKind, key: string): void {
  try {
    getStorage(kind)?.removeItem(key);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

function safeStorageClear(kind: StorageKind): void {
  try {
    getStorage(kind)?.clear();
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error('[App] Fatal: Root element not found');
  throw new Error('Root element not found. Please check index.html.');
}

const root = createRoot(rootElement);

if (!isSupabaseConfigured) {
  root.render(
    <React.StrictMode>
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="max-w-lg rounded-lg border bg-card p-6 text-center space-y-3">
          <h1 className="text-xl font-bold text-foreground">خطأ في إعدادات التطبيق</h1>
          <p className="text-sm text-muted-foreground">
            التطبيق لا يمكنه الاتصال بقاعدة البيانات بسبب متغيرات بيئة ناقصة على الاستضافة.
          </p>
           <p className="text-xs text-muted-foreground">
             تأكد في Cloudflare Pages من القيم:
             <br />
             <code>VITE_SUPABASE_URL</code>
             <br />
             <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> أو <code>VITE_SUPABASE_ANON_KEY</code>
           </p>
          {supabaseConfigError && (
            <p className="text-xs text-destructive break-words">
              {supabaseConfigError}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            إعادة التحميل
          </button>
        </div>
      </div>
    </React.StrictMode>
  );
} else {
  void loadAndRenderApp();
}

// Early survival check for React modules to detect corruption.
// Use a function declaration so it is hoisted before the initial bootstrap call.
function isReactCorrupted() {
  try {
    return typeof React === 'undefined' || typeof React.forwardRef !== 'function';
  } catch {
    return true;
  }
}

function renderAppBootstrapError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? 'Unknown bootstrap error');
  const isCorrupted = isReactCorrupted();

  root.render(
    <React.StrictMode>
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="max-w-lg rounded-lg border bg-card p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">حدث خطأ في تشغيل التطبيق</h1>
          <p className="text-sm text-muted-foreground">
            {isCorrupted
              ? "تم اكتشاف ملفات تالفة في ذاكرة المتصفح. يرجى استخدام زر 'تنظيف شامل' بالأسفل لإصلاح المشكلة."
              : "فشل التطبيق في التحميل. يرجى محاولة تحديث الصفحة، وإذا استمرت المشكلة استخدم خيار التنظيف الشامل."}
          </p>
          <div className="bg-muted p-3 rounded text-xs font-mono text-left overflow-auto max-h-32">
            {message}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              إعادة تحميل الصفحة
            </button>
            <button
              onClick={async () => {
                if (!confirm('سيؤدي هذا إلى مسح كافة ملفات التخزين المؤقت وتسجيلات الدخول. هل تريد الاستمرار؟')) return;

                safeStorageClear('local');
                safeStorageClear('session');

                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(r => r.unregister()));
                }

                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(key => caches.delete(key)));
                }

                if ('indexedDB' in window && window.indexedDB.databases) {
                  const dbs = await window.indexedDB.databases();
                  dbs.forEach(db => db.name && window.indexedDB.deleteDatabase(db.name));
                }

                const url = new URL(window.location.href);
                url.searchParams.set('force_clean', '1');
                url.searchParams.set('v', Date.now().toString());
                window.location.replace(url.toString());
              }}
              className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm"
            >
              تنظيف شامل وإعادة تشغيل (Deep Clean)
            </button>
          </div>
        </div>
      </div>
    </React.StrictMode>
  );
}

async function loadAndRenderApp() {
  try {
    if (isReactCorrupted()) {
      throw new Error("React module is corrupted or undefined (missing forwardRef)");
    }

    const appModule = await import("./App.tsx");
    const App = appModule.default;

    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[App] Failed to load App bootstrap module:', error);
    if (isRecoverableBootstrapError(error)) {
      await recoverFromChunkLoadError(error);
      return;
    }
    renderAppBootstrapError(error);
  }
}

async function resetRuntimeCachesForVersion(version: string) {
  const storedVersion = safeStorageGet('local', APP_VERSION_STORAGE_KEY);
  if (storedVersion === version) {
    return false;
  }

  // Guard against accidental reload loops.
  if (safeStorageGet('session', APP_VERSION_RESET_IN_PROGRESS_KEY) === version) {
    safeStorageSet('local', APP_VERSION_STORAGE_KEY, version);
    return false;
  }

  console.warn(`[App] Version mismatch (local: ${storedVersion}, app: ${version}). Purging caches...`);

  safeStorageSet('session', APP_VERSION_RESET_IN_PROGRESS_KEY, version);
  safeStorageSet('local', APP_VERSION_STORAGE_KEY, version);

  // Clear development-related artifacts in storage that might cause hydration/Ref errors
  const storageKeysToClear = [
    'vite-hmr-reloads',
    'lovable-tagger-state',
    'sb-refresh-token'
  ];

  storageKeysToClear.forEach(key => {
    safeStorageRemove('local', key);
    safeStorageRemove('session', key);
  });

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }

  const reloadUrl = new URL(window.location.href);
  reloadUrl.searchParams.set('v', version);
  reloadUrl.searchParams.set('force_update', '1');
  window.location.replace(reloadUrl.toString());
  return true;
}

function normalizeChunkErrorMessage(reason: unknown): string {
  if (typeof reason === 'string') return reason.toLowerCase();
  if (reason instanceof Error) return `${reason.name} ${reason.message}`.toLowerCase();
  return String(reason ?? '').toLowerCase();
}

function isChunkLoadError(reason: unknown): boolean {
  const message = normalizeChunkErrorMessage(reason);
  return (
    message.includes('chunkloaderror')
    || message.includes('loading chunk')
    || message.includes('failed to fetch dynamically imported module')
    || message.includes('importing a module script failed')
  );
}

function isRecoverableBootstrapError(reason: unknown): boolean {
  const message = normalizeChunkErrorMessage(reason);
  return (
    isChunkLoadError(reason)
    || message.includes("cannot read properties of undefined (reading 'forwardref')")
    || message.includes("cannot read properties of undefined (reading 'createcontext')")
    || message.includes("cannot read properties of undefined (reading 'usecontext')")
    || message.includes("cannot access")
    && message.includes("before initialization")
  );
}

async function recoverFromChunkLoadError(reason: unknown) {
  if (chunkRecoveryInProgress) return;
  chunkRecoveryInProgress = true;
  let reloadTriggered = false;

  try {
    try {
      const alreadyRecovered = safeStorageGet('session', CHUNK_ERROR_RECOVERY_KEY);
      if (alreadyRecovered === APP_VERSION) {
        renderAppBootstrapError(reason);
        return;
      }
      safeStorageSet('session', CHUNK_ERROR_RECOVERY_KEY, APP_VERSION);
    } catch {
      // Ignore sessionStorage failures and continue with best effort recovery.
    }

    console.warn('[App] Detected recoverable runtime load failure, attempting recovery:', reason);

    try {
      const resetTriggered = await resetRuntimeCachesForVersion(APP_VERSION);
      if (resetTriggered) {
        reloadTriggered = true;
        return;
      }
    } catch (error) {
      console.error('[App] Chunk recovery cache reset failed:', error);
    }

    const fallbackReloadUrl = new URL(window.location.href);
    fallbackReloadUrl.searchParams.set('chunk_recover', Date.now().toString());
    reloadTriggered = true;
    window.location.replace(fallbackReloadUrl.toString());
  } finally {
    if (!reloadTriggered) {
      chunkRecoveryInProgress = false;
    }
  }
}

window.addEventListener('unhandledrejection', (event) => {
  if (!isRecoverableBootstrapError(event.reason)) return;
  event.preventDefault();
  void recoverFromChunkLoadError(event.reason);
});

window.addEventListener('error', (event) => {
  if (isRecoverableBootstrapError(event.error || event.message)) {
    void recoverFromChunkLoadError(event.error || event.message);
    return;
  }

  // Catch script loading errors where browser doesn't attach a rich Error object.
  const target = event.target;
  if (target instanceof HTMLScriptElement && target.src.includes('/assets/')) {
    void recoverFromChunkLoadError(`script-load-failed:${target.src}`);
  }
}, true);

if ('serviceWorker' in navigator && (import.meta.env.PROD || DEV_PUSH_ENABLED)) {
  void resetRuntimeCachesForVersion(APP_VERSION).catch((error) => {
    console.error('[App] Failed to reset caches on version change:', error);
  });
}

// Service Worker registration - only in production by default.
// Development helper: keep dev clean unless push testing is explicitly enabled.
if ('serviceWorker' in navigator && import.meta.env.DEV && !DEV_PUSH_ENABLED) {
  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    await Promise.all(
      registrations.map(async (registration) => {
        await registration.unregister();
      })
    );

    // Dev safety: clear old runtime caches to avoid stale chunk/module responses.
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  });
}

// Disable service worker in development completely
if ('serviceWorker' in navigator && (import.meta.env.PROD || DEV_PUSH_ENABLED)) {
  let hasReloadedForUpdate = false;
  let hasSeenController = !!navigator.serviceWorker.controller;
  let reloadTimeout: ReturnType<typeof setTimeout> | null = null;

  const reloadForUpdate = (reason: string) => {
    if (hasReloadedForUpdate) return;

    // Check if we've reloaded very recently (within 5 seconds) to prevent infinite loops
    const lastReload = safeStorageGet('session', 'sw_last_reload');
    const now = Date.now();
    if (lastReload && now - parseInt(lastReload, 10) < 5000) {
      console.warn('[App] Skipping SW reload to prevent loop:', reason);
      return;
    }

    hasReloadedForUpdate = true;
    safeStorageSet('session', 'sw_last_reload', now.toString());

    if (import.meta.env.DEV) console.log(`[App] Reloading for SW update (${reason})`);

    // Brief delay to allow SW to finish activation/message processing
    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (import.meta.env.DEV) console.log('[App] SW registered:', registration.scope);

      // Listen for new service worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (import.meta.env.DEV) console.log('[App] New SW installing...');

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (import.meta.env.DEV) console.log('[App] New SW state:', newWorker.state);

            // Only reload if the worker actually became activated
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              reloadForUpdate('worker-activated');
            }
          });
        }
      });

    }).catch((error) => {
      console.error('[App] SW registration failed:', error);
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        reloadForUpdate('sw-message');
      }
    });

    // Also handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (import.meta.env.DEV) console.log('[App] Controller changed - new SW is active');
      const hasControllerNow = !!navigator.serviceWorker.controller;

      // Skip the first controller assignment after initial registration.
      if (!hasSeenController && hasControllerNow) {
        hasSeenController = true;
        return;
      }

      hasSeenController = hasControllerNow;
      reloadForUpdate('controller-change');
    });
  });
}
