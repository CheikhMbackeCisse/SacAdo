import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CONFIG_PROMO_EXPRESS_DEFAUT,
  estJourPromoActif,
  validerConfigPromoExpress,
  type ConfigPromoExpress,
} from "@/lib/promo-express-regles";

export type { ConfigPromoExpress };

const CLE_PROMO_EXPRESS = "promo_express";

export async function getConfigPromoExpress(): Promise<ConfigPromoExpress> {
  const { data } = await supabaseAdmin.from("parametres").select("valeur").eq("cle", CLE_PROMO_EXPRESS).maybeSingle();
  if (!data?.valeur) return CONFIG_PROMO_EXPRESS_DEFAUT;
  try {
    return validerConfigPromoExpress(JSON.parse(data.valeur)) ?? CONFIG_PROMO_EXPRESS_DEFAUT;
  } catch {
    return CONFIG_PROMO_EXPRESS_DEFAUT;
  }
}

export async function setConfigPromoExpress(
  config: ConfigPromoExpress,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const propre = validerConfigPromoExpress(config);
  if (!propre) return { ok: false, error: "Réglage invalide." };
  const { error } = await supabaseAdmin
    .from("parametres")
    .upsert({ cle: CLE_PROMO_EXPRESS, valeur: JSON.stringify(propre), maj: new Date().toISOString() });
  if (error) return { ok: false, error: "Impossible d'enregistrer le réglage." };
  return { ok: true };
}

export async function promoExpressActiveMaintenant(): Promise<{ actif: boolean; heureLimite: string }> {
  const config = await getConfigPromoExpress();
  return { actif: estJourPromoActif(config), heureLimite: config.heureLimite };
}
