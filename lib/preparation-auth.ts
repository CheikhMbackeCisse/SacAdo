import "server-only";
import crypto from "node:crypto";

// Jeton opaque d'une demande de préparation (NOTE_ACCES_FOURNISSEURS).
//
// Le fournisseur reçoit par WhatsApp un lien /preparation/<id>?t=<jeton>. Aucun
// compte, aucun mot de passe : le jeton (HMAC de l'id de la demande) est la
// preuve d'accès. L'id seul, séquentiel, ne suffit jamais — même logique que le
// jeton client (lib/client-auth.ts, AUDIT_SECURITE_2).
//
// Secret : `PREPARATION_TOKEN_SECRET` si défini, sinon la clé service_role
// (haute entropie, déjà côté serveur). Sa rotation invalide les liens émis.
function secret(): string {
  return (
    process.env.PREPARATION_TOKEN_SECRET ||
    process.env.CLIENT_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function jetonPreparation(demandeId: number): string {
  return crypto.createHmac("sha256", secret()).update(`preparation:${demandeId}`).digest("hex");
}

export function verifierJetonPreparation(
  demandeId: number,
  jeton: string | null | undefined,
): boolean {
  if (!jeton) return false;
  const a = Buffer.from(jeton);
  const b = Buffer.from(jetonPreparation(demandeId));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
