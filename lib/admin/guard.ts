import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Le middleware protège déjà les pages /admin/*, mais une Server Action est
// un endpoint indépendant qu'on peut appeler directement : chaque action
// d'écriture admin doit revérifier elle-même la session avant de toucher
// supabaseAdmin (qui, lui, ignore complètement le RLS).
//
// Depuis la marketplace, « connecté » ne suffit plus : un vendeur a aussi un
// compte Supabase Auth. On exige une ligne dans la table `admins`.
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autorisé.");
  }

  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    throw new Error("Non autorisé.");
  }

  return user;
}
