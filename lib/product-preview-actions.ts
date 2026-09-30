"use server";

import { getProduitById, getVariantesByProduit } from "@/lib/supabase/queries";
import type { Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

// Panneau d'aperçu produit (CORRECTIONS_V16 §2.1, desktop uniquement) : un
// sous-ensemble léger de ce que sert la fiche complète, pour le panneau à
// droite (440 px) qui s'ouvre sans quitter la liste.
export type ApercuProduit = {
  produit: Produit;
  variantes: VarianteAvecAttributs[];
};

export async function chargerApercuProduit(id: number): Promise<ApercuProduit | null> {
  const produit = await getProduitById(id);
  if (!produit) return null;
  const variantes = await getVariantesByProduit(id);
  return { produit, variantes };
}
