import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "../globals.css";
import { bodyFont, headingFont } from "@/lib/fonts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN_URL } from "@/lib/site";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const ADMIN_HOST = new URL(ADMIN_URL).hostname;

// PWA admin (TACHE_admin_pwa_meme_domaine.md) : manifeste dédié servi sous
// `/admin/manifest.webmanifest`, avec sa propre identité (`id: /admin`, `scope:
// /admin/`) pour que le navigateur l'installe comme une app SÉPARÉE de l'app
// client, sur la même origine. Icônes distinctes (fond sombre + glyphe tableau
// de bord) : deux apps avec la même icône seraient inutilisables. La protection
// serveur (middleware + requireAdmin) est inchangée : « installable » ne veut
// pas dire « moins protégé ».
export const metadata: Metadata = {
  title: "SacAdo Admin",
  applicationName: "SacAdo Admin",
  // Protégé par l'auth (middleware), mais on ne laisse pas non plus un robot
  // indexer l'écran de connexion — même règle que vendeur/preparation.
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  // iOS ne lit pas le manifeste pour « Ajouter à l'écran d'accueil ».
  icons: { apple: "/icons/admin-512.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SacAdo Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#031726",
  viewportFit: "cover",
};

// Second root layout indépendant du site client (voir app/(storefront)/layout.tsx) :
// pas de Header/BottomNav ici. Le middleware (middleware.ts) redirige déjà vers
// /admin/login sans session ; ce layout se contente d'adapter le chrome
// (sidebar visible seulement une fois connecté, page de login sans sidebar).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Portée du service worker : "/" sur le sous-domaine admin.sacado.sn (où
  // l'admin EST toute l'origine), "/admin/" (par défaut) quand il reste
  // servi en place sous /admin/* (Preview Vercel, localhost).
  const h = await headers();
  const hostActuel = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0].toLowerCase();
  const surSousDomaine = hostActuel === ADMIN_HOST;

  // Le chrome admin (sidebar) n'apparaît que pour un vrai admin. Un compte
  // connecté mais non-admin voit la page nue (le proxy le redirige déjà).
  const { data: admin } = user
    ? await supabaseAdmin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const estAdmin = Boolean(user) && Boolean(admin);

  return (
    <html
      lang="fr"
      data-theme="light"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink/[0.03] text-ink">
        {user && estAdmin ? (
          <div className="lg:flex lg:min-h-screen">
            <AdminNav email={user.email ?? ""} />
            <main className="min-w-0 flex-1 p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
            <AdminBottomNav />
          </div>
        ) : (
          children
        )}
        <ServiceWorkerRegister script="/admin/sw.js" scope={surSousDomaine ? "/" : "/admin/"} />
      </body>
    </html>
  );
}
