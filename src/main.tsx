import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

const DEV_PUSH_FLAG = (import.meta.env.VITE_ENABLE_PUSH_DEV as string | undefined)?.toLowerCase();
const DEV_PUSH_ENABLED = import.meta.env.DEV && (DEV_PUSH_FLAG === 'true' || DEV_PUSH_FLAG === '1' || DEV_PUSH_FLAG === 'yes' || DEV_PUSH_FLAG === 'on');

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
  const reloadForUpdate = (reason: string) => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    if (import.meta.env.DEV) console.log(`[App] Reloading for SW update (${reason})`);
    setTimeout(() => window.location.reload(), 100);
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

            if (newWorker.state === 'activated') {
              reloadForUpdate('worker-activated');
            }
          });
        }
      });

    }).catch((error) => {
      console.error('[App] SW registration failed:', error);
      // Optionally send to error tracking service in production
      if (import.meta.env.PROD) {
        // Could send to Sentry, LogRocket, etc.
      }
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
      reloadForUpdate('controller-change');
    });
  });
}
