import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// IP du client pour le rate limiting. IMPORTANT : sur Vercel, la 1re valeur de
// `x-forwarded-for` peut être FALSIFIÉE par le client (il suffit d'envoyer son
// propre en-tête, Vercel se contente d'y ajouter la vraie IP). On privilégie
// donc `x-vercel-forwarded-for` / `x-real-ip`, posés par l'infra Vercel et non
// contrôlables par le client ; en dernier recours on prend la DERNIÈRE valeur
// de `x-forwarded-for` (celle ajoutée par le proxy de confiance).
// En local ces en-têtes sont absents → repli "local" (sans impact en prod).
export async function getClientIp(): Promise<string> {
  const hdrs = await headers();

  const vercel = hdrs.get("x-vercel-forwarded-for") ?? hdrs.get("x-real-ip");
  if (vercel) return vercel.split(",")[0].trim();

  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "local";
}

// true = autorisé, false = limite atteinte (à qui appelle de refuser l'action
// et de renvoyer un message clair). Stocké en base pour rester valable même
// si les requêtes tombent sur des instances serverless différentes.
export async function verifierLimite(
  cle: string,
  max: number,
  fenetreSecondes: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("verifier_limite", {
    p_cle: cle,
    p_max: max,
    p_fenetre_secondes: fenetreSecondes,
  });
  // En cas d'erreur technique sur le compteur lui-même, on laisse passer
  // plutôt que de bloquer tout le monde à cause d'un souci indépendant.
  if (error) return true;
  return Boolean(data);
}
