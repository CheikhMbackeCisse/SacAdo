"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { usePanierDetaille } from "@/lib/local/use-panier-detaille";
import { PanierLine } from "@/components/panier/panier-line";
import { FreeShippingProgress } from "@/components/panier/free-shipping-progress";
import { formatPrice } from "@/lib/format";

export default function PanierPage() {
  const router = useRouter();
  const { detail, sousTotal, loading, retirer, setQuantite } = usePanierDetaille();

  if (loading) {
    return <p className="px-4 py-12 text-center text-sm text-ink/50">Chargement…</p>;
  }

  if (detail.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <ShoppingCart size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">Ton panier est vide</h1>
        <p className="max-w-xs text-sm text-ink/60">
          Parcours le catalogue pour ajouter des fournitures.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-surface active:scale-95"
        >
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-6">
      <h1 className="font-heading text-xl font-bold text-ink">Mon panier</h1>

      <FreeShippingProgress sousTotal={sousTotal} />

      <div className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white px-3">
        {detail.map((ligne) => (
          <PanierLine
            key={`${ligne.produit.id}-${ligne.variante?.id ?? "base"}`}
            ligne={ligne}
            onQuantiteChange={(q) => setQuantite(ligne.produit.id, ligne.variante?.id ?? null, q)}
            onRetirer={() => retirer(ligne.produit.id, ligne.variante?.id ?? null)}
          />
        ))}
      </div>

      <div className="sticky bottom-16 z-30 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-ink/50">Sous-total</span>
            <span className="text-sm font-semibold text-ink">{formatPrice(sousTotal)}</span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="flex h-11 items-center justify-center rounded-full bg-action px-6 text-sm font-semibold text-ink transition-transform active:scale-95"
          >
            Commander
          </button>
        </div>
      </div>
    </div>
  );
}
