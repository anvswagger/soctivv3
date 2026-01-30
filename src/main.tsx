import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker registration with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('[App] SW registered:', registration.scope);

      // Check for updates immediately and every 60 seconds
      registration.update();
      setInterval(() => registration.update(), 60000);

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
