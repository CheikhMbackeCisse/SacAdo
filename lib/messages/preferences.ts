import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PreferencesNotifications } from "@/lib/supabase/types";

// Lecture des préférences par client_id, pour l'envoi (pas d'identité à
// vérifier ici : appelé depuis le serveur avec un client_id déjà résolu et
// fiable — cf. lib/moi/preferences-actions.ts pour le côté client identifié).
// Absence de ligne = tout activé par défaut (TACHE_notifications_client.md §8).

const DEFAUT: Omit<PreferencesNotifications, "client_id" | "maj_le"> = {
  suivi_commandes: true,
  produits_attendus: true,
  rentree_nouveautes: true,
};

export async function getPreferences(
  clientId: number,
): Promise<Omit<PreferencesNotifications, "client_id" | "maj_le">> {
  const { data } = await supabaseAdmin
    .from("preferences_notifications")
    .select("suivi_commandes, produits_attendus, rentree_nouveautes")
    .eq("client_id", clientId)
    .maybeSingle();
  return data ?? DEFAUT;
}

export async function suiviCommandesActif(clientId: number): Promise<boolean> {
  const prefs = await getPreferences(clientId);
  return prefs.suivi_commandes;
}
