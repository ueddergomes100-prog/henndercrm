"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;

    if (process.env.NODE_ENV !== "production") {
      void clearDevelopmentPwaState();
      return;
    }

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}

function registerServiceWorker() {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => registration.update())
    .catch(() => {
      // The CRM must keep working even when the browser blocks PWA registration.
    });
}

async function clearDevelopmentPwaState() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("hennder-crm-"))
        .map((cacheName) => caches.delete(cacheName)),
    );
  } catch {
    // Local development must keep working even when storage access is blocked.
  }
}
