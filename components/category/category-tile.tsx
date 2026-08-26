import type { Categorie } from "@/lib/categories";
import { CategoryImage } from "./category-image";

type CategoryTileProps = {
  categorie: Categorie;
  tileClassName: string;
  iconSize: number;
};

// Tuile photo pour une catégorie, avec repli sur l'icône Lucide tant que la
// vraie photo n'est pas fournie (CLAUDE.md section 7). Composant serveur :
// l'icône (fonction) ne peut pas traverser la frontière serveur/client, donc
// seule la partie image (CategoryImage) est un Client Component.
export function CategoryTile({ categorie, tileClassName, iconSize }: CategoryTileProps) {
  const { nom, icon: Icon, image } = categorie;

  if (image) {
    return (
      <span className={`relative overflow-hidden rounded-2xl bg-ink/5 ${tileClassName}`}>
        <CategoryImage src={image} alt={nom} />
      </span>
    );
  }

  return (
    <span className={`flex items-center justify-center rounded-2xl bg-brand/10 text-brand ${tileClassName}`}>
      <Icon size={iconSize} aria-hidden="true" />
    </span>
  );
}
