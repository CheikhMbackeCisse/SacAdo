import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { getSousCategoriesAdmin } from "@/lib/admin/sous-categories-actions";
import { getSousSousCategoriesAdmin } from "@/lib/admin/sous-sous-categories-actions";
import { CategoriesTreeEditor } from "@/components/admin/categories-tree-editor";

// Arborescence complète Catégorie -> Sous-catégorie -> Sous-sous-catégorie (3e
// niveau optionnel) au même endroit (SOUS_SOUS_CATEGORIES.md §4). Remplace les
// anciens écrans séparés « Catégories » / « Sous-catégories ».
export default async function AdminCategoriesPage() {
  const [categories, sousCategories, sousSousCategories] = await Promise.all([
    getCategoriesAdmin(),
    getSousCategoriesAdmin(),
    getSousSousCategoriesAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Catégories</h1>
        <p className="text-sm text-ink/50">
          Toute l&apos;arborescence du catalogue : catégories, leurs sous-catégories et,
          quand c&apos;est utile, un 3e niveau. Déplier une catégorie pour voir et gérer
          ses sous-catégories.
        </p>
      </div>
      <CategoriesTreeEditor
        categories={categories}
        sousCategories={sousCategories}
        sousSousCategories={sousSousCategories}
      />
    </div>
  );
}
