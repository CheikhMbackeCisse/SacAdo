"use server";

import { getConfigPromoExpress, promoExpressActiveMaintenant } from "@/lib/promo-express";
import { prochaineDatePromo } from "@/lib/promo-express-regles";

// Chargé côté client après l'affichage (comme le flux "À découvrir",
// components/home/feed.tsx) : l'accueil reste servi depuis le cache ISR, la
// promo est un état qui change dans la journée, jamais figé au cache.
export async function getPromoExpressBandeau(): Promise<{ actif: boolean; heureLimite: string }> {
  return promoExpressActiveMaintenant();
}

export type PromoExpressMoi = {
  actif: boolean;
  heureLimite: string;
  prochaineDate: string | null;
};

// Page /moi/promos (Lot 5a) : la promo en cours, ou la prochaine programmée.
export async function getPromoExpressMoi(): Promise<PromoExpressMoi> {
  const config = await getConfigPromoExpress();
  const { actif, heureLimite } = await promoExpressActiveMaintenant();
  return { actif, heureLimite, prochaineDate: actif ? null : prochaineDatePromo(config) };
}
