"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { modifierImagesMosaique } from "@/lib/admin/kits-actions";
import { ProductImage } from "@/components/ui/product-image";
import type { KitItemAvecProduit } from "@/lib/admin/kits-actions";

// « choisir les 4 images du kit parmi ses produits » — ADMIN.md Lot 2.
export function MosaiqueKit({
  kitId,
  items,
  imagesInitiales,
}: {
  kitId: number;
  items: KitItemAvecProduit[];
  imagesInitiales: number[] | null;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<number[]>(imagesInitiales ?? []);
  const [enregistrement, setEnregistrement] = useState(false);

  // Un produit par ligne (pas de doublon si le même produit apparaît 2 fois).
  const produitsUniques = new Map(items.map((it) => [it.produit_id, it]));

  const basculer = async (produitId: number) => {
    const deja = selection.includes(produitId);
    const next = deja
      ? selection.filter((id) => id !== produitId)
      : selection.length >= 4
        ? selection
        : [...selection, produitId];
    if (next === selection) return;
    setSelection(next);
    setEnregistrement(true);
    await modifierImagesMosaique(kitId, next);
    setEnregistrement(false);
    router.refresh();
  };

  if (produitsUniques.size === 0) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">
        Mosaïque d&apos;images ({selection.length}/4) {enregistrement && <span className="text-ink/40">…</span>}
      </h2>
      <p className="text-xs text-ink/45">
        Choisis jusqu&apos;à 4 photos parmi les produits du kit pour la mosaïque affichée sur la fiche.
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {[...produitsUniques.values()].map((item) => {
          const choisi = selection.includes(item.produit_id);
          return (
            <button
              key={item.produit_id}
              type="button"
              onClick={() => basculer(item.produit_id)}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                choisi ? "border-brand" : "border-transparent"
              }`}
              title={item.produit_nom}
            >
              <ProductImage src={item.produit_photo} alt={item.produit_nom} className="h-full w-full" sizes="80px" />
              {choisi && (
                <span className="absolute right-1 top-1 rounded-full bg-brand p-0.5 text-surface">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
