import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Le middleware protège déjà les pages /admin/*, mais une Server Action est
// un endpoint indépendant qu'on peut appeler directement : chaque action
// d'écriture admin doit revérifier elle-même la session avant de toucher
// supabaseAdmin (qui, lui, ignore complètement le RLS).
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autorisé.");
  }

  return user;
}
