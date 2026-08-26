"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";

// Cachée en desktop (lg+) : la nav y vit dans la barre du header à la place
// (voir components/layout/header.tsx), conformément à CLAUDE.md section 6.
export function BottomNav() {
  const pathname = usePathname();
  // Sur la page Moi (contenu long, sections en scroll), la nav défile avec la
  // page au lieu de rester fixe en bas de l'écran.
  const fixe = pathname !== "/moi";

  return (
    <nav
      aria-label="Navigation principale"
      className={`${fixe ? "sticky bottom-0" : "relative"} z-40 border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,19,20,0.04)] backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:hidden`}
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
