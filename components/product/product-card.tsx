"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { formatPrice } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import { slugAvecId } from "@/lib/slug";
import { logoMarque } from "@/lib/marques";
import type { Produit } from "@/lib/supabase/types";

export function ProductCard({
  produit,
  etiquette,
}: {
  produit: Produit;
  // Prénom du bénéficiaire d'où vient la recommandation (accueil multi-profils).
  etiquette?: string | null;
}) {
  const { ajouter } = usePanier();
  const [added, setAdded] = useState(false);
  const epuise = produit.statut === "epuise";
  const logo = logoMarque(produit.marque);

  return (
    <Link
      href={`/produits/${slugAvecId(produit.nom, produit.id)}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-elevated transition-shadow hover:shadow-md ${
        epuise ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-square w-full bg-ink/5">
        <ProductImage src={produit.photo} alt={produit.nom} className="h-full w-full" fit="contain" />

        <div className="absolute right-2 top-2">
          <FavoriteButton produitId={produit.id} />
        </div>

        {etiquette && (
          <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-brand/90 px-2 py-0.5 text-[10px] font-medium text-on-brand shadow-sm">
            Pour {etiquette}
          </span>
        )}

        {epuise && (
          <div className="absolute inset-0 flex items-center justify-center bg-elevated/70">
            <span className="rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-on-brand">
              Épuisé
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2">
        {/* 2 lignes max, police réduite si la désignation est longue (sinon
            elle pousse le prix/bouton hors du cadre de la carte) ; le nom
            complet reste visible sur la fiche produit (toute la carte est
            un lien). */}
        {logo && (
          // Logo de marque : montre que le prix correspond à la marque
          // (maj-26-09 §4). Décoratif seul (le nom porte déjà la marque en
          // texte) — jamais le logo d'une autre marque.
          <Image src={logo} alt="" aria-hidden="true" width={48} height={14} className="h-3.5 w-auto object-contain" />
        )}
        <p
          className={`line-clamp-2 text-ink ${
            produit.nom.length > 30 ? "text-xs" : "text-sm"
          }`}
        >
          {produit.nom}
        </p>
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
