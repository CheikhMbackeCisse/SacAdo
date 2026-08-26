"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { formatPrice } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import { useConsultes } from "@/lib/local/consultes";
import type { Produit, ProduitVariante } from "@/lib/supabase/types";

type ProductDetailProps = {
  produit: Produit;
  variantes: ProduitVariante[];
};

export function ProductDetail({ produit, variantes }: ProductDetailProps) {
  const { ajouter } = usePanier();
  const { recordConsulte } = useConsultes();
  const [selectedId, setSelectedId] = useState<number | null>(
    variantes.length === 1 ? variantes[0].id : null,
  );
  const [quantite, setQuantite] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    recordConsulte(produit.id);
    // On ne veut relancer l'enregistrement que si le produit affiché change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produit.id]);

  // Le modèle ne gère qu'une seule dimension de variante à la fois (couleur
  // OU taille) — voir MODELE_DONNEES.md.
  const dimension: "couleur" | "taille" | null = variantes[0]?.couleur
    ? "couleur"
    : variantes[0]?.taille
      ? "taille"
      : null;

  const selectedVariante = variantes.find((v) => v.id === selectedId) ?? null;
  // Une seule photo par produit/variante dans le modèle actuel : pas de vraie
  // galerie multi-images tant que ce champ n'est pas étendu.
  const photo = selectedVariante?.photo ?? produit.photo;
  const prix = selectedVariante?.prix ?? produit.prix;

  const varianteEpuisee = variantes.length > 0 && selectedVariante?.statut === "epuise";
  const produitEpuise = produit.statut === "epuise";
  const peutAjouter =
    !produitEpuise && !varianteEpuisee && (variantes.length === 0 || selectedVariante !== null);

  const handleAjouter = () => {
    if (!peutAjouter) return;
    ajouter(produit.id, selectedVariante?.id ?? null, quantite);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full bg-ink/5">
        <ProductImage src={photo} alt={produit.nom} className="h-full w-full" />
        <div className="absolute right-3 top-3">
          <FavoriteButton produitId={produit.id} size={20} />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink/40">
            {produit.categorie}
          </span>
          <h1 className="font-heading text-lg font-bold text-ink">{produit.nom}</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-ink">{formatPrice(prix)}</span>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/60">
            Livraison {produit.delai}
          </span>
        </div>

        {dimension && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink/60">
              {dimension === "couleur" ? "Couleur" : "Taille"}
            </span>
            <div className="flex flex-wrap gap-2">
              {variantes.map((variante) => {
                const label = dimension === "couleur" ? variante.couleur : variante.taille;
                const disabled = variante.statut === "epuise";
                const active = variante.id === selectedId;
                return (
                  <button
                    key={variante.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedId(variante.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      disabled
                        ? "cursor-not-allowed border-ink/10 text-ink/25 line-through"
                        : active
                          ? "border-brand bg-brand text-surface"
                          : "border-ink/15 text-ink/70"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!selectedVariante && (
              <span className="text-[11px] text-ink/40">
                Choisis une option avant d&apos;ajouter au panier.
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-ink/60">Quantité</span>
          <div className="flex items-center gap-3 rounded-full border border-ink/15 px-2 py-1">
            <button
              type="button"
              aria-label="Diminuer la quantité"
              onClick={() => setQuantite((q) => Math.max(1, q - 1))}
              className="flex size-6 items-center justify-center rounded-full text-ink/70 active:scale-90"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="w-4 text-center text-sm">{quantite}</span>
            <button
              type="button"
              aria-label="Augmenter la quantité"
              onClick={() => setQuantite((q) => q + 1)}
              className="flex size-6 items-center justify-center rounded-full text-ink/70 active:scale-90"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={!peutAjouter}
          onClick={handleAjouter}
          className="mt-1 flex h-12 items-center justify-center rounded-full bg-action text-sm font-semibold text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
        >
          {produitEpuise || varianteEpuisee
            ? "Épuisé"
            : added
              ? "Ajouté ✓"
              : "Ajouter au panier"}
        </button>
      </div>
    </div>
  );
}
