"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIdAutorise } from "@/lib/client-session";
import { pushDisponible } from "@/lib/push";

// Abonnement push côté client (TACHE_notifications_client.md §3). L'identité est
// le couple (téléphone, jeton) remis à la première commande — sans lui, on ne
// rattache aucun abonnement.

export type EtatPushClient = { disponible: boolean; clePublique: string | null };

export async function etatPushClient(): Promise<EtatPushClient> {
  return {
    disponible: pushDisponible(),
    clePublique: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  };
}

export type AbonnementPushClientInput = {
  telephone: string;
  jeton: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export async function enregistrerAbonnementPushClient(
  input: AbonnementPushClientInput,
): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(input.telephone, input.jeton);
  if (!clientId) return { ok: false };

  if (!input.endpoint || !input.p256dh || !input.auth) return { ok: false };
  if (input.endpoint.length > 2000) return { ok: false };

  const { error } = await supabaseAdmin.from("abonnements_push_client").upsert(
    {
      client_id: clientId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      derniere_utilisation: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

export async function supprimerAbonnementPushClient(input: {
  telephone: string;
  jeton: string;
  endpoint: string;
}): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(input.telephone, input.jeton);
  if (!clientId) return { ok: false };

  const { error } = await supabaseAdmin
    .from("abonnements_push_client")
    .delete()
    .eq("client_id", clientId)
    .eq("endpoint", input.endpoint);
  return { ok: !error };
}
