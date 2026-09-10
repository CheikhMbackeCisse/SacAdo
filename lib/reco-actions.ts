"use server";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIdAutorise } from "@/lib/client-session";

// « Réinitialiser mes recommandations » (TACHE_identite §1.5) : vide les
// affinités du compte, de la session courante et de tous les bénéficiaires.
// Fonctionne aussi sans compte (juste la session anonyme).
export async function reinitialiserRecommandations(
  telephone: string | null,
  jeton: string | null,
): Promise<{ ok: boolean }> {
  try {
    const compteId =
      telephone && jeton ? await clientIdAutorise(telephone, jeton) : null;
    const jar = await cookies();
    const sid = jar.get("sacado_sid")?.value ?? null;
    if (!compteId && !sid) return { ok: false };
    await supabaseAdmin.rpc("reinitialiser_recommandations", {
      p_client: compteId,
      p_session: sid,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
