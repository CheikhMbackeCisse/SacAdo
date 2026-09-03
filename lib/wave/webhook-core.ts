import crypto from "node:crypto";

// Logique pure de vérification / lecture des webhooks Wave — sans accès à
// l'environnement ni à la base, pour être testable directement (voir
// webhook-core.test.ts). Le point d'entrée serveur est lib/wave/webhook.ts.
//
// Wave signe chaque webhook avec l'en-tête `Wave-Signature` de la forme :
//   t=<timestamp_unix>,v1=<hmac_sha256_hex>[,v1=<autre_hmac>...]
// Le message signé est `${timestamp}.${corps_brut}` (corps EXACT reçu, non
// re-sérialisé), la clé est le secret de webhook Wave. Plusieurs `v1` peuvent
// coexister pendant une rotation de secret.
//
// ⚠️ À confirmer contre la doc Wave à l'activation du compte marchand : si Wave
// concatène sans le `.` ou nomme l'en-tête autrement, ajuster ici uniquement.

export const EN_TETE_SIGNATURE = "wave-signature";

// Tolérance sur l'horodatage de la signature (anti-rejeu). Généreuse : le
// journal wave_evenements empêche déjà de traiter deux fois le même évènement.
export const TOLERANCE_SECONDES = 600;

function messageASigner(timestamp: string, corps: string): string {
  return `${timestamp}.${corps}`;
}

function comparaisonConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Vérifie une signature Wave avec un secret donné (non vide). `maintenant` est
// injectable pour les tests.
export function verifierSignatureHmac(
  corps: string,
  header: string | null,
  secret: string,
  maintenant: number = Date.now(),
): boolean {
  if (!secret || !header) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const partie of header.split(",")) {
    const [cle, valeur] = partie.trim().split("=", 2);
    if (cle === "t") timestamp = valeur ?? "";
    else if (cle === "v1" && valeur) signatures.push(valeur);
  }
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(maintenant / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDES) return false;

  const attendu = crypto
    .createHmac("sha256", secret)
    .update(messageASigner(timestamp, corps))
    .digest("hex");

  return signatures.some((s) => comparaisonConstante(s, attendu));
}

// Fabrique un en-tête Wave-Signature valide (utilisé par les tests et par la
// simulation locale).
export function signerCorpsWave(corps: string, secret: string, timestamp: number): string {
  const t = String(Math.floor(timestamp / 1000));
  const v1 = crypto.createHmac("sha256", secret).update(messageASigner(t, corps)).digest("hex");
  return `t=${t},v1=${v1}`;
}

// --- Lecture de l'évènement ------------------------------------------------

export type EvenementWave = {
  id: string;
  // 'paye'   : paiement confirmé
  // 'echoue' : échec ou annulation
  // 'autre'  : évènement non pertinent (on répond 200 sans agir)
  resultat: "paye" | "echoue" | "autre";
  reference: string;
  sessionId: string | null;
  montant: number | null;
};

type PayloadWave = {
  id?: string;
  type?: string;
  data?: {
    id?: string;
    amount?: string | number;
    client_reference?: string;
    checkout_status?: string;
    payment_status?: string;
  };
};

export function parseEvenementWave(corps: string): EvenementWave | null {
  let payload: PayloadWave;
  try {
    payload = JSON.parse(corps) as PayloadWave;
  } catch {
    return null;
  }
  if (!payload.id) return null;

  const data = payload.data ?? {};
  const type = payload.type ?? "";
  const paye =
    type === "checkout.session.completed" &&
    (data.payment_status === "succeeded" || data.checkout_status === "complete");
  const echoue =
    type === "checkout.session.payment_failed" ||
    type === "checkout.session.expired" ||
    data.payment_status === "failed" ||
    data.payment_status === "cancelled";

  const montantBrut = typeof data.amount === "string" ? Number(data.amount) : data.amount;

  return {
    id: payload.id,
    resultat: paye ? "paye" : echoue ? "echoue" : "autre",
    reference: data.client_reference ?? "",
    sessionId: data.id ?? null,
    montant: typeof montantBrut === "number" && Number.isFinite(montantBrut)
      ? Math.round(montantBrut)
      : null,
  };
}
