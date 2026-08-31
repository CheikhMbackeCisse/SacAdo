import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { CategoriesEditor } from "@/components/admin/categories-editor";

export default async function AdminCategoriesPage() {
  const categories = await getCategoriesAdmin();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Catégories</h1>
        <p className="text-sm text-ink/50">
          Le référentiel des catégories du catalogue. Réordonner, renommer,
          masquer (désactiver) ou ajouter une catégorie.
        </p>
      </div>
      <CategoriesEditor categories={categories} />
    </div>
  );
}
