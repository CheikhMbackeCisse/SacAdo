"use client";

import { usePathname } from "next/navigation";
import { ROUTES_SANS_BOTTOM_NAV } from "@/lib/nav-items";
import { LegalFooter } from "@/components/layout/legal-footer";

// <main> du storefront. Réserve en bas la hauteur de la bottom nav (mobile),
// sauf sur les écrans "tunnel" où la nav est masquée : là, le bouton d'action
// est fixé tout en bas et c'est la page qui gère sa propre gouttière (le pied
// de page légal y est omis pour la même raison, TACHE_pages_legales_wave.md §5).
export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const sansNav = ROUTES_SANS_BOTTOM_NAV.includes(pathname);

  return (
    <main
      id="main-content"
      className={`mx-auto flex w-full max-w-6xl flex-1 flex-col ${
        sansNav ? "" : "pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
      }`}
    >
      {children}
      {!sansNav && <LegalFooter />}
    </main>
  );
}
