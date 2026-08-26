import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Produit } from "@/lib/supabase/types";
import { ProductCard } from "./product-card";

type ProductGridProps = {
  produits: Produit[];
  emptyMessage?: string;
};

export function ProductGrid({ produits, emptyMessage }: ProductGridProps) {
  if (produits.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Aucun résultat"
        description={emptyMessage ?? "Aucun produit trouvé."}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {produits.map((produit) => (
        <ProductCard key={produit.id} produit={produit} />
      ))}
    </div>
  );
}
