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

const CLE_SEUIL_LIVRAISON_GRATUITE = "seuil_livraison_gratuite";
const SEUIL_LIVRAISON_GRATUITE_DEFAUT = 75000;

// Sous-total (FCFA) à partir duquel la livraison est offerte, réglable dans
// l'admin — IMPLEMENTATION_TARIFS_LIVRAISON.md §5.
export async function getSeuilLivraisonGratuite(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("parametres")
    .select("valeur")
    .eq("cle", CLE_SEUIL_LIVRAISON_GRATUITE)
    .maybeSingle();

  const n = Number(data?.valeur);
  return Number.isFinite(n) && n >= 0 ? n : SEUIL_LIVRAISON_GRATUITE_DEFAUT;
}

export async function setSeuilLivraisonGratuite(
  valeur: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = Math.round(valeur);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Le seuil doit être un nombre positif." };
  const { error } = await supabaseAdmin
    .from("parametres")
    .upsert({ cle: CLE_SEUIL_LIVRAISON_GRATUITE, valeur: String(n), maj: new Date().toISOString() });
  if (error) return { ok: false, error: "Impossible d'enregistrer le réglage." };
  return { ok: true };
}

const CLE_WAVE_NOM_MARCHAND = "wave_nom_marchand";
const WAVE_NOM_MARCHAND_DEFAUT = "UniShop Sénégal";

// Nom marchand tel que Wave l'affiche réellement à l'écran de paiement (champ
// business_name de la session Wave). Le paramètre override_business_name a été
// retiré de l'API Wave en 2024 : on ne peut plus l'imposer depuis le code,
// seulement afficher ce que Wave a renvoyé pour éviter que le client hésite en
// voyant un nom différent de la marque SacAdo (checkout, mention sous "Payer
// avec Wave"). Repli si aucune session n'a encore été créée.
export async function getNomMarchandWave(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("parametres")
    .select("valeur")
    .eq("cle", CLE_WAVE_NOM_MARCHAND)
    .maybeSingle();
  const nom = data?.valeur?.trim();
  return nom || WAVE_NOM_MARCHAND_DEFAUT;
}

// Rafraîchi à chaque session Wave créée avec succès (lib/wave/client.ts) : si
// Wave change ce nom un jour, l'affichage se met à jour tout seul. Best-effort,
// ne doit jamais faire échouer une création de session.
export async function enregistrerNomMarchandWave(nom: string): Promise<void> {
  const propre = nom.trim();
  if (!propre) return;
  const { error } = await supabaseAdmin
    .from("parametres")
    .upsert({ cle: CLE_WAVE_NOM_MARCHAND, valeur: propre, maj: new Date().toISOString() });
  if (error) console.error("Wave: échec enregistrement du nom marchand", error);
}
