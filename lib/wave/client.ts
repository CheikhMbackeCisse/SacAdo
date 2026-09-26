import "server-only";
import { fetch as fetchUndici, ProxyAgent } from "undici";
import { enregistrerNomMarchandWave } from "@/lib/parametres";
import { signerCorpsWave } from "./webhook-core";

// Client de l'API Wave Checkout (INTEGRATION_WAVE.md).
//
// Tant que WAVE_API_KEY n'est pas renseignée (compte marchand Wave pas encore
// activé), le module bascule en MODE SIMULATION : aucune vraie requête réseau,
// on renvoie une URL vers une page interne qui rejoue le retour succès / échec.
// Ça permet de dérouler tout le parcours de checkout en dev avant d'avoir les
// clés. Dès que la clé est là, le vrai appel HTTP prend le relais sans autre
// changement de code.
//
// Cette clé Wave a la SIGNATURE DE REQUÊTE activée (irréversible côté Wave) :
// chaque appel sortant doit porter un en-tête Wave-Signature construit avec
// WAVE_SIGNING_SECRET — un secret DISTINCT de WAVE_WEBHOOK_SECRET (qui sert,
// lui, à vérifier les webhooks entrants). Même formule des deux côtés
// (`signerCorpsWave`, docs.wave.com/checkout) : HMAC-SHA256 de
// `${timestamp}${corps brut EXACT envoyé}`.
//
// Le compte Wave a la fonctionnalité "IP Whitelisting" activée côté Wave (pas
// désactivable en libre-service, voir dashboard Wave > Developers). Les
// fonctions serverless Vercel n'ayant pas d'IP de sortie fixe, l'appel vers
// api.wave.com passe par le proxy Fixie (IP fixe, quota 500 req/mois) —
// SEULEMENT cet appel, jamais Supabase/OpenFreeMap/etc. La signature HMAC est
// calculée AVANT tout ça, sur le corps brut, exactement comme un appel direct :
// le proxy ne change que le chemin réseau, pas ce qui est signé.

const WAVE_API_BASE_URL = process.env.WAVE_API_BASE_URL || "https://api.wave.com/v1";

// Construit le dispatcher undici qui route via Fixie. `FIXIE_URL` est de la
// forme http://user:pass@host:port — les identifiants sont extraits et passés
// en Proxy-Authorization plutôt que laissés dans l'URI (plus fiable entre
// versions d'undici que de compter sur le parsing automatique de l'auth
// intégrée à l'URI). Calculé une fois : réutilisable pour tout appel Wave
// suivant sur le même lambda "chaud".
function creerDispatcherFixie(): ProxyAgent | undefined {
  const fixieUrl = process.env.FIXIE_URL;
  if (!fixieUrl) return undefined;
  const url = new URL(fixieUrl);
  const token = url.username
    ? `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString("base64")}`
    : undefined;
  return new ProxyAgent({ uri: `${url.protocol}//${url.host}`, token });
}

const DISPATCHER_FIXIE = creerDispatcherFixie();

export function waveEnModeSimulation(): boolean {
  return !process.env.WAVE_API_KEY;
}

// Wave n'est proposé aux clients QUE si les vraies clés marchand sont
// configurées — sauf en dev local, où le mode simulation reste actif pour
// dérouler le parcours. Évite de déployer un paiement en ligne « factice » en
// production tant que le compte Wave n'est pas prêt (CORRECTIONS_V7).
export function waveDisponible(): boolean {
  return Boolean(process.env.WAVE_API_KEY) || process.env.NODE_ENV !== "production";
}

export type SessionWave = {
  // id de session Wave — stocké dans commandes.wave_session_id.
  id: string;
  // URL de la page de paiement Wave vers laquelle rediriger le client.
  waveLaunchUrl: string;
};

export type CreerSessionParams = {
  // Montant total à encaisser, en FCFA (entier, XOF n'a pas de décimales).
  montant: number;
  // Notre référence de rapprochement (id de commande), renvoyée par Wave et
  // present dans le webhook.
  reference: string;
  successUrl: string;
  // Wave route l'annulation ET l'échec vers error_url (pas de cancel_url séparée).
  errorUrl: string;
};

