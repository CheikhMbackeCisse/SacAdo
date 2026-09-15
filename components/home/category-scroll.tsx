import Link from "next/link";
import { CategoryTile } from "@/components/category/category-tile";
import { hrefCategorie } from "@/lib/category-presentation";
import type { Categorie } from "@/lib/supabase/types";

// Grille 2 rangées x 5 colonnes en scroll horizontal : auto-cols-[28%] laisse
// ~3.5 colonnes visibles sur mobile (3 pleines + amorce de la 4e), conforme à
// MODELE_DONNEES.md.
export function CategoryScroll({ categories }: { categories: Categorie[] }) {
  return (
    <div className="px-4 pt-2">
      <h2 className="mb-1 font-heading text-base font-semibold text-ink">Catégories</h2>
      <div className="grid auto-cols-[28%] grid-flow-col grid-rows-2 gap-x-2 gap-y-1 overflow-x-auto pb-1 [scrollbar-width:none] sm:auto-cols-[18%] [&::-webkit-scrollbar]:hidden">
        {categories.map((categorie) => (
          <Link
            key={categorie.slug}
            href={hrefCategorie(categorie)}
            className="flex flex-col items-center gap-1 text-center active:scale-95"
          >
            <CategoryTile categorie={categorie} tileClassName="size-14" iconSize={22} />
            <span className="line-clamp-1 text-[11px] leading-tight text-ink/80">{categorie.nom}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
