import { notFound } from "next/navigation";
import { getCategorieBySlug } from "@/lib/categories";
import { getProduitsByCategorie } from "@/lib/supabase/queries";
import { CategoryProductList } from "@/components/category/category-product-list";

// ISR : la page est mise en cache par catégorie et régénérée au plus toutes
// les 2 min, pour ne pas taper Supabase à chaque visite du catalogue (c'est le
// gros du trafic public).
export const revalidate = 120;

export default async function CategoriePage(props: PageProps<"/categorie/[slug]">) {
  const { slug } = await props.params;
  const categorie = getCategorieBySlug(slug);
  if (!categorie || !categorie.categorieDb) notFound();

  const { items: produits, hasMore } = await getProduitsByCategorie(categorie.categorieDb);

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-xl font-bold text-ink">{categorie.nom}</h1>
      <CategoryProductList
        categorieDb={categorie.categorieDb}
        produitsInitiaux={produits}
        hasMoreInitial={hasMore}
        sousCategories={categorie.sousCategories}
      />
    </div>
  );
}
