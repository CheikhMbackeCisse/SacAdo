import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protège /admin/* et /vendeur/* : rafraîchit le cookie de session Supabase à
// chaque requête, puis contrôle le rôle.
//   - /admin/*   : compte connecté ET présent dans la table `admins`.
//   - /vendeur/* : compte connecté ET fiche dans la table `vendeurs`.
// (Renommé "middleware.ts" -> "proxy.ts" : convention Next.js 16.)
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  };

  // --- Espace vendeur ------------------------------------------------------
  if (pathname.startsWith("/vendeur")) {
    // Pages publiques de l'espace : connexion + callback OAuth.
    const publiqueVendeur =
      pathname === "/vendeur/connexion" || pathname.startsWith("/vendeur/auth");

    if (!user) {
      return publiqueVendeur ? response : redirectTo("/vendeur/connexion");
    }

    const { data: vendeur } = await supabase
      .from("vendeurs")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    // Connecté sans fiche : on force le passage par /vendeur/profil.
    if (!vendeur) {
      return pathname === "/vendeur/profil" ? response : redirectTo("/vendeur/profil");
    }

    // Fiche OK : inutile de rester sur connexion / profil.
    if (pathname === "/vendeur/connexion" || pathname === "/vendeur/profil") {
      return redirectTo("/vendeur");
    }

    return response;
  }

  // --- Back-office admin --------------------------------------------------
  const isLoginPage = pathname === "/admin/login";

  if (!user) {
    return isLoginPage ? response : redirectTo("/admin/login");
  }

  // Le client `supabase` ici est lié à la session (rôle anon) : la policy RLS
  // « Admin lit sa ligne » (0012) ne renvoie la ligne que si l'utilisateur est
  // bien admin. Un vendeur / simple connecté n'obtient rien -> pas d'accès.
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    return isLoginPage ? response : redirectTo("/admin/login");
  }

  if (isLoginPage) {
    return redirectTo("/admin");
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/vendeur/:path*"],
};
