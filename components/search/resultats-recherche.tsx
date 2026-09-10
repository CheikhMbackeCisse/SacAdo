import { MessageCircle, PackageSearch } from "lucide-react";
import { ProductGrid } from "@/components/product/product-grid";
import { lienWhatsApp } from "@/lib/whatsapp";
import type { ProduitTrouve } from "@/lib/supabase/queries";

const MAX_CATEGORIE = 12;

export function ResultatsRecherche({
  query,
  resultats,
}: {
  query: string;
  resultats: ProduitTrouve[];
}) {
  if (!query) {
    return (
      <p className="px-4 text-sm text-ink/60">
        Tape le nom d&apos;un produit, une marque ou une référence.
      </p>
    );
  }

  const parNom = resultats.filter((p) => p.type_resultat === "nom");
  const parCategorie = resultats
    .filter((p) => p.type_resultat === "categorie")
    .slice(0, MAX_CATEGORIE);

  if (parNom.length === 0 && parCategorie.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <PackageSearch size={26} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-heading text-base font-semibold text-ink">
            Aucun produit ne correspond à « {query} »
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink/60">
            Dis-nous ce que tu cherches, on te répond et on essaie de le faire venir.
          </p>
        </div>
        <a
          href={lienWhatsApp(`Bonjour SacAdo, je cherche : ${query}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand transition-transform active:scale-95"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Demander sur WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {parNom.length > 0 && <ProductGrid produits={parNom} />}

      {parCategorie.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-4 font-heading text-sm font-semibold text-ink/70">
            {parNom.length > 0
              ? "Autres produits de cette catégorie"
              : "Produits de cette catégorie"}
          </h2>
          <ProductGrid produits={parCategorie} />
        </section>
      )}
    </div>
  );
}
