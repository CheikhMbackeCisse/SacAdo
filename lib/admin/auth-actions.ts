"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: "Email ou mot de passe incorrect." };

  // Un compte vendeur (même méthode d'auth) ne doit jamais ouvrir l'admin.
  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  // Repli tant que la migration 0012 n'est pas passée (table `admins` absente).
  if (!admin && adminError?.code !== "42P01") {
    await supabase.auth.signOut();
    return { ok: false, error: "Ce compte n'est pas autorisé à accéder à l'administration." };
  }

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
