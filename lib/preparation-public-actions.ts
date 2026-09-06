"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifierJetonPreparation } from "@/lib/preparation-auth";

export type PreparationActionResult = { ok: true } | { ok: false; error: string };

// Le fournisseur clique « Commande préparée / prête » depuis le lien reçu par
// WhatsApp. Le jeton fait foi (pas de compte). « Préparé » = « j'ai tout réuni »
// (NOTIFICATIONS_FOURNISSEURS §4) — pas de gestion de stock séparée.
// La notification à l'admin (message in-app) est ajoutée au Lot 4.
export async function marquerPreparationPrete(
  demandeId: number,
  jeton: string,
): Promise<PreparationActionResult> {
  if (!Number.isFinite(demandeId) || !verifierJetonPreparation(demandeId, jeton)) {
    return { ok: false, error: "Lien invalide." };
  }

  const { data: demande } = await supabaseAdmin
    .from("demandes_preparation")
    .select("id, statut")
    .eq("id", demandeId)
    .maybeSingle();
  if (!demande) return { ok: false, error: "Demande introuvable." };
  if ((demande as { statut: string }).statut === "preparee") return { ok: true };

  const { error } = await supabaseAdmin
    .from("demandes_preparation")
    .update({ statut: "preparee", preparee_le: new Date().toISOString() })
    .eq("id", demandeId);
  if (error) return { ok: false, error: "Impossible d'enregistrer. Réessaie." };

  revalidatePath(`/preparation/${demandeId}`);
  revalidatePath("/admin/preparations");
  revalidatePath(`/admin/preparations/${demandeId}`);
  return { ok: true };
}
