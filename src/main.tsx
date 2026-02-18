import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? import.meta.url;
const APP_VERSION_STORAGE_KEY = 'soctiv:app-version';
const APP_VERSION_RESET_IN_PROGRESS_KEY = 'soctiv:app-version-reset-in-progress';
const DEV_PUSH_FLAG = (import.meta.env.VITE_ENABLE_PUSH_DEV as string | undefined)?.toLowerCase();
const DEV_PUSH_ENABLED = import.meta.env.DEV && (DEV_PUSH_FLAG === 'true' || DEV_PUSH_FLAG === '1' || DEV_PUSH_FLAG === 'yes' || DEV_PUSH_FLAG === 'on');

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error('[App] Fatal: Root element not found');
  throw new Error('Root element not found. Please check index.html.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

async function resetRuntimeCachesForVersion(version: string) {
  const storedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);
  if (storedVersion === version) {
    return false;
  }

  // Guard against accidental reload loops.
  if (sessionStorage.getItem(APP_VERSION_RESET_IN_PROGRESS_KEY) === version) {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, version);
    return false;
  }

  sessionStorage.setItem(APP_VERSION_RESET_IN_PROGRESS_KEY, version);
  localStorage.setItem(APP_VERSION_STORAGE_KEY, version);

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
  window.location.replace(reloadUrl.toString());
  return true;
}

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
        console.log('[App] Unregistering old SW:', registration.scope);
        await registration.unregister();
      })
    );

    // Dev safety: clear old runtime caches to avoid stale chunk/module responses.
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      if (cacheKeys.length) {
        console.log('[App] Cleared dev caches:', cacheKeys);
      }
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
    const lastReload = sessionStorage.getItem('sw_last_reload');
    const now = Date.now();
    if (lastReload && now - parseInt(lastReload) < 5000) {
      console.warn('[App] Skipping SW reload to prevent loop:', reason);
      return;
    }

    hasReloadedForUpdate = true;
    sessionStorage.setItem('sw_last_reload', now.toString());
    
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
