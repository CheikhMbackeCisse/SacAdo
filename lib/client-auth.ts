import "server-only";
import crypto from "node:crypto";

// Jeton opaque lié à un client (AUDIT_SECURITE_2 C1/C3).
//
// Pas de compte / mot de passe client en v1 : le numéro de téléphone identifie
// le client. Mais le numéro seul NE DOIT PAS suffire à relire l'historique, la
// boîte de réception ou la position d'un client — sinon n'importe qui récupère
// les données d'autrui à partir d'un numéro connu ou deviné.
//
// À la création d'une commande, le serveur remet ce jeton (HMAC du client_id) ;
// l'appareil le range à côté du numéro. Les lectures « par téléphone » exigent
// ensuite `{ telephone, jeton }` et vérifient le jeton. Un attaquant sans jeton
// valide n'obtient rien.
//
// Le secret : `CLIENT_TOKEN_SECRET` si défini, sinon la clé service_role (déjà
// présente côté serveur, haute entropie). Sa rotation invalide les jetons
// existants — les clients en reçoivent un nouveau à leur commande suivante.
function secret(): string {
  return process.env.CLIENT_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function jetonClient(clientId: number): string {
  return crypto.createHmac("sha256", secret()).update(`client:${clientId}`).digest("hex");
}

export function verifierJetonClient(clientId: number, jeton: string | null | undefined): boolean {
  if (!jeton) return false;
  const attendu = jetonClient(clientId);
  const a = Buffer.from(jeton);
  const b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
