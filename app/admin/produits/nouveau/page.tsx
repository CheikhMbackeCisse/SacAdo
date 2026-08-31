import { ProduitForm } from "@/components/admin/produit-form";
import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { getSousCategoriesAdmin } from "@/lib/admin/sous-categories-actions";

export default async function NouveauProduitPage() {
  const [categories, sousCategories] = await Promise.all([
    getCategoriesAdmin(),
    getSousCategoriesAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Nouveau produit</h1>
      <ProduitForm categories={categories} sousCategories={sousCategories} />
    </div>
  );
}
