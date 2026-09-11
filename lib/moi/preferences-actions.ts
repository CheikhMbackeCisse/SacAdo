"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIdAutorise } from "@/lib/client-session";
import { getPreferences } from "@/lib/messages/preferences";
import type { PreferencesNotifications } from "@/lib/supabase/types";

// Préférences de notifications côté client (TACHE_notifications_client.md §8).
// Trois familles indépendantes, jamais un seul interrupteur global.

export type FamillePreference = "suivi_commandes" | "produits_attendus" | "rentree_nouveautes";

export type PreferencesResult = Omit<PreferencesNotifications, "client_id" | "maj_le">;

export async function getPreferencesNotifications(
  telephone: string,
  jeton: string,
): Promise<PreferencesResult | null> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return null;
  return getPreferences(clientId);
}

export async function setPreferenceNotification(
  telephone: string,
  jeton: string,
  famille: FamillePreference,
  valeur: boolean,
): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return { ok: false };

  // upsert : la ligne n'existe pas tant que le client n'a rien changé (les
  // valeurs par défaut suffisent jusque-là).
  const actuelles = await getPreferences(clientId);
  const { error } = await supabaseAdmin.from("preferences_notifications").upsert(
    {
      client_id: clientId,
      ...actuelles,
      [famille]: valeur,
      maj_le: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  return { ok: !error };
}
