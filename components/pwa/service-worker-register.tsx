"use client";

import { useEffect } from "react";

// Enregistrement simple. Aucun rechargement automatique : un nouveau service
// worker s'active au prochain démarrage de l'app (voir public/sw.js), donc la
// navigation reste fluide, sans retour brutal au splash en pleine session.
//
// L'espace client enregistre `/sw.js` (scope "/"). L'admin enregistre
// `/admin/sw.js` avec une portée EXPLICITE (`scope`) :
//   - "/admin/" (déduite par défaut) quand l'admin reste servi en place sous
//     /admin/* (Preview Vercel, localhost) — pour ces pages, cet
//     enregistrement plus précis prend la main sur le SW racine du client.
//   - "/" quand l'admin tourne sur son propre sous-domaine admin.sacado.sn
//     (TACHE_admin_sous_domaine.md Phase 3) : là, l'admin EST toute
//     l'origine, donc le SW doit contrôler toutes ses pages. Une portée plus
//     large que le dossier du script nécessite l'en-tête
//     `Service-Worker-Allowed` (voir next.config.ts).
export function ServiceWorkerRegister({ script = "/sw.js", scope }: { script?: string; scope?: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(script, scope ? { scope } : undefined)
      .catch((error) => console.error("Échec de l'enregistrement du service worker", error));
  }, [script, scope]);

  return null;
}
