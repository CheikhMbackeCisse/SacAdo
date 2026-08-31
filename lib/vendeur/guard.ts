import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Vendeur } from "@/lib/supabase/types";

// Équivalent de lib/admin/guard.ts pour l'espace vendeur. Le proxy protège déjà
// les pages /vendeur/*, mais les Server Components / Server Actions revérifient :
// il faut un compte connecté ET une fiche `vendeurs`.
export async function requireVendeur(): Promise<{ userId: string; vendeur: Vendeur }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autorisé.");
  }

  const { data: vendeur } = await supabaseAdmin
    .from("vendeurs")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!vendeur) {
    throw new Error("Aucune fiche vendeur.");
  }

  return { userId: user.id, vendeur: vendeur as Vendeur };
}

// Renvoie la fiche vendeur si elle existe, sinon null (sans jeter). Utilisé par
// la page /vendeur/profil pour décider quoi afficher.
export async function getVendeurCourant(): Promise<{ userId: string; vendeur: Vendeur | null } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: vendeur } = await supabaseAdmin
    .from("vendeurs")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, vendeur: (vendeur as Vendeur) ?? null };
}
