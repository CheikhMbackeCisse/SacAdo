import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";
import { libelleVariante } from "@/lib/variantes";
import type { LigneDetaillee } from "@/lib/local/use-panier-detaille";

type PanierLineProps = {
  ligne: LigneDetaillee;
  onQuantiteChange: (quantite: number) => void;
  onRetirer: () => void;
};

export function PanierLine({ ligne, onQuantiteChange, onRetirer }: PanierLineProps) {
  const { produit, variante, quantite, prixUnitaire, totalLigne } = ligne;
  const label = variante ? libelleVariante(variante) || null : null;

  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/produit/${produit.id}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl">
        <ProductImage
          src={variante?.photo ?? produit.photo}
          alt={produit.nom}
          className="h-full w-full"
          sizes="64px"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/produit/${produit.id}`} className="truncate text-sm text-ink">
          {produit.nom}
        </Link>
        {label && <span className="text-xs text-ink/50">{label}</span>}
        <span className="text-xs font-semibold text-ink/70">{formatPrice(prixUnitaire)}</span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <button
          type="button"
          aria-label="Retirer du panier"
          onClick={onRetirer}
          className="text-ink/40 transition-colors hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-ink/15 px-1.5 py-1">
          <button
            type="button"
            aria-label="Diminuer la quantité"
            onClick={() => onQuantiteChange(quantite - 1)}
            className="flex size-6 items-center justify-center rounded-full text-ink/70 active:scale-90"
          >
            <Minus size={13} aria-hidden="true" />
          </button>
          <span className="w-4 text-center text-sm">{quantite}</span>
          <button
            type="button"
            aria-label="Augmenter la quantité"
            onClick={() => onQuantiteChange(quantite + 1)}
            className="flex size-6 items-center justify-center rounded-full text-ink/70 active:scale-90"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <span className="w-16 shrink-0 text-right text-xs font-semibold text-ink">
        {formatPrice(totalLigne)}
      </span>
    </div>
  );
}
