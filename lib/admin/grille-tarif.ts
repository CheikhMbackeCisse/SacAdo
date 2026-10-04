import type { PalierTarif } from "@/lib/supabase/types";

// Valide/normalise une grille de tarif par palier lue en base (colonnes
// `vendeurs.grille_remise`/`grille_majoration`) : un tableau de
// {seuil: number | null, valeur: number}. Toute autre forme (objet, tableau
// mal formé…) devient `null` plutôt que de planter l'appelant — voir
// PROMPT_ADMIN_KITS_PRODUITS.md lot 3 (page /admin/fournisseurs en erreur à
// cause d'une donnée historique au mauvais format).
export function normaliserGrille(valeur: unknown): PalierTarif[] | null {
  if (!Array.isArray(valeur)) return null;
  const estPalier = (p: unknown): p is PalierTarif =>
    typeof p === "object" &&
    p !== null &&
    "valeur" in p &&
    typeof (p as { valeur: unknown }).valeur === "number" &&
    "seuil" in p &&
    ((p as { seuil: unknown }).seuil === null || typeof (p as { seuil: unknown }).seuil === "number");
  return valeur.every(estPalier) ? (valeur as PalierTarif[]) : null;
}
