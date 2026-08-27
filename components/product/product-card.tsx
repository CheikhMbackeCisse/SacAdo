"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { formatPrice } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import type { Produit } from "@/lib/supabase/types";

export function ProductCard({ produit }: { produit: Produit }) {
  const { ajouter } = usePanier();
  const [added, setAdded] = useState(false);
  const epuise = produit.statut === "epuise";

  return (
    <Link
      href={`/produit/${produit.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-elevated transition-shadow hover:shadow-md ${
        epuise ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-square w-full">
        <ProductImage src={produit.photo} alt={produit.nom} className="h-full w-full" />

        <span className="absolute left-2 top-2 rounded-full bg-elevated/90 px-2 py-0.5 text-[10px] font-medium text-ink/70 shadow-sm">
          {produit.delai}
        </span>

        <div className="absolute right-2 top-2">
          <FavoriteButton produitId={produit.id} />
        </div>

        {epuise && (
          <div className="absolute inset-0 flex items-center justify-center bg-elevated/70">
            <span className="rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-on-brand">
              Épuisé
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="line-clamp-1 text-sm text-ink">{produit.nom}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink/70">{formatPrice(produit.prix)}</span>
          <button
            type="button"
            disabled={epuise}
            aria-label="Ajouter au panier"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (epuise) return;
              ajouter(produit.id, null, 1);
              setAdded(true);
              setTimeout(() => setAdded(false), 1200);
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-action text-on-action transition-transform active:scale-90 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
          >
            {added ? (
              <span className="text-xs leading-none">✓</span>
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
