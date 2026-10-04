"use client";

// Envoi d'un signal de fréquentation vers /api/trafic (PROMPT_CLIENT_V2
// Lot 5). Même principe que lib/mesure-client.ts : `sendBeacon` en priorité
// (part même si la page se ferme), best-effort, aucune erreur remontée.

export type PayloadVisite = {
  type: "page_vue" | "produit_vu" | "ajout_panier" | "retrait_panier" | "debut_commande" | "recherche" | "page_404";
  page?: string;
  produitId?: number;
  quantite?: number;
  prixUnitaire?: number;
  recherche?: string;
  rechercheSansResultat?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  gclid?: string;
  appInstallee?: boolean;
};

export function mesurerVisite(payload: PayloadVisite): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/trafic", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/trafic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // mesure best-effort
  }
}