type ResultatSession =
  | { ok: true; session: SessionWave }
  | { ok: false; error: string };

// Construit l'en-tête Wave-Signature d'une requête sortante. `corps` doit être
// la chaîne EXACTE envoyée dans le body de la requête (jamais un objet
// re-sérialisé après coup : le moindre écart d'espace ou d'ordre de clé change
// la signature). Retourne null si WAVE_SIGNING_SECRET n'est pas configuré —
// l'appelant décide alors de refuser l'appel plutôt que d'envoyer une requête
// non signée que Wave rejettera de toute façon.
function signerRequeteSortante(corps: string): string | null {
  // .trim() : un espace ou un saut de ligne collé par erreur en configurant la
  // variable d'environnement suffit à casser la signature silencieusement.
  const secret = process.env.WAVE_SIGNING_SECRET?.trim();
  if (!secret) return null;
  return signerCorpsWave(corps, secret, Date.now());
}

export async function creerSessionWave(params: CreerSessionParams): Promise<ResultatSession> {
  if (waveEnModeSimulation()) {
    return { ok: true, session: sessionSimulee(params) };
  }

  const corps = JSON.stringify({
    amount: String(Math.round(params.montant)),
    currency: "XOF",
    client_reference: params.reference,
    success_url: params.successUrl,
    error_url: params.errorUrl,
  });

  const signature = signerRequeteSortante(corps);
  if (!signature) {
    console.error("Wave: WAVE_SIGNING_SECRET absent alors que WAVE_API_KEY est configurée.");
    return { ok: false, error: "Le service de paiement est mal configuré. Contacte le support." };
  }

  try {
    const reponse = await fetchUndici(`${WAVE_API_BASE_URL}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WAVE_API_KEY?.trim()}`,
        "Content-Type": "application/json",
        "Wave-Signature": signature,
      },
      body: corps,
      // Route via Fixie (IP fixe) si configuré, sinon appel direct (dev local
      // ou compte Wave sans filtrage IP) — voir creerDispatcherFixie ci-dessus.
      ...(DISPATCHER_FIXIE ? { dispatcher: DISPATCHER_FIXIE } : {}),
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      console.error(`Wave: création de session refusée (${reponse.status}) ${detail}`);
      return { ok: false, error: "Le service de paiement est indisponible. Réessaie dans un instant." };
    }

    const data = (await reponse.json()) as {
      id?: string;
      wave_launch_url?: string;
      business_name?: string;
    };
    if (!data.id || !data.wave_launch_url) {
      console.error("Wave: réponse de session inattendue", data);
      return { ok: false, error: "Réponse inattendue du service de paiement." };
    }

    // Nom marchand réellement affiché par Wave (business_name) : gardé à jour
    // pour la mention côté checkout, voir lib/parametres.ts::getNomMarchandWave.
    if (data.business_name) {
      await enregistrerNomMarchandWave(data.business_name);
    }

    return { ok: true, session: { id: data.id, waveLaunchUrl: data.wave_launch_url } };
  } catch (e) {
    console.error("Wave: appel API échoué", e);
    return { ok: false, error: "Impossible de contacter le service de paiement." };
  }
}

// --- Mode simulation --------------------------------------------------------

function sessionSimulee(params: CreerSessionParams): SessionWave {
  // On repart de successUrl uniquement pour retrouver l'origine du site ; la
  // page de simulation reconstruit elle-même les routes de retour à partir de
  // `ref` (pas d'URL arbitraire propagée).
  const base = new URL(params.successUrl).origin;
  const launch = new URL(`${base}/paiement/simulation`);
  launch.searchParams.set("ref", params.reference);
  launch.searchParams.set("montant", String(Math.round(params.montant)));
  return { id: `sim_${params.reference}`, waveLaunchUrl: launch.toString() };
}
