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
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('[App] Unregistering old SW:', registration.scope);
      registration.unregister();
    });
  });
}

// Disable service worker in development completely
if ('serviceWorker' in navigator && import.meta.env.PROD) {
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

            // When the new SW is activated and controlling, reload
            if (newWorker.state === 'activated') {
              console.log('[App] New SW activated - reloading for update');
              window.location.reload();
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
        console.log('[App] Received SW_UPDATED message - reloading');
        window.location.reload();
      }
    });

    // Also handle controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] Controller changed - new SW is active');
      // Small delay to ensure SW is fully ready
      setTimeout(() => window.location.reload(), 100);
    });
  });
}
