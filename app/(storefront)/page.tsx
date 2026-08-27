import { CategoryScroll } from "@/components/home/category-scroll";
import { ProductGrid } from "@/components/product/product-grid";
import { getPopulaires } from "@/lib/supabase/queries";

// Revalide toutes les 60s : sans ça, Next prérend "Populaires" une seule fois
// au build et le stock/statut affiché fige jusqu'au prochain déploiement.
export const revalidate = 60;

export default async function Home() {
  const populaires = await getPopulaires(8);

  return (
    <div className="flex flex-col pb-6">
      <CategoryScroll />
      <section className="mt-4">
        <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">Populaires</h2>
        <ProductGrid produits={populaires} />
      </section>
    </div>
  );
}
