"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushDisponible } from "@/lib/push";

export type EtatPushAdmin = {
  disponible: boolean;
  clePublique: string | null;
};

export async function getEtatPushAdmin(): Promise<EtatPushAdmin> {
  await requireAdmin();
  return {
    disponible: pushDisponible(),
    clePublique: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  };
}

export type AbonnementPushAdminInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export async function enregistrerAbonnementPushAdmin(
  input: AbonnementPushAdminInput,
): Promise<{ ok: boolean }> {
  const user = await requireAdmin();

  if (!input.endpoint || !input.p256dh || !input.auth) return { ok: false };
  if (input.endpoint.length > 2000) return { ok: false };

  const { error } = await supabaseAdmin.from("abonnements_push_admin").upsert(
    {
      admin_user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

export async function supprimerAbonnementPushAdmin(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireAdmin();
  const { error } = await supabaseAdmin
    .from("abonnements_push_admin")
    .delete()
    .eq("admin_user_id", user.id)
    .eq("endpoint", endpoint);
  return { ok: !error };
}
