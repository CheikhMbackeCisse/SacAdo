import "server-only";
import { verifierSignatureHmac } from "./webhook-core";

export { EN_TETE_SIGNATURE, parseEvenementWave } from "./webhook-core";
export type { EvenementWave } from "./webhook-core";

// Point d'entrée serveur : lit le secret dans l'environnement. Tant que
// WAVE_WEBHOOK_SECRET est vide (compte marchand pas encore actif), on accepte
// sans vérifier — mode dev uniquement.
export function verifierSignatureWave(corps: string, header: string | null): boolean {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) return true;
  return verifierSignatureHmac(corps, header, secret);
}
