"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Clock,
  Heart,
  LayoutGrid,
  MessageCircle,
  Search,
  Settings,
  Tag,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavIcon } from "@/components/layout/nav-icon";
import { InstallHeaderButton } from "@/components/pwa/install-header-button";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";
import { useIdentite } from "@/lib/local/identite";
import { useRecherchesRecentes } from "@/lib/local/recherches";
import { lienRechercheSansResultat } from "@/lib/whatsapp";
import {
  placeholdersPourCategorie,
  slugCategorieDepuisPath,
} from "@/lib/category-presentation";
import { NAV_ITEMS } from "@/lib/nav-items";
import {
  getSuggestionsRecherche,
  rechercherProduits,
  type ProduitTrouve,
  type SuggestionsRecherche,
} from "@/lib/supabase/queries";

const PLACEHOLDER_INTERVAL_MS = 15000;
const SUGGESTIONS_DEBOUNCE_MS = 250;

const SUGGESTIONS_VIDES: SuggestionsRecherche = {
  produits: [],
  categories: [],
  sousCategories: [],
  sousSousCategories: [],
};

export function Header() {
  const router = useRouter();
  // Repli "/" : usePathname() peut être null au premier rendu (layout partagé,
  // pré-rendu) — l'app ouvre toujours sur l'accueil (CORRECTIONS_V7 §2).
  const pathname = usePathname() ?? "/";
  const { identite } = useIdentite();
  const { recherches, enregistrer, vider } = useRecherchesRecentes();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [query, setQuery] = useState("");
  // Rayons (catégorie / sous-catégorie / 3e niveau) : RPC suggestions_recherche.
  const [rayons, setRayons] = useState<SuggestionsRecherche>(SUGGESTIONS_VIDES);
  // Produits : recherche v2 (ET obligatoire + synonymes) — "bic" sort les stylos.
  const [produits, setProduits] = useState<ProduitTrouve[]>([]);
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
    enregistrer(nettoye);
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

  // Suggestions live (produits v2 + rayons), rafraîchies à chaque frappe avec
  // un léger debounce. Le panneau n'est affiché qu'à partir de 2 caractères.
  useEffect(() => {
    const terme = query.trim();
    if (terme.length < 2) return;
    let annule = false;
    const id = setTimeout(() => {
      rechercherProduits(terme, { limite: 6 })
        .then((res) => {
          if (!annule) setProduits(res);
        })
        .catch(() => {
          if (!annule) setProduits([]);
        });
      getSuggestionsRecherche(terme)
        .then((res) => {
          if (!annule) setRayons(res);
        })
        .catch(() => {
          if (!annule) setRayons(SUGGESTIONS_VIDES);
        });
    }, SUGGESTIONS_DEBOUNCE_MS);
    return () => {
      annule = true;
      clearTimeout(id);
    };
  }, [query]);

  const termeSaisi = query.trim();
  const modeHistorique = ouvert && termeSaisi.length === 0 && recherches.length > 0;
  const modeSuggestions = ouvert && termeSaisi.length >= 2;

  const produitsParNom = produits.filter((p) => p.type_resultat === "nom");
  const produitsParCategorie = produits.filter((p) => p.type_resultat === "categorie");
  const aDesRayons =
    rayons.categories.length > 0 ||
    rayons.sousCategories.length > 0 ||
    rayons.sousSousCategories.length > 0;
  const aDesResultats = produits.length > 0 || aDesRayons;

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

          {(modeHistorique || modeSuggestions) && (
            // Panneau bas et large pour tenir au-dessus du clavier mobile.
            <div className="absolute -left-12 -right-12 top-full z-50 mt-1 overflow-hidden rounded-xl border border-ink/10 bg-elevated shadow-lg sm:-left-16 sm:-right-16">
              {modeHistorique && (
                <div className="py-1">
                  <div className="flex items-center justify-between px-4 py-1.5">
                    <span className="text-xs font-medium text-ink/50">Recherches récentes</span>
                    <button
                      type="button"
                      onClick={vider}
                      className="text-xs text-ink/40 hover:text-ink"
                    >
                      Effacer
                    </button>
                  </div>
                  {recherches.map((terme) => (
                    <button
                      key={terme}
                      type="button"
                      onClick={() => lancerRecherche(terme)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ink/5"
                    >
                      <Clock size={15} className="shrink-0 text-ink/35" aria-hidden="true" />
                      <span className="truncate text-ink">{terme}</span>
                    </button>
                  ))}
                </div>
              )}

              {modeSuggestions && !aDesResultats && (
                <div className="flex flex-col items-start gap-2 px-4 py-3">
                  <p className="text-sm text-ink/60">
                    Aucun produit ne correspond à «&nbsp;{termeSaisi}&nbsp;».
                  </p>
                  <a
                    href={lienRechercheSansResultat(termeSaisi)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                  >
                    <MessageCircle size={15} aria-hidden="true" />
                    Demander sur WhatsApp
                  </a>
                </div>
              )}

              {modeSuggestions && aDesResultats && (
                <div className="max-h-[46vh] overflow-y-auto py-1">
                  {/* Rayons d'abord (aident à affiner un terme large). */}
                  {rayons.categories.slice(0, 3).map((c) => (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      onClick={() => allerVers(`/categorie/${c.slug}`)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ink/5"
                    >
                      <LayoutGrid size={15} className="shrink-0 text-ink/35" aria-hidden="true" />
                      <span className="truncate text-ink">{c.nom}</span>
                    </button>
                  ))}

                  {rayons.sousCategories.slice(0, 3).map((sc) => (
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

                  {rayons.sousSousCategories.slice(0, 3).map((ssc) => (
                    <button
                      key={`ssc-${ssc.id}`}
                      type="button"
                      onClick={() =>
                        allerVers(
                          `/categorie/${ssc.categorie_slug}?sc=${ssc.sous_categorie_slug}&ssc=${ssc.slug}`,
                        )
                      }
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ink/5"
                    >
                      <Tag size={15} className="shrink-0 text-ink/35" aria-hidden="true" />
                      <span className="truncate text-ink">{ssc.nom}</span>
                      <span className="shrink-0 text-xs text-ink/40">
                        dans {ssc.categorie_nom} › {ssc.sous_categorie_nom}
                      </span>
                    </button>
                  ))}

                  {/* Produits : d'abord ceux dont la désignation matche, puis
                      « autres produits de cette catégorie ». Un tap va direct
                      à la fiche produit. */}
                  {produitsParNom.map((p) => (
                    <SuggestionProduitLigne
                      key={`p-${p.id}`}
                      produit={p}
                      onSelect={() => allerVers(`/produit/${p.id}`)}
                    />
                  ))}

                  {produitsParCategorie.length > 0 && (
                    <p className="px-4 pb-1 pt-2 text-xs font-medium text-ink/40">
                      Autres produits de cette catégorie
                    </p>
                  )}
                  {produitsParCategorie.map((p) => (
                    <SuggestionProduitLigne
                      key={`p-${p.id}`}
                      produit={p}
                      onSelect={() => allerVers(`/produit/${p.id}`)}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => lancerRecherche(query)}
                    className="flex w-full items-center gap-2 border-t border-ink/10 px-4 py-2.5 text-left text-sm font-medium text-brand transition-colors hover:bg-brand/5"
                  >
                    <Search size={15} aria-hidden="true" />
                    Voir tous les résultats pour «&nbsp;{termeSaisi}&nbsp;»
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cœur + installer regroupés serré à droite, l'espace gagné va à la
            barre de recherche. */}
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

      {/* Desktop (lg+) : la nav vit ici plutôt qu'en bottom nav fixe. */}
      {navDesktop}
    </header>
  );
}

function SuggestionProduitLigne({
  produit,
  onSelect,
}: {
  produit: ProduitTrouve;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-ink/5"
    >
      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ink/5">
        <ProductImage src={produit.photo} alt={produit.nom} className="h-full w-full" sizes="44px" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm text-ink">{produit.nom}</span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-ink/70">{formatPrice(produit.prix)}</span>
          <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
            {produit.delai}
          </span>
        </span>
      </span>
    </button>
  );
}
