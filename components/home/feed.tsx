"use client";

import { useCallback, useMemo, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { DemanderProduit } from "@/components/demande/demander-produit";
import { entrelacerAccueil } from "@/lib/accueil-multi";
import { chargerPageAccueil } from "@/lib/accueil-suite";
import { useChargementAuto } from "@/lib/hooks/use-chargement-auto";
import type { AccueilFeed } from "@/lib/accueil";
import type { Produit } from "@/lib/supabase/types";

const LIMITE = 20;
const PAGE = 20;

export function Feed({ feed: feedInitial }: { feed: AccueilFeed }) {
  const [feed, setFeed] = useState(feedInitial);
  const [taille, setTaille] = useState(LIMITE);
  const [chargement, setChargement] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [enErreur, setEnErreur] = useState(false);
  const [selection, setSelection] = useState<"tous" | number>("tous");

  // Chargement continu (maj-accueil §6) : descendre en bas de l'accueil
  // recalcule le flux avec une limite plus grande (même graine de session,
  // donc même début) et n'en garde que la queue nouvellement révélée.
  const chargerSuite = useCallback(() => {
    setChargement(true);
    setEnErreur(false);
    const nouvelleTaille = taille + PAGE;
    chargerPageAccueil(nouvelleTaille, taille)
      .then((suite) => {
        const compteAvant = feed.profils[0]?.produits.length ?? 0;
        const compteApres = suite.profils[0]?.produits.length ?? 0;
        setFeed(suite);
        setTaille(nouvelleTaille);
        setHasMore(compteApres > compteAvant);
        setChargement(false);
      })
      .catch(() => {
        setChargement(false);
        setEnErreur(true);
      });
  }, [taille, feed]);

  const sentinelleRef = useChargementAuto(hasMore && !chargement && !enErreur, chargerSuite);

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
      taille,
    );
    const etq: Record<number, string | null> = {};
    for (const c of cartes) etq[c.produit.id] = c.prenom;
    return { produits: cartes.map((c) => c.produit), etiquettes: etq };
  }, [selection, feed, taille]);

  const piedDeListe = (
    <>
      <div ref={sentinelleRef} aria-hidden="true" />
      {chargement && <p className="pb-2 text-center text-xs text-ink/40">Chargement…</p>}
      {enErreur && !chargement && (
        <button
          type="button"
          onClick={chargerSuite}
          className="mx-auto mb-2 flex h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-xs font-medium text-ink/70"
        >
          Charger plus
        </button>
      )}
      {!hasMore && !chargement && (produits.length > 0 || feed.profils[0]?.produits.length) && (
        <DemanderProduit origine="fin_de_liste" variante="discret" />
      )}
    </>
  );

  if (!feed.multi) {
    return (
      <>
        <ProductGrid produits={feed.profils[0]?.produits ?? []} />
        {piedDeListe}
      </>
    );
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
      {piedDeListe}
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
