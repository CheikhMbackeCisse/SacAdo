import "server-only";

// Client de l'API Wave Checkout (INTEGRATION_WAVE.md).
//
// Tant que WAVE_API_KEY n'est pas renseignée (compte marchand Wave pas encore
// activé), le module bascule en MODE SIMULATION : aucune vraie requête réseau,
// on renvoie une URL vers une page interne qui rejoue le retour succès / échec.
// Ça permet de dérouler tout le parcours de checkout en dev avant d'avoir les
// clés. Dès que la clé est là, le vrai appel HTTP prend le relais sans autre
// changement de code.

const WAVE_API_BASE_URL = process.env.WAVE_API_BASE_URL || "https://api.wave.com/v1";

export function waveEnModeSimulation(): boolean {
  return !process.env.WAVE_API_KEY;
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

export async function creerSessionWave(params: CreerSessionParams): Promise<ResultatSession> {
  if (waveEnModeSimulation()) {
    return { ok: true, session: sessionSimulee(params) };
  }

  try {
    const reponse = await fetch(`${WAVE_API_BASE_URL}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(Math.round(params.montant)),
        currency: "XOF",
        client_reference: params.reference,
        success_url: params.successUrl,
        error_url: params.errorUrl,
      }),
      cache: "no-store",
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      console.error(`Wave: création de session refusée (${reponse.status}) ${detail}`);
      return { ok: false, error: "Le service de paiement est indisponible. Réessaie dans un instant." };
    }

    const data = (await reponse.json()) as { id?: string; wave_launch_url?: string };
    if (!data.id || !data.wave_launch_url) {
      console.error("Wave: réponse de session inattendue", data);
      return { ok: false, error: "Réponse inattendue du service de paiement." };
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
