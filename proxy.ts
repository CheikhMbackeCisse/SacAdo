import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_URL, SITE_URL } from "@/lib/site";

// Rôles de ce middleware (renommé "middleware.ts" -> "proxy.ts", convention Next 16) :
//   - TOUTES les pages : poser le cookie de session anonyme `sacado_sid` s'il
//     manque (personnalisation de l'accueil avant connexion, voir
//     TACHE_identite_et_beneficiaires.md §1.2). httpOnly : lisible seulement
//     côté serveur (écriture des `evenements`), jamais exposé au JS de la page.
//   - /admin/*   : compte connecté ET présent dans la table `admins`.
//   - /vendeur/* : compte connecté ET fiche dans la table `vendeurs`.
//
// Admin par sous-domaine (TACHE_admin_sous_domaine.md, Phase 2) : deux hosts
// de production distinguent l'app admin de la boutique. Tout le reste (ex.
// déploiements Preview Vercel, localhost) continue de fonctionner EXACTEMENT
// comme avant via handleLegacy — /admin/* y reste servi en place, ce qui
// permet de tester le routage par sous-domaine avant bascule sans casser les
// Preview, qui n'ont pas admin.sacado.sn attaché.

const SID_COOKIE = "sacado_sid";
const SID_MAX_AGE = 60 * 60 * 24 * 365; // 12 mois

const ADMIN_HOST = new URL(ADMIN_URL).hostname;
const MAIN_HOST = new URL(SITE_URL).hostname;

// `request.nextUrl.hostname` ne reflète PAS le Host réel de la requête (il
// vaut l'hôte interne du serveur) : il faut lire l'en-tête, comme le fait
// déjà origineSite() dans lib/site-url.ts. `x-forwarded-host` prime (posé
// par le edge Vercel), `host` en repli (dev local, next start direct).
function hostDeRequete(request: NextRequest): string {
  const brut = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return brut.split(":")[0].toLowerCase();
}

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

// Recopie les cookies (notamment la session Supabase rafraîchie) d'une
// réponse vers une autre : nécessaire quand la réponse finale doit être un
// rewrite/redirect construit APRÈS l'appel à supabase.auth.getUser(), qui a
// pu renouveler les cookies sur `base`.
function copierCookies(base: NextResponse, cible: NextResponse) {
  base.cookies.getAll().forEach((cookie) => cible.cookies.set(cookie));
  return cible;
}

// --- Origine admin.sacado.sn : ne sert QUE l'espace admin, à la racine ----
// Les pages/liens internes de app/admin/** ignorent ce sous-domaine (ils
// utilisent des chemins relatifs comme avant) ; on rajoute donc le préfixe
// `/admin` en interne par un rewrite, invisible pour le visiteur.
async function handleAdminHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cheminAdmin = pathname.startsWith("/admin")
    ? pathname
    : pathname === "/"
      ? "/admin"
      : `/admin${pathname}`;

  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = cheminAdmin === "/admin/login";

  const rewriteVersAdmin = () => {
    const url = request.nextUrl.clone();
    url.pathname = cheminAdmin;
    return copierCookies(supabaseResponse, NextResponse.rewrite(url, { request }));
  };

  // Chemin RACINE de l'origine admin (ex: "/login", "/"), pas le chemin
  // interne préfixé `/admin...`.
  const redirigerVersRacine = (cible: string) => {
    const url = request.nextUrl.clone();
    url.pathname = cible;
    url.search = "";
    return copierCookies(supabaseResponse, NextResponse.redirect(url));
  };

  if (!user) {
    return isLoginPage ? rewriteVersAdmin() : redirigerVersRacine("/login");
  }

  // RLS « Admin lit sa ligne » : un vendeur / simple connecté n'obtient rien.
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    return isLoginPage ? rewriteVersAdmin() : redirigerVersRacine("/login");
  }

  if (isLoginPage) {
    return redirigerVersRacine("/");
  }

  return rewriteVersAdmin();
}

// --- Comportement historique (préservé tel quel) --------------------------
// Utilisé pour tout host qui n'est NI admin.sacado.sn NI sacado.sn : Preview
// Vercel, localhost, etc. /admin/* et /vendeur/* y restent servis en place.
async function handleLegacy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const espaceProtege = pathname.startsWith("/admin") || pathname.startsWith("/vendeur");

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
    const publiqueVendeur = pathname === "/vendeur/connexion" || pathname.startsWith("/vendeur/auth");

    if (!user) {
      return publiqueVendeur ? response : redirectTo("/vendeur/connexion");
    }

    const { data: vendeur } = await supabase.from("vendeurs").select("id").eq("id", user.id).maybeSingle();

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
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();

  if (!admin) {
    return isLoginPage ? response : redirectTo("/admin/login");
  }

  if (isLoginPage) {
    return redirectTo("/admin");
  }

  return response;
}

export default async function proxy(request: NextRequest) {
  const hostname = hostDeRequete(request);
  const { pathname, search } = request.nextUrl;

  if (hostname === ADMIN_HOST) {
    return handleAdminHost(request);
  }

  if (hostname === MAIN_HOST && pathname.startsWith("/admin")) {
    const reste = pathname.slice("/admin".length);
    const destination = new URL(ADMIN_URL);
    destination.pathname = reste === "" ? "/" : reste;
    destination.search = search;
    // Temporaire (307) pendant la bascule : facile à retirer si besoin,
    // sans que des caches aient figé une redirection permanente entre-temps.
    return NextResponse.redirect(destination, 307);
  }

  return handleLegacy(request);
}

export const config = {
  // Tout sauf les assets internes Next, les routes /api et les fichiers avec
  // extension (images, sw.js, manifestes…). Couvre / , /admin/* , /vendeur/* ,
  // et toutes les pages storefront (nécessaire pour poser `sacado_sid`).
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
