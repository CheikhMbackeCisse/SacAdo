import Link from "next/link";
import { CategoryTile } from "@/components/category/category-tile";
import { hrefCategorie } from "@/lib/category-presentation";
import type { Categorie } from "@/lib/supabase/types";

// Défilement horizontal sur une seule rangée (TACHE_correction_accueil.md) :
// libère la hauteur pour les produits, contrairement à l'ancienne grille 2
// rangées. Largeur de carte fixe (w-[22%]) plutôt qu'une colonne de grille :
// la carte suivante reste toujours visible à moitié en bord d'écran, jamais
// coupée au milieu d'un mot puisque chaque carte est une unité de scroll
// snap-able, pas une frontière de colonne.
export function CategoryScroll({ categories }: { categories: Categorie[] }) {
  return (
    <div className="px-4 pt-5">
      <h2 className="mb-3 font-heading text-base font-semibold text-ink">Catégories</h2>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((categorie) => (
          <Link
            key={categorie.slug}
            href={hrefCategorie(categorie)}
            className="flex w-[22%] shrink-0 snap-start flex-col items-center gap-1 text-center active:scale-95 sm:w-[14%]"
          >
            <CategoryTile categorie={categorie} tileClassName="size-14" iconSize={22} />
            <span className="line-clamp-1 text-[11px] leading-tight text-ink/80">{categorie.nom}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
