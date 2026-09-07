"use server";

import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushDisponible } from "@/lib/push";

export type EtatPush = {
  disponible: boolean;
  clePublique: string | null;
};

export async function getEtatPush(): Promise<EtatPush> {
  await requireVendeur();
  return {
    disponible: pushDisponible(),
    clePublique: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  };
}

export type AbonnementPushInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export async function enregistrerAbonnementPush(
  input: AbonnementPushInput,
): Promise<{ ok: boolean }> {
  const { userId } = await requireVendeur();

  if (!input.endpoint || !input.p256dh || !input.auth) return { ok: false };
  if (input.endpoint.length > 2000) return { ok: false };

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      vendeur_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

export async function supprimerAbonnementPush(endpoint: string): Promise<{ ok: boolean }> {
  const { userId } = await requireVendeur();
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("vendeur_id", userId)
    .eq("endpoint", endpoint);
  return { ok: !error };
}
