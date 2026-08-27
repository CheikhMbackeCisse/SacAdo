"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Heart, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { NAV_ITEMS } from "@/lib/nav-items";

const DEFAULT_PLACEHOLDERS = [
  "Cahier 200 pages",
  "Cahier Prestige",
  "Calculatrice scientifique",
  "Cartable",
];

const PLACEHOLDER_INTERVAL_MS = 15000;

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [query, setQuery] = useState("");

  const placeholders = useMemo(() => {
    const categorieActive = CATEGORIES.find((categorie) => pathname.startsWith(categorie.href));
    return categorieActive?.placeholders ?? DEFAULT_PLACEHOLDERS;
  }, [pathname]);

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % placeholders.length);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [placeholders]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-full transition-opacity duration-150 hover:opacity-80 active:scale-95"
        >
          <Image
            src="/images/logo.jpg"
            alt="SacAdo"
            width={36}
            height={36}
            className="rounded-md object-cover"
            priority
          />
          <span className="hidden font-heading text-lg font-bold text-brand sm:inline">
            SacAdo
          </span>
        </Link>

        <form
          className="min-w-0 flex-1"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = query.trim();
            // Rien de tapé (seul le placeholder est visible) -> pas de
            // recherche déclenchée par la touche/icône "rechercher" du clavier.
            if (!trimmed) return;
            router.push(`/recherche?q=${encodeURIComponent(trimmed)}`);
          }}
        >
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholders[placeholderIndex % placeholders.length]}
              aria-label="Rechercher un produit"
              className="w-full rounded-lg border border-ink/10 bg-elevated py-2 pl-4 pr-9 text-base text-ink placeholder:text-ink/40 transition-colors duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 sm:text-sm"
            />
            <Search
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40"
              aria-hidden="true"
            />
          </div>
        </form>

        <Link
          href="/favoris"
          aria-label="Favoris"
          className="shrink-0 rounded-full p-2 text-ink transition-colors duration-150 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-90"
        >
          <Heart size={22} />
        </Link>
      </div>

      {/* Desktop (lg+) : la nav vit ici plutôt qu'en bottom nav fixe (voir
          CLAUDE.md section 6 et components/layout/bottom-nav.tsx). */}
      <nav
        aria-label="Navigation principale"
        className="hidden border-t border-ink/10 lg:block"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "border-brand font-medium text-brand"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
