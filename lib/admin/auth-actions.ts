"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";

export type SignInResult = { ok: true } | { ok: false; error: string };

// Anti brute-force : max 5 tentatives / 5 min par IP. C'est en plus de la
// protection propre à Supabase Auth (défense en profondeur), et ça vaut pour
// n'importe quel email tenté depuis cette IP — pas seulement le bon.
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const ip = await getClientIp();
  const autorise = await verifierLimite(`connexion-admin:${ip}`, 5, 300);
  if (!autorise) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Email ou mot de passe incorrect." };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
