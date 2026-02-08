import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker registration - only in production
// Development helper: Clear service workers if needed
if ('serviceWorker' in navigator && import.meta.env.DEV) {
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
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let hasReloadedForUpdate = false;
  const reloadForUpdate = (reason: string) => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    console.log(`[App] Reloading for SW update (${reason})`);
    setTimeout(() => window.location.reload(), 100);
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('[App] SW registered:', registration.scope);

      // Listen for new service worker installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[App] New SW installing...');

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[App] New SW state:', newWorker.state);

            if (newWorker.state === 'activated') {
              reloadForUpdate('worker-activated');
            }
          });
        }
      });

    }).catch((error) => {
      console.log('[App] SW registration failed:', error);
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        reloadForUpdate('sw-message');
      }
    });

    // Also handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] Controller changed - new SW is active');
      reloadForUpdate('controller-change');
    });
  });
}
