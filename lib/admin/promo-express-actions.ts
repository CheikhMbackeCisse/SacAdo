"use server";

import { requireAdmin } from "./guard";
import { getConfigPromoExpress, setConfigPromoExpress, type ConfigPromoExpress } from "@/lib/promo-express";
import type { ActionResult } from "./produits-actions";

export async function getConfigPromoExpressAdmin(): Promise<ConfigPromoExpress> {
  await requireAdmin();
  return getConfigPromoExpress();
}

export async function enregistrerConfigPromoExpress(config: ConfigPromoExpress): Promise<ActionResult> {
  await requireAdmin();
  return setConfigPromoExpress(config);
}
