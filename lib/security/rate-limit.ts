import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// L'IP vient de x-forwarded-for, posé par Vercel (le premier maillon de la
// chaîne est le vrai client). En local ce header est souvent absent, d'où le
// repli sur "local" — sans impact en production.
export async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
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
