"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";

export type AuthResult =
  | { ok: true; besoinVerificationEmail?: boolean }
  | { ok: false; error: string };

// Anti brute-force : max 5 tentatives / 5 min par IP (comme la connexion admin,
// lib/admin/auth-actions.ts). Défense en profondeur en plus de Supabase Auth.
async function limiteOk(prefixe: string): Promise<boolean> {
  const ip = await getClientIp();
  return verifierLimite(`${prefixe}:${ip}`, 5, 300);
}

function nettoyerBoutique(valeur: string): string {
  return valeur.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function signUpVendeur(
  email: string,
  password: string,
  nomBoutique: string,
): Promise<AuthResult> {
  if (!(await limiteOk("inscription-vendeur"))) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const boutique = nettoyerBoutique(nomBoutique);
  if (boutique.length < 2) {
    return { ok: false, error: "Indique le nom de ta boutique (2 caractères minimum)." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    // Message générique : on ne révèle pas si l'email existe déjà.
    return { ok: false, error: "Impossible de créer le compte. Vérifie l'email et le mot de passe." };
  }

  // Fiche vendeur créée côté serveur (service_role) : pas de policy INSERT anon.
  const { error: ficheError } = await supabaseAdmin
    .from("vendeurs")
    .upsert({ id: data.user.id, nom_boutique: boutique }, { onConflict: "id" });

  if (ficheError) {
    return { ok: false, error: "Compte créé mais la fiche boutique a échoué. Contacte le support." };
  }

  // Si la confirmation d'email est activée sur le projet Supabase, signUp ne
  // pose pas de session : l'utilisateur doit cliquer le lien reçu par email.
  return { ok: true, besoinVerificationEmail: !data.session };
}

export async function signInVendeur(email: string, password: string): Promise<AuthResult> {
  if (!(await limiteOk("connexion-vendeur"))) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Email ou mot de passe incorrect." };
  return { ok: true };
}

export async function signOutVendeur(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/vendeur/connexion");
}

// Crée / complète la fiche vendeur (page /vendeur/profil, surtout après Google).
export async function enregistrerProfilVendeur(input: {
  nomBoutique: string;
  contactNom?: string;
  contactTelephone?: string;
}): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Session expirée, reconnecte-toi." };

  const boutique = nettoyerBoutique(input.nomBoutique);
  if (boutique.length < 2) {
    return { ok: false, error: "Indique le nom de ta boutique (2 caractères minimum)." };
  }

  const { error } = await supabaseAdmin.from("vendeurs").upsert(
    {
      id: user.id,
      nom_boutique: boutique,
      contact_nom: input.contactNom?.trim() || null,
      contact_telephone: input.contactTelephone?.trim() || null,
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false, error: "Enregistrement impossible. Réessaie." };
  return { ok: true };
}
