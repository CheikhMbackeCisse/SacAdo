import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estVendeurSacAdo } from "@/lib/vendeurs/constants";
import { creerDemandePourVendeur } from "@/lib/preparation-creer";

// Déclenchement AUTOMATIQUE des demandes de préparation pour une commande en
// livraison 24h (NOTIFICATIONS_FOURNISSEURS §2). Appelé une fois la commande
// confirmée : à la création (paiement livraison) ou au webhook Wave (paiement
// abouti). Sans effet si la commande n'est pas en 24h.
//
// Idempotent : `commande_item_id` est unique dans demande_preparation_items, donc
// un article déjà pris n'est pas redemandé ; on ne crée une demande que s'il
// reste au moins un article. Ne jette jamais (le flux commande ne doit pas
// échouer à cause d'une notif).
export async function declencherPreparationsAuto(commandeId: number): Promise<void> {
  try {
    if (!Number.isFinite(commandeId)) return;

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, mode_livraison, statut")
      .eq("id", commandeId)
      .maybeSingle();
    const c = commande as { mode_livraison: string; statut: string } | null;
    if (!c || c.mode_livraison !== "24h" || c.statut === "paiement_en_attente") return;

    const { data: itemsRows } = await supabaseAdmin
      .from("commande_items")
      .select("produit_id")
      .eq("commande_id", commandeId);
    const produitIds = [...new Set((itemsRows ?? []).map((i) => i.produit_id as number))];
    if (produitIds.length === 0) return;

    const { data: produitsRows } = await supabaseAdmin
      .from("produits")
      .select("id, vendeur_id")
      .in("id", produitIds);
    const vendeurIds = [
      ...new Set(
        ((produitsRows ?? []) as { id: number; vendeur_id: string | null }[])
          .map((p) => p.vendeur_id)
          .filter((v): v is string => v != null && !estVendeurSacAdo(v)),
      ),
    ];

    for (const vendeurId of vendeurIds) {
      // On limite la demande aux articles de CETTE commande 24h (urgence ciblée).
      await creerDemandePourVendeur(vendeurId, "auto_24h", { commandeIds: [commandeId] });
    }
  } catch (e) {
    console.error("declencherPreparationsAuto a échoué", e);
  }
}
