"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";
import { useNavVisible } from "@/lib/local/use-scroll-direction";

// Pages où la nav du bas reste TOUJOURS visible (pas de masquage au scroll) :
// écrans de choix / d'action, pas des flux d'articles. Ailleurs (accueil,
// catégorie de produits, fiche produit, recherche, Moi...) elle se masque au
// scroll vers le bas pour dégager la lecture.
const NAV_TOUJOURS_VISIBLE = ["/categories", "/kits", "/panier"];

// Cachée en desktop (lg+) : la nav y vit dans la barre du header à la place
// (voir components/layout/header.tsx), conformément à CLAUDE.md section 6.
export function BottomNav() {
  const pathname = usePathname();
  const navFixe = NAV_TOUJOURS_VISIBLE.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
  const scrollVisible = useNavVisible();
  const visible = navFixe || scrollVisible;

  return (
    <nav
      aria-label="Navigation principale"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,19,20,0.04)] backdrop-blur transition-transform duration-300 supports-[backdrop-filter]:bg-surface/80 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-transform duration-150 active:scale-95"
            >
              <span
                className={`absolute top-0 h-0.5 w-8 rounded-full bg-brand transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden="true"
              />
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className={`transition-colors duration-200 ${isActive ? "text-brand" : "text-ink/50"}`}
              />
              <span
                className={`transition-colors duration-200 ${isActive ? "font-medium text-brand" : "text-ink/50"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
