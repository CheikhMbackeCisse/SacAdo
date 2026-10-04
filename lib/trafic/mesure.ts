import "server-only";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { determinerAppareil, determinerNavigateur, determinerSource, hoteDepuisUrl } from "@/lib/trafic/detection";
import { SITE_URL } from "@/lib/site";

// Écriture des signaux de fréquentation (PROMPT_CLIENT_V2 Lot 5), pour le
// tableau « Trafic » de l'admin (PROMPT_ADMIN_V2 Lot 3). Best-effort comme
// lib/mesure.ts : une mesure qui échoue ne doit jamais casser la page.

const SID_COOKIE = "sacado_sid";
const RECHERCHE_MAX = 120;
const SITE_HOTE = hoteDepuisUrl(SITE_URL) ?? "sacado.sn";

export type TypeVisite =
  | "page_vue"
  | "produit_vu"
  | "ajout_panier"
  | "retrait_panier"
  | "debut_commande"
  | "commande_validee"
  | "recherche"
  | "page_404";

export type EntreeVisite = {
  type: TypeVisite;
  page?: string | null;
  produitId?: number | null;
  quantite?: number | null;
  prixUnitaire?: number | null;
  recherche?: string | null;
  rechercheSansResultat?: boolean | null;
  commandeId?: number | null;
  // Contexte d'acquisition, envoyé par le client à sa première page vue
  // seulement (lib/trafic/mesure-client.ts) — ignoré si la session existe déjà
  // (attribution "first touch", jamais réécrite ensuite).
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  appInstallee?: boolean | null;
};

async function trouverLienSuivi(utmSource: string | null, utmCampaign: string | null): Promise<number | null> {
  if (!utmSource || !utmCampaign) return null;
  const { data } = await supabaseAdmin
    .from("visites_liens")
    .select("id")
    .eq("utm_source", utmSource)
    .eq("utm_campaign", utmCampaign)
    .maybeSingle();
  return (data?.id as number | undefined) ?? null;
}

// Pose la session au premier passage (source/appareil figés), puis se
// contente de rafraîchir `derniere_activite_le` ensuite — jamais de réécrire
// la source une fois attribuée.
async function assurerSession(sessionId: string, entree: EntreeVisite): Promise<void> {
  const { data: existante } = await supabaseAdmin
    .from("visites_sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existante) {
    await supabaseAdmin
      .from("visites_sessions")
      .update({ derniere_activite_le: new Date().toISOString() })
      .eq("session_id", sessionId);
    return;
  }

  const h = await headers();
  const userAgent = h.get("user-agent") ?? "";
  const referent = h.get("referer");
  const referentHote = hoteDepuisUrl(referent);

  const lienId = await trouverLienSuivi(entree.utmSource ?? null, entree.utmCampaign ?? null);

  await supabaseAdmin.from("visites_sessions").insert({
    session_id: sessionId,
    source_type: determinerSource({
      utmSource: entree.utmSource,
      gclid: entree.gclid,
      referentHote,
      siteHote: SITE_HOTE,
      userAgent,
    }),
    utm_source: entree.utmSource ?? null,
    utm_medium: entree.utmMedium ?? null,
    utm_campaign: entree.utmCampaign ?? null,
    gclid: entree.gclid ?? null,
    referent_host: referentHote,
    lien_id: lienId,
    appareil: determinerAppareil(userAgent),
    navigateur: determinerNavigateur(userAgent),
    app_installee: Boolean(entree.appInstallee),
  });
}

async function sessionCourante(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(SID_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function journaliserVisite(entree: EntreeVisite, sessionIdExplicite?: string | null): Promise<void> {
  try {
    const sessionId = sessionIdExplicite ?? (await sessionCourante());
    if (!sessionId) return;

    await assurerSession(sessionId, entree);

    await supabaseAdmin.from("visites_evenements").insert({
      session_id: sessionId,
      type: entree.type,
      page: entree.page?.slice(0, 300) ?? null,
      produit_id: entree.produitId ?? null,
      quantite: entree.quantite ?? null,
      prix_unitaire: entree.prixUnitaire ?? null,
      recherche: entree.recherche ? entree.recherche.trim().slice(0, RECHERCHE_MAX) || null : null,
      recherche_sans_resultat: entree.rechercheSansResultat ?? null,
      commande_id: entree.commandeId ?? null,
    });
  } catch {
    // best-effort
  }
}

// Funnel "commande validée" (PROMPT_ADMIN_V2 Lot 3) : appelé directement
// depuis les server actions de création de commande (lib/checkout/actions.ts),
// pas via un beacon client — la commande est déjà créée côté serveur à ce
// moment, pas besoin d'un aller-retour supplémentaire depuis le navigateur.
export async function journaliserCommandeValidee(commandeId: number): Promise<void> {
  await journaliserVisite({ type: "commande_validee", commandeId });
}
