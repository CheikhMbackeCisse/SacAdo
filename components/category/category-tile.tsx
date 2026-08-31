import { createElement } from "react";
import { iconePourCategorie } from "@/lib/category-presentation";
import type { Categorie } from "@/lib/supabase/types";
import { CategoryImage } from "./category-image";

type CategoryTileProps = {
  categorie: Pick<Categorie, "slug" | "nom" | "image">;
  tileClassName: string;
  iconSize: number;
};

// Tuile photo pour une catégorie, avec repli sur l'icône Lucide tant que la
// vraie photo n'est pas fournie (CLAUDE.md section 7). Composant serveur :
// l'icône (fonction) ne peut pas traverser la frontière serveur/client, donc
// seule la partie image (CategoryImage) est un Client Component.
export function CategoryTile({ categorie, tileClassName, iconSize }: CategoryTileProps) {
  const { nom, slug, image } = categorie;

  if (image) {
    return (
      <span className={`relative overflow-hidden rounded-2xl bg-ink/5 ${tileClassName}`}>
        <CategoryImage src={image} alt={nom} />
      </span>
    );
  }

  // createElement plutôt que <Icon/> : l'icône vient d'un lookup, pas d'un import
  // stable, ce que la règle react-hooks/static-components interdit en JSX direct.
  return (
    <span className={`flex items-center justify-center rounded-2xl bg-brand/10 text-brand ${tileClassName}`}>
      {createElement(iconePourCategorie(slug), { size: iconSize, "aria-hidden": true })}
    </span>
  );
}
