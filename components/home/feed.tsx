"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { FinDeListe } from "@/components/product/fin-de-liste";
import { DemanderProduit } from "@/components/demande/demander-produit";
import { entrelacerAccueil } from "@/lib/accueil-multi";
import { chargerPageAccueil } from "@/lib/accueil-suite";
import { useChargementAuto } from "@/lib/hooks/use-chargement-auto";
import { useRestaurerDefilement } from "@/lib/hooks/use-restaurer-defilement";
import type { AccueilFeed } from "@/lib/accueil";
import type { Produit } from "@/lib/supabase/types";

const LIMITE = 20;
const PAGE = 20;
const FEED_VIDE: AccueilFeed = { multi: false, profils: [{ source: "compte", id: null, prenom: null, produits: [] }] };

// Sans `feed` initial (page d'accueil servie statique, voir app/(storefront)/page.tsx) :
// le flux personnalisé, qui dépend du cookie `sacado_sid`, est chargé ici
// après l'affichage plutôt que rendu côté serveur — garde la page instantanée
// pour tous les visiteurs, personnalisation incluse une fois arrivée.
export function Feed({ feed: feedInitial }: { feed?: AccueilFeed }) {
  const [feed, setFeed] = useState(feedInitial ?? FEED_VIDE);
  const [taille, setTaille] = useState(LIMITE);
  const [chargement, setChargement] = useState(!feedInitial);
  const [hasMore, setHasMore] = useState(true);
  const [enErreur, setEnErreur] = useState(false);
  const [selection, setSelection] = useState<"tous" | number>("tous");
  const chargeInitial = useRef(Boolean(feedInitial));

  useEffect(() => {
    if (chargeInitial.current) return;
    chargeInitial.current = true;
    chargerPageAccueil(LIMITE, 0)
      .then((initial) => {
        setFeed(initial);
        setHasMore((initial.profils[0]?.produits.length ?? 0) >= LIMITE);
        setChargement(false);
      })
      .catch(() => {
        setChargement(false);
        setEnErreur(true);
      });
  }, []);

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

  // Retour arrière depuis une fiche produit (CORRECTIONS_V11 lot 2).
  useRestaurerDefilement("accueil", taille, async (compte) => {
    const suite = await chargerPageAccueil(compte, 0);
    setFeed(suite);
    setTaille(compte);
    setHasMore((suite.profils[0]?.produits.length ?? 0) >= compte);
  });

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
      {chargement && <ProductGridSkeleton />}
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
        <>
          <FinDeListe />
          <DemanderProduit origine="fin_de_liste" variante="discret" />
        </>
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
