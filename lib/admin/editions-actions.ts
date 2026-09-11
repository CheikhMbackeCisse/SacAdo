"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Produit } from "@/lib/supabase/types";

export type OuvrageEditionAncienne = Pick<
  Produit,
  "id" | "nom" | "auteur" | "editeur" | "edition" | "prix"
> & { anneesEcoulees: number };

const SEUIL_ANNEES = 2;

// Livres et annales (migration 0068, §3.6) : édition en vigueur vieille de
// plus de 2 ans -> à interroger auprès du fournisseur à chaque rentrée.
// `edition` est du texte libre (pas toujours un millésime propre) : on parse
// en JS plutôt que de comparer côté SQL sur une colonne texte.
export async function getOuvragesEditionAncienne(): Promise<OuvrageEditionAncienne[]> {
  await requireAdmin();
  const anneeCourante = new Date().getFullYear();

  const { data, error } = await supabaseAdmin
    .from("produits")
    .select("id, nom, auteur, editeur, edition, prix")
    .eq("edition_statut", "en_vigueur")
    .not("edition", "is", null);
  if (error || !data) return [];

  return data
    .map((p) => ({ ...p, anneesEcoulees: anneeCourante - Number(p.edition) }))
    .filter((p) => Number.isFinite(p.anneesEcoulees) && p.anneesEcoulees > SEUIL_ANNEES)
    .sort((a, b) => b.anneesEcoulees - a.anneesEcoulees);
}
