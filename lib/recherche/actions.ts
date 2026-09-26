"use server";

// Chargement continu des résultats de recherche (maj-accueil §6).
import { rechercherProduits, type ProduitTrouve } from "@/lib/supabase/queries";

export async function chargerRecherchePage(query: string, limite: number): Promise<ProduitTrouve[]> {
  return rechercherProduits(query, { limite });
}
