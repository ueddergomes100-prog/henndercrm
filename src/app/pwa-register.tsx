"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;

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
