"use client";

import { useEffect } from "react";

// Enregistrement simple. Aucun rechargement automatique : un nouveau service
// worker s'active au prochain démarrage de l'app (voir public/sw.js), donc la
// navigation reste fluide, sans retour brutal au splash en pleine session.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("Échec de l'enregistrement du service worker", error));
  }, []);

  return null;
}
