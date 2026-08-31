import { getSousCategoriesAdmin } from "@/lib/admin/sous-categories-actions";
import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { SousCategoriesEditor } from "@/components/admin/sous-categories-editor";

export default async function AdminSousCategoriesPage() {
  const [sousCategories, categories] = await Promise.all([
    getSousCategoriesAdmin(),
    getCategoriesAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Sous-catégories</h1>
        <p className="text-sm text-ink/50">
          Chaque produit peut être rangé dans une sous-catégorie de sa catégorie.
          Sert au tri et aux filtres côté client.
        </p>
      </div>
      <SousCategoriesEditor sousCategories={sousCategories} categories={categories} />
    </div>
  );
}
