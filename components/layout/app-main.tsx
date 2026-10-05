"use client";

import { usePathname } from "next/navigation";
import { ROUTES_SANS_BOTTOM_NAV } from "@/lib/nav-items";
import { useProductPreview } from "@/components/product/product-preview-context";

// <main> du storefront. Réserve en bas la hauteur de la bottom nav (mobile),
// sauf sur les écrans "tunnel" où la nav est masquée : là, le bouton d'action
// est fixé tout en bas et c'est la page qui gère sa propre gouttière. Plus de
// pied de page légal ici (maj-26-09 §8) : les liens légaux ne vivent plus
// qu'à un seul endroit, Paramètres (voir app/(storefront)/moi/parametres).
//
// Panneau d'aperçu rapide (ordinateur) : au lieu de recouvrir la grille, on
// réserve sa largeur (440 px, ProductPreviewPanel) via une marge droite — le
// contenu se décale à gauche et se réorganise dans l'espace restant.
// `@container` : les grilles produit (ProductGrid) répondent à la largeur
// réellement disponible ici, pas à la largeur de l'écran, donc elles
// continuent de bien se réorganiser même quand cette marge change.
export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const sansNav = ROUTES_SANS_BOTTOM_NAV.includes(pathname);
  const { produitId } = useProductPreview();
  const panneauOuvert = produitId !== null;

  return (
    <main
      id="main-content"
      // `lg:` sur la largeur/marge : jamais appliquées sous 1024 px, même si
      // le panneau garde un produitId en mémoire après un redimensionnement
      // de fenêtre (le panneau lui-même se masque déjà via `hidden lg:block`).
      // `w-[min(72rem,calc(100%-440px))]` plutôt que `max-w-6xl` + `mr-[440px]` :
      // avec une largeur à 100% explicite ET une marge droite fixe, les deux
      // se sur-contraignent (la marge gauche auto s'effondre à 0 et la boîte
      // déborde SOUS le panneau au lieu de rétrécir). En calculant la largeur
      // elle-même, l'équation largeur + marge reste toujours cohérente : la
      // boîte vient se caler exactement contre le panneau, sans trou ni
      // chevauchement, quelle que soit la largeur d'écran.
      className={`@container mx-auto flex w-full max-w-6xl flex-1 flex-col transition-[width,margin-right] duration-200 ${
        panneauOuvert ? "lg:w-[min(72rem,calc(100%-440px))] lg:mr-[440px]" : ""
      } ${sansNav ? "" : "pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"}`}
    >
      {children}
    </main>
  );
}
