import crypto from "node:crypto";

// Logique pure de vérification / lecture des webhooks Wave — sans accès à
// l'environnement ni à la base, pour être testable directement (voir
// webhook-core.test.ts). Le point d'entrée serveur est lib/wave/webhook.ts.
//
// Wave signe chaque webhook avec l'en-tête `Wave-Signature` de la forme :
//   t=<timestamp_unix>,v1=<hmac_sha256_hex>[,v1=<autre_hmac>...]
// Le message signé est la CONCATÉNATION DIRECTE `${timestamp}${corps_brut}`
// (sans séparateur ; corps EXACT reçu, non re-sérialisé), HMAC-SHA256 avec le
// secret de webhook Wave. Plusieurs `v1` peuvent coexister (rotation de secret).
// Réf : https://docs.wave.com/webhook (vérifié 2026-09).

export const EN_TETE_SIGNATURE = "wave-signature";

// Wave recommande de rejeter les requêtes de plus de 5 minutes (anti-rejeu).
export const TOLERANCE_SECONDES = 300;

function messageASigner(timestamp: string, corps: string): string {
  return `${timestamp}${corps}`;
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
  // Code d'erreur BRUT Wave (data.last_payment_error.code) — diagnostic
  // uniquement, jamais affiché tel quel au client. Voir messageErreurPaiement().
  erreurCode: string | null;
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
    // Présent sur checkout.session.payment_failed (docs.wave.com/webhook) :
    // code technique stable (insufficient-funds, blocked-account, ...).
    last_payment_error?: { code?: string; message?: string } | null;
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
    erreurCode: data.last_payment_error?.code ?? null,
  };
}

// --- Message client (français) à partir du code d'erreur Wave --------------
//
// Le code BRUT est stocké tel quel en base (commandes.wave_erreur_code, migration
// 0087) pour le diagnostic ; ce mapping ne vit que dans le code pour pouvoir
// reformuler un message sans toucher aux données. Codes documentés sur
// docs.wave.com/webhook (liste non exhaustive, Wave peut en ajouter — d'où le
// repli par défaut).
const MESSAGES_ERREUR_PAIEMENT: Record<string, string> = {
  "insufficient-funds": "Le solde du compte utilisé est insuffisant pour ce paiement.",
  "blocked-account": "Le compte utilisé pour payer est bloqué. Contacte Wave ou utilise un autre moyen de paiement.",
  "payer-mobile-mismatch": "Le numéro utilisé pour payer ne correspond pas à celui attendu.",
  "cross-border-payment-not-allowed": "Ce paiement entre deux pays n'est pas autorisé.",
  "customer-age-restricted": "Ce paiement n'est pas autorisé sur ce compte.",
  "kyb-limits-exceeded": "Le plafond de paiement du compte utilisé est atteint.",
  "payment-failure": "Une erreur technique a empêché le paiement.",
};

const MESSAGE_ERREUR_PAR_DEFAUT =
  "Le paiement n'a pas abouti. Réessaie, ou utilise un autre moyen de paiement.";

export function messageErreurPaiement(code: string | null): string {
  if (!code) return MESSAGE_ERREUR_PAR_DEFAUT;
  return MESSAGES_ERREUR_PAIEMENT[code] ?? MESSAGE_ERREUR_PAR_DEFAUT;
}
