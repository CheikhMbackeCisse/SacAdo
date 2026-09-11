import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Identité du visiteur courant : anonyme (cookie `sacado_sid`, posé par le
// proxy sur toutes les pages storefront) ou identifiée (compte relié via
// `sessions_comptes` après une commande, sur n'importe quel appareil) — même
// modèle que l'affinité de classement (lib/affinites.ts). Jamais fournie par
// le client : uniquement le cookie httpOnly, résolu ici côté serveur.

const SID_COOKIE = "sacado_sid";

export type IdentiteSession = { sessionId: string | null; clientId: number | null };

export async function identiteSession(): Promise<IdentiteSession> {
  try {
    const jar = await cookies();
    const sessionId = jar.get(SID_COOKIE)?.value ?? null;
    if (!sessionId) return { sessionId: null, clientId: null };

    const { data } = await supabaseAdmin
      .from("sessions_comptes")
      .select("compte_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    return { sessionId, clientId: (data?.compte_id as number | null) ?? null };
  } catch {
    return { sessionId: null, clientId: null };
  }
}
