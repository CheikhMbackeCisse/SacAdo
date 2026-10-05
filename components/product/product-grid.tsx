import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Produit } from "@/lib/supabase/types";
import { ProductCard } from "./product-card";

type ProductGridProps = {
  produits: Produit[];
  emptyMessage?: string;
  // Étiquette « Pour <prénom> » par produit (accueil multi-bénéficiaires).
  etiquettes?: Record<number, string | null>;
};

export function ProductGrid({ produits, emptyMessage, etiquettes }: ProductGridProps) {
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
    // Seuils en largeur DISPONIBLE (container query sur <main>, voir
    // app-main.tsx), pas en largeur d'écran : la grille se réorganise aussi
    // quand le panneau d'aperçu réduit l'espace à sa droite, sans jamais
    // cacher une carte (contrairement aux anciens seuils `sm:`/`lg:`/...
    // basés sur le viewport, aveugles à cette marge).
    <div className="grid grid-cols-2 gap-3 px-4 @min-[480px]:grid-cols-3 @min-[768px]:grid-cols-4 @min-[1024px]:grid-cols-5 @min-[1150px]:grid-cols-6">
      {produits.map((produit) => (
        <ProductCard key={produit.id} produit={produit} etiquette={etiquettes?.[produit.id]} />
      ))}
    </div>
  );
}
