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

// Le nom de boutique est unique (insensible à la casse) — migration 0018.
// On vérifie en amont pour renvoyer un message clair et, à l'inscription, éviter
// de créer un compte Auth orphelin si le nom est déjà pris.
async function boutiqueDejaPrise(boutique: string, exceptId?: string): Promise<boolean> {
  const cible = boutique.toLowerCase();
  const { data, error } = await supabaseAdmin
    .from("vendeurs")
    .select("id, nom_boutique");

  if (error || !data) return false; // en cas de souci, l'index unique reste le garde-fou
  return data.some(
    (v) => v.id !== exceptId && v.nom_boutique.trim().toLowerCase() === cible,
  );
}

function estViolationUnicite(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
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
  if (await boutiqueDejaPrise(boutique)) {
    return { ok: false, error: "Ce nom de boutique est déjà utilisé. Choisis-en un autre." };
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
    if (estViolationUnicite(ficheError)) {
      return { ok: false, error: "Ce nom de boutique vient d'être pris. Choisis-en un autre." };
    }
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
  if (await boutiqueDejaPrise(boutique, user.id)) {
    return { ok: false, error: "Ce nom de boutique est déjà utilisé. Choisis-en un autre." };
  }

  const contactNom = input.contactNom?.trim() || null;
  const contactTelephone = input.contactTelephone?.trim() || null;
  if ((contactNom && contactNom.length > 100) || (contactTelephone && contactTelephone.length > 30)) {
    return { ok: false, error: "Un des champs de contact est trop long." };
  }

  const { error } = await supabaseAdmin.from("vendeurs").upsert(
    {
      id: user.id,
      nom_boutique: boutique,
      contact_nom: contactNom,
      contact_telephone: contactTelephone,
    },
    { onConflict: "id" },
  );

  if (error) {
    if (estViolationUnicite(error)) {
      return { ok: false, error: "Ce nom de boutique vient d'être pris. Choisis-en un autre." };
    }
    return { ok: false, error: "Enregistrement impossible. Réessaie." };
  }
  return { ok: true };
}
