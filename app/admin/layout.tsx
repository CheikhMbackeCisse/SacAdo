import type { Metadata, Viewport } from "next";
import "../globals.css";
import { bodyFont, headingFont } from "@/lib/fonts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

// PWA admin (MODULE_EBOOKS.md, Partie 2) : manifeste dédié `scope: /admin`, avec
// sa propre identité (`id: /admin`) pour que le navigateur l'installe comme une
// app SÉPARÉE de l'app client. Le service worker (public/sw.js, scope "/")
// couvre déjà /admin ; on l'enregistre aussi ici car ce layout est indépendant
// de celui du client. La protection serveur (middleware + requireAdmin) est
// inchangée : « installable » ne veut pas dire « moins protégé ».
export const metadata: Metadata = {
  title: "Administration — SacAdo",
  applicationName: "SacAdo Admin",
  manifest: "/manifest-admin.webmanifest",
  // iOS ne lit pas le manifeste pour « Ajouter à l'écran d'accueil ».
  icons: { apple: "/images/logo.jpg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SacAdo Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B3D91",
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
            <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
          </div>
        ) : (
          children
        )}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
