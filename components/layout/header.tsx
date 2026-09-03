"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Heart, Search, Settings, Tag, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavIcon } from "@/components/layout/nav-icon";
import { InstallHeaderButton } from "@/components/pwa/install-header-button";
import { useIdentite } from "@/lib/local/identite";
import {
  placeholdersPourCategorie,
  slugCategorieDepuisPath,
} from "@/lib/category-presentation";
import { NAV_ITEMS } from "@/lib/nav-items";
import {
  getSuggestionsRecherche,
  type SuggestionsRecherche,
} from "@/lib/supabase/queries";

const PLACEHOLDER_INTERVAL_MS = 15000;
const SUGGESTIONS_DEBOUNCE_MS = 250;

const SUGGESTIONS_VIDES: SuggestionsRecherche = { produits: [], sousCategories: [] };

export function Header() {
  const router = useRouter();
  // Repli "/" : usePathname() peut être null au premier rendu (layout partagé,
  // pré-rendu) — l'app ouvre toujours sur l'accueil (CORRECTIONS_V7 §2).
  const pathname = usePathname() ?? "/";
  const { identite } = useIdentite();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionsRecherche>(SUGGESTIONS_VIDES);
  const [ouvert, setOuvert] = useState(false);
  const rechercheRef = useRef<HTMLDivElement>(null);

  const placeholders = useMemo(
    () => placeholdersPourCategorie(slugCategorieDepuisPath(pathname)),
    [pathname],
  );

  const placeholderActuel = placeholders[placeholderIndex % placeholders.length];

  const lancerRecherche = (terme: string) => {
    const nettoye = terme.trim();
    if (!nettoye) return;
    setOuvert(false);
    setQuery("");
    router.push(`/recherche?q=${encodeURIComponent(nettoye)}`);
  };

  const allerVers = (href: string) => {
    setOuvert(false);
    setQuery("");
    router.push(href);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % placeholders.length);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [placeholders]);

  // Fermer au clic en dehors et à la touche Échap.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rechercheRef.current?.contains(event.target as Node)) setOuvert(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOuvert(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Suggestions live (produits + sous-catégories), tolérantes aux fautes,
  // rafraîchies à chaque frappe avec un léger debounce. Le panneau n'est de
  // toute façon affiché qu'à partir de 2 caractères (afficherPanneau).
  useEffect(() => {
    const terme = query.trim();
    if (terme.length < 2) return;
    let annule = false;
    const id = setTimeout(() => {
      getSuggestionsRecherche(terme)
        .then((res) => {
          if (!annule) setSuggestions(res);
        })
        .catch(() => {
          if (!annule) setSuggestions(SUGGESTIONS_VIDES);
        });
    }, SUGGESTIONS_DEBOUNCE_MS);
    return () => {
      annule = true;
      clearTimeout(id);
    };
  }, [query]);

  const aDesSuggestions =
    suggestions.produits.length > 0 || suggestions.sousCategories.length > 0;
  const afficherPanneau = ouvert && query.trim().length >= 2;

  // Nav horizontale desktop (lg+) : identique quel que soit l'écran, y compris
  // sur la page Moi qui remplace pourtant la barre du haut.
  const navDesktop = (
    <nav aria-label="Navigation principale" className="hidden border-t border-ink/10 lg:block">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, img }) => {
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
              <NavIcon img={img} icon={Icon} size={16} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );

  // Page Moi : la barre du haut habituelle (logo + recherche + cœur) laisse la
  // place à l'identité du client (avatar + nom + téléphone) et à l'accès
  // Paramètres. Uniquement sur /moi ; les sous-pages gardent le header normal.
  if (pathname === "/moi") {
    return (
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <User size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {identite?.nom || "Client SacAdo"}
            </p>
            {identite?.telephone && (
              <p className="truncate text-xs text-ink/50">{identite.telephone}</p>
            )}
          </div>
          <Link
            href="/moi/parametres"
            aria-label="Paramètres"
            className="shrink-0 rounded-full p-2 text-ink/70 transition-colors duration-150 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-90"
          >
            <Settings size={22} />
          </Link>
        </div>
        {navDesktop}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
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

        <div ref={rechercheRef} className="relative min-w-0 flex-1">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              lancerRecherche(query);
            }}
          >
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOuvert(true);
                }}
                onFocus={() => setOuvert(true)}
                placeholder={placeholderActuel}
                aria-label="Rechercher un produit"
                autoComplete="off"
                className="w-full rounded-lg border border-ink/10 bg-elevated py-2 pl-4 pr-11 text-base text-ink placeholder:text-ink/40 transition-colors duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => lancerRecherche(query || placeholderActuel)}
                aria-label={query.trim() ? "Rechercher" : `Rechercher : ${placeholderActuel}`}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-90"
              >
                <Search size={16} aria-hidden="true" />
              </button>
            </div>
          </form>

          {afficherPanneau && (
            // Suggestions en TEXTE uniquement (CORRECTIONS_V8 §1). Panneau bas et
            // large pour tenir au-dessus du clavier mobile (§2) : max ~42vh,
            // nombre de suggestions limité, scroll interne si besoin.
            <div className="absolute -left-1 -right-1 top-full z-50 mt-1 overflow-hidden rounded-xl border border-ink/10 bg-elevated shadow-lg sm:left-0 sm:right-0">
              {!aDesSuggestions ? (
                <p className="px-4 py-3 text-sm text-ink/50">Aucune suggestion.</p>
              ) : (
                <div className="max-h-[42vh] overflow-y-auto py-1">
                  {suggestions.sousCategories.slice(0, 3).map((sc) => (
                    <button
                      key={`sc-${sc.id}`}
                      type="button"
                      onClick={() => allerVers(`/categorie/${sc.categorie_slug}?sc=${sc.slug}`)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ink/5"
                    >
                      <Tag size={15} className="shrink-0 text-ink/35" aria-hidden="true" />
                      <span className="truncate text-ink">{sc.nom}</span>
                      <span className="shrink-0 text-xs text-ink/40">dans {sc.categorie_nom}</span>
                    </button>
                  ))}

                  {suggestions.produits.slice(0, 5).map((produit) => (
                    <button
                      key={`p-${produit.id}`}
                      type="button"
                      onClick={() => lancerRecherche(produit.nom)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ink/5"
                    >
                      <Search size={15} className="shrink-0 text-ink/35" aria-hidden="true" />
                      <span className="truncate text-ink">{produit.nom}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => lancerRecherche(query)}
                className="flex w-full items-center gap-2 border-t border-ink/10 px-4 py-2.5 text-left text-sm font-medium text-brand transition-colors hover:bg-brand/5"
              >
                <Search size={15} aria-hidden="true" />
                Voir tous les résultats pour «&nbsp;{query.trim()}&nbsp;»
              </button>
            </div>
          )}
        </div>

        {/* Cœur + installer regroupés serré à droite (CORRECTIONS_V8 §3),
            l'espace gagné va à la barre de recherche. */}
        <div className="flex shrink-0 items-center">
          <Link
            href="/favoris"
            aria-label="Favoris"
            className="rounded-full p-2 text-ink transition-colors duration-150 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-90"
          >
            <Heart size={22} />
          </Link>
          <InstallHeaderButton />
        </div>
      </div>

      {/* Desktop (lg+) : la nav vit ici plutôt qu'en bottom nav fixe (voir
          CLAUDE.md section 6 et components/layout/bottom-nav.tsx). */}
      {navDesktop}
    </header>
  );
}
