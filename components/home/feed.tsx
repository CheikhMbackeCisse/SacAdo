"use client";

import { useMemo, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { entrelacerAccueil } from "@/lib/accueil-multi";
import type { AccueilFeed } from "@/lib/accueil";
import type { Produit } from "@/lib/supabase/types";

const LIMITE = 20;

export function Feed({ feed }: { feed: AccueilFeed }) {
  const [selection, setSelection] = useState<"tous" | number>("tous");

  const beneficiaires = feed.profils.filter((p) => p.source === "beneficiaire");

  const { produits, etiquettes } = useMemo<{
    produits: Produit[];
    etiquettes: Record<number, string | null>;
  }>(() => {
    // Un seul profil sélectionné : sa liste telle quelle.
    if (selection !== "tous") {
      const profil = feed.profils.find((p) => p.id === selection);
      const prenom = profil?.prenom ?? null;
      const etq: Record<number, string | null> = {};
      for (const p of profil?.produits ?? []) etq[p.id] = prenom;
      return { produits: profil?.produits ?? [], etiquettes: etq };
    }

    // « Tous » : entrelacement en tour de rôle (bénéficiaires puis compte).
    const cartes = entrelacerAccueil(
      feed.profils.map((p) => ({
        source: p.source,
        prenom: p.prenom,
        cartes: p.produits.map((prod) => ({ produit: prod, origine: prod.origine })),
      })),
      LIMITE,
    );
    const etq: Record<number, string | null> = {};
    for (const c of cartes) etq[c.produit.id] = c.prenom;
    return { produits: cartes.map((c) => c.produit), etiquettes: etq };
  }, [selection, feed]);

  if (!feed.multi) {
    return <ProductGrid produits={feed.profils[0]?.produits ?? []} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Puce active={selection === "tous"} onClick={() => setSelection("tous")}>
          Tous
        </Puce>
        {beneficiaires.map((b) => (
          <Puce
            key={b.id}
            active={selection === b.id}
            onClick={() => setSelection(b.id as number)}
          >
            {b.prenom}
          </Puce>
        ))}
      </div>
      <ProductGrid produits={produits} etiquettes={etiquettes} />
    </div>
  );
}

function Puce({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-brand bg-brand text-on-brand" : "border-ink/15 text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}
