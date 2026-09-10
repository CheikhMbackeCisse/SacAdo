import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rôles de ce middleware (renommé "middleware.ts" -> "proxy.ts", convention Next 16) :
//   - TOUTES les pages : poser le cookie de session anonyme `sacado_sid` s'il
//     manque (personnalisation de l'accueil avant connexion, voir
//     TACHE_identite_et_beneficiaires.md §1.2). httpOnly : lisible seulement
//     côté serveur (écriture des `evenements`), jamais exposé au JS de la page.
//   - /admin/*   : compte connecté ET présent dans la table `admins`.
//   - /vendeur/* : compte connecté ET fiche dans la table `vendeurs`.

const SID_COOKIE = "sacado_sid";
const SID_MAX_AGE = 60 * 60 * 24 * 365; // 12 mois

function assurerSid(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(SID_COOKIE)) return;
  const sid = crypto.randomUUID();
  response.cookies.set(SID_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SID_MAX_AGE,
    path: "/",
  });
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const espaceProtege =
    pathname.startsWith("/admin") || pathname.startsWith("/vendeur");

  // Storefront : uniquement le cookie de session anonyme, aucun appel réseau.
  if (!espaceProtege) {
    const response = NextResponse.next({ request });
    assurerSid(request, response);
    return response;
  }

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
  // Tout sauf les assets internes Next, les routes /api et les fichiers avec
  // extension (images, sw.js, manifestes…). Couvre / , /admin/* , /vendeur/* ,
  // et toutes les pages storefront (nécessaire pour poser `sacado_sid`).
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
