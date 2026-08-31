import { notFound } from "next/navigation";
import {
  getCategorieById,
  getProduitById,
  getProduitsSimilaires,
  getVariantesByProduit,
} from "@/lib/supabase/queries";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductGrid } from "@/components/product/product-grid";

// ISR : évite de retaper Supabase à chaque visite d'une fiche produit (trafic
// public le plus fréquent après le catalogue).
export const revalidate = 120;

export default async function ProduitPage(props: PageProps<"/produit/[id]">) {
  const { id } = await props.params;
  const produitId = Number(id);
  if (!Number.isFinite(produitId)) notFound();

  const produit = await getProduitById(produitId);
  if (!produit) notFound();

  const [variantes, similaires, categorie] = await Promise.all([
    getVariantesByProduit(produit.id),
    getProduitsSimilaires(produit.categorie_id, produit.id),
    getCategorieById(produit.categorie_id),
  ]);

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 pb-8">
      <ProductDetail
        produit={produit}
        variantes={variantes}
        categorieNom={categorie?.nom ?? null}
      />

      {similaires.length > 0 && (
        <section>
          <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">
            Vous aimerez aussi
          </h2>
          <ProductGrid produits={similaires} />
        </section>
      )}
    </div>
  );
}
