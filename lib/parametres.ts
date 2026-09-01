import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TOURS_MAX_DEFAUT } from "@/lib/negociation";

const CLE_TOURS_MAX = "negociation_tours_max";
const TOURS_MAX_MIN = 2;
const TOURS_MAX_MAX = 20;

// Limite d'allers-retours d'une négociation, réglable dans l'admin (table
// `parametres`). Repli sur la valeur par défaut si la ligne est absente ou
// invalide (migration 0017 pas encore passée, etc.).
export async function getToursMax(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("parametres")
    .select("valeur")
    .eq("cle", CLE_TOURS_MAX)
    .maybeSingle();

  const n = Number(data?.valeur);
  if (Number.isInteger(n) && n >= TOURS_MAX_MIN && n <= TOURS_MAX_MAX) return n;
  return TOURS_MAX_DEFAUT;
}

export async function setToursMax(valeur: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = Math.round(valeur);
  if (!Number.isInteger(n) || n < TOURS_MAX_MIN || n > TOURS_MAX_MAX) {
    return { ok: false, error: `La limite doit être comprise entre ${TOURS_MAX_MIN} et ${TOURS_MAX_MAX}.` };
  }
  const { error } = await supabaseAdmin
    .from("parametres")
    .upsert({ cle: CLE_TOURS_MAX, valeur: String(n), maj: new Date().toISOString() });
  if (error) return { ok: false, error: "Impossible d'enregistrer le réglage." };
  return { ok: true };
}
