import type { Commission } from "@/lib/supabase/types";

// Repli si aucune ligne globale n'existe en base (ne devrait pas arriver : la
// migration 0014 seed une ligne à 10 %).
export const TAUX_COMMISSION_DEFAUT = 10;

// Taux applicable à un produit, du plus précis au plus large :
// sous-catégorie > catégorie > global > repli.
export function tauxCommission(
  commissions: Commission[],
  categorieId: number | null,
  sousCategorieId: number | null,
): number {
  if (sousCategorieId != null) {
    const parSousCat = commissions.find((c) => c.sous_categorie_id === sousCategorieId);
    if (parSousCat) return parSousCat.taux;
  }
  if (categorieId != null) {
    const parCat = commissions.find(
      (c) => c.categorie_id === categorieId && c.sous_categorie_id == null,
    );
    if (parCat) return parCat.taux;
  }
  const globale = commissions.find(
    (c) => c.categorie_id == null && c.sous_categorie_id == null,
  );
  return globale?.taux ?? TAUX_COMMISSION_DEFAUT;
}

export type CalculCommission = {
  taux: number;
  // Part prélevée par SacAdo, en FCFA (arrondie).
  commission: number;
  // Ce que le vendeur reçoit : prix - commission.
  net: number;
};

export function calculerCommission(
  prix: number,
  commissions: Commission[],
  categorieId: number | null,
  sousCategorieId: number | null,
): CalculCommission {
  const taux = tauxCommission(commissions, categorieId, sousCategorieId);
  const commission = Math.round((prix * taux) / 100);
  return { taux, commission, net: prix - commission };
}
