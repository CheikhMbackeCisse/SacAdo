import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Journal léger, tous canaux (migration 0063, TACHE_notifications_client.md §9).
// Sert uniquement au tableau de bord admin — le contenu réel des messages vit
// dans `messages` (inbox) / `envois_whatsapp` (whatsapp), jamais dupliqué ici.

export type CanalJournal = "push" | "whatsapp" | "inbox";
export type StatutJournal = "envoye" | "echec" | "differe" | "bloque_preference";

export async function journaliserNotification(entree: {
  clientId: number | null;
  commandeId?: number | null;
  canal: CanalJournal;
  type: string;
  statut: StatutJournal;
  detail?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from("journal_notifications").insert({
      client_id: entree.clientId,
      commande_id: entree.commandeId ?? null,
      canal: entree.canal,
      type: entree.type,
      statut: entree.statut,
      detail: entree.detail ?? null,
    });
  } catch (e) {
    // Le journal ne doit jamais faire échouer l'envoi qu'il observe.
    console.error("journaliserNotification a échoué", e);
  }
}
