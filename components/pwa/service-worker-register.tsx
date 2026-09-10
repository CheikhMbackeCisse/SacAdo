"use client";

import { useEffect } from "react";

// Enregistrement simple. Aucun rechargement automatique : un nouveau service
// worker s'active au prochain démarrage de l'app (voir public/sw.js), donc la
// navigation reste fluide, sans retour brutal au splash en pleine session.
//
// L'espace client enregistre `/sw.js` (scope "/"). L'admin enregistre
// `/admin/sw.js` (scope "/admin/", déduit de l'emplacement) : pour les pages
// /admin, c'est cet enregistrement plus précis qui prend la main
// (TACHE_admin_pwa_meme_domaine.md §4).
export function ServiceWorkerRegister({ script = "/sw.js" }: { script?: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(script)
      .catch((error) => console.error("Échec de l'enregistrement du service worker", error));
  }, [script]);

  return null;
}
