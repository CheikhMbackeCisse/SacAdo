import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getCategorieBySlug,
  getProduitsByCategorie,
  getSousCategoriesByCategorie,
  getSousSousCategoriesBySousCategories,
} from "@/lib/supabase/queries";
import { CategoryProductList } from "@/components/category/category-product-list";

// ISR : la page est mise en cache par catégorie et régénérée au plus toutes
// les 2 min, pour ne pas taper Supabase à chaque visite du catalogue (c'est le
// gros du trafic public). Le filtre par sous-catégorie / sous-sous-catégorie
// (?sc=, ?ssc=) est appliqué côté client, sans casser ce cache.
export const revalidate = 120;

export default async function CategoriePage(props: PageProps<"/categorie/[slug]">) {
  const { slug } = await props.params;
  const categorie = await getCategorieBySlug(slug);
  // "kits" est une catégorie du référentiel mais son parcours est dédié (/kits).
  if (!categorie || !categorie.actif || categorie.slug === "kits") notFound();

  const [{ items: produits, hasMore }, sousCategories] = await Promise.all([
    getProduitsByCategorie(categorie.id),
    getSousCategoriesByCategorie(categorie.id),
  ]);
  // 3e niveau (optionnel) : chargé après coup, on connaît déjà les sous-catégories.
  const sousSousCategories = await getSousSousCategoriesBySousCategories(
    sousCategories.map((sc) => sc.id),
  );

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-xl font-bold text-ink">{categorie.nom}</h1>
      <Suspense fallback={null}>
        <CategoryProductList
          categorieId={categorie.id}
          produitsInitiaux={produits}
          hasMoreInitial={hasMore}
          sousCategories={sousCategories}
          sousSousCategories={sousSousCategories}
        />
      </Suspense>
    </div>
  );
}
