"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mesurerVisite } from "@/lib/trafic/mesure-client";
import { estAppInstallee } from "@/lib/pwa/standalone";

// Une "page vue" par navigation (PROMPT_CLIENT_V2 Lot 5), montée une seule
// fois dans le layout storefront. Les paramètres utm_*/gclid ne comptent que
// pour la toute première page vue d'une session (lib/trafic/mesure.ts fige la
// source à la création) ; on les envoie malgré tout à chaque fois, le serveur
// les ignore pour une session déjà connue — plus simple que de les garder en
// mémoire côté client.
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // `window.location.search` correspond déjà au chargement courant, qu'il
    // s'agisse du tout premier rendu ou d'une navigation suivante (App Router
    // met à jour l'URL avant de re-rendre). Pas besoin de useSearchParams
    // (évite de forcer le rendu dynamique sur toutes les pages storefront).
    const params = new URLSearchParams(window.location.search);

    mesurerVisite({
      type: "page_vue",
      page: pathname,
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      gclid: params.get("gclid") ?? undefined,
      appInstallee: estAppInstallee(),
    });
  }, [pathname]);

  return null;
}
