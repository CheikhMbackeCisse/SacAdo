import type { Metadata } from "next";
import "../globals.css";
import { bodyFont, headingFont } from "@/lib/fonts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: "Administration — SacAdo",
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

  return (
    <html lang="fr" className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}>
      <body className="min-h-full bg-ink/[0.03] text-ink">
        {user ? (
          <div className="flex min-h-screen w-full">
            <AdminNav email={user.email ?? ""} />
            <main className="min-w-0 flex-1 overflow-x-auto p-6">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
