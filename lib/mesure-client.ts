"use client";

// Envoi d'un signal de navigation vers /api/mesure. `sendBeacon` en priorité :
// il part même si la page se ferme juste après (clic sur un lien). Best-effort,
// aucune gestion d'erreur remontée à l'appelant. Le cookie `sacado_sid`
// (httpOnly) est joint automatiquement (même origine).

type PayloadMesure = {
  type: "vue_produit" | "vue_categorie" | "recherche" | "ajout_panier";
  produitId?: number;
  categorieId?: number;
  sousCategorieId?: number;
  recherche?: string;
};

export function mesurer(payload: PayloadMesure): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/mesure", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/mesure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // mesure best-effort
  }
}
