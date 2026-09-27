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
// l'admin — IMPLEMENTATION_TARIFS_LIVRAISON.md §5. `null` = désactivée
// (valeur vide en base, CORRECTIONS_V11 lot 1) : plus de livraison gratuite,
// quel que soit le sous-total.
export async function getSeuilLivraisonGratuite(): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("parametres")
    .select("valeur")
    .eq("cle", CLE_SEUIL_LIVRAISON_GRATUITE)
    .maybeSingle();
  if (!data) return SEUIL_LIVRAISON_GRATUITE_DEFAUT;

  const brut = data.valeur?.trim() ?? "";
  if (brut === "") return null;
  const n = Number(brut);
  return Number.isFinite(n) && n >= 0 ? n : SEUIL_LIVRAISON_GRATUITE_DEFAUT;
}

export async function setSeuilLivraisonGratuite(
  valeur: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let colonneValeur: string;
  if (valeur === null) {
    colonneValeur = "";
  } else {
    const n = Math.round(valeur);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Le seuil doit être un nombre positif." };
    colonneValeur = String(n);
  }
  const { error } = await supabaseAdmin
    .from("parametres")
    .upsert({ cle: CLE_SEUIL_LIVRAISON_GRATUITE, valeur: colonneValeur, maj: new Date().toISOString() });
  if (error) return { ok: false, error: "Impossible d'enregistrer le réglage." };
  return { ok: true };
}

const CLE_HEURE_LIMITE_SAMEDI = "heure_limite_samedi";

// "HH:MM" ou null (aucune heure limite -> toute commande du samedi est
// livrée le dimanche). maj-accueil §7.
export async function getHeureLimiteSamedi(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("parametres")
    .select("valeur")
    .eq("cle", CLE_HEURE_LIMITE_SAMEDI)
    .maybeSingle();
  const v = data?.valeur?.trim();
  return v && /^\d{1,2}:\d{2}$/.test(v) ? v : null;
}

export async function setHeureLimiteSamedi(
  valeur: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = valeur?.trim() || "";
  if (v && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) {
    return { ok: false, error: "Heure invalide (format HH:MM)." };
  }
  const { error } = await supabaseAdmin
    .from("parametres")
    .upsert({ cle: CLE_HEURE_LIMITE_SAMEDI, valeur: v, maj: new Date().toISOString() });
  if (error) return { ok: false, error: "Impossible d'enregistrer le réglage." };
  return { ok: true };
}

// Jours fériés / fermés (Magal, Tabaski...) : la livraison datée saute à la
// prochaine date ouverte (samedi ou dimanche). maj-accueil §7.
export async function getDatesFermees(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("dates_fermees").select("date").order("date");
  return (data ?? []).map((d) => d.date as string);
}

export async function ajouterDateFermee(
  date: string,
  motif: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Date invalide." };
  const { error } = await supabaseAdmin
    .from("dates_fermees")
    .upsert({ date, motif: motif?.trim() || null });
  if (error) return { ok: false, error: "Impossible d'enregistrer cette date." };
  return { ok: true };
}

export async function retirerDateFermee(date: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin.from("dates_fermees").delete().eq("date", date);
  if (error) return { ok: false, error: "Impossible de retirer cette date." };
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
