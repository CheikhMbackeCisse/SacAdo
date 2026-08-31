import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Retour de "Continuer avec Google" : Supabase renvoie ici avec un ?code.
// On l'échange contre une session (cookies), puis on oriente le vendeur :
//   - pas de fiche `vendeurs`  -> /vendeur/profil (il complète nom de boutique)
//   - fiche présente           -> /vendeur
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const erreur = searchParams.get("error");

  if (erreur || !code) {
    return NextResponse.redirect(`${origin}/vendeur/connexion`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/vendeur/connexion`);
  }

  const { data: vendeur } = await supabaseAdmin
    .from("vendeurs")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  return NextResponse.redirect(`${origin}${vendeur ? "/vendeur" : "/vendeur/profil"}`);
}
