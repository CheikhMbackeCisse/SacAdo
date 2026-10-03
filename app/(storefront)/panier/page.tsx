"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { usePanierDetaille, type LigneDetaillee } from "@/lib/local/use-panier-detaille";
import type { GroupeKitPanier, LignePanier } from "@/lib/local/panier";
import { useAjoutMode } from "@/lib/local/ajout-mode";
import { PanierLine } from "@/components/panier/panier-line";
import { PanierKitCard } from "@/components/panier/panier-kit-card";
import { FreeShippingProgress } from "@/components/panier/free-shipping-progress";
import { formatPrice } from "@/lib/format";

type GroupeAffichage = { groupe: GroupeKitPanier; lignes: LigneDetaillee[] };

function regrouperParKit(detail: LigneDetaillee[]): {
  groupes: GroupeAffichage[];
  horsGroupe: LigneDetaillee[];
} {
  const groupesMap = new Map<string, GroupeAffichage>();
  const horsGroupe: LigneDetaillee[] = [];
  for (const ligne of detail) {
    if (ligne.groupe) {
      const existant = groupesMap.get(ligne.groupe.id);
      if (existant) {
        existant.lignes.push(ligne);
      } else {
        groupesMap.set(ligne.groupe.id, { groupe: ligne.groupe, lignes: [ligne] });
      }
    } else {
      horsGroupe.push(ligne);
    }
  }
  return { groupes: [...groupesMap.values()], horsGroupe };
}

export default function PanierPage() {
  const router = useRouter();
  const { mode: modeAjout } = useAjoutMode();
  const { detail, sousTotal, loading, retirer, retirerGroupe, restaurerLignes, setQuantite } =
    usePanierDetaille();
  const [kitRetire, setKitRetire] = useState<{ groupe: GroupeKitPanier; lignes: LignePanier[] } | null>(
    null,
  );

  // En mode ajout (PROMPT_CLIENT_V2 Lot 4), il n'y a qu'un seul panier — celui
  // de l'ajout en cours — et sa page dédiée (récapitulatif + paiement propre,
  // pas de nouveaux frais de livraison) : /panier redirige vers /ajout plutôt
  // que de montrer le "Commander" générique, qui créerait une 2e commande.
  useEffect(() => {
    if (modeAjout) router.replace("/ajout");
  }, [modeAjout, router]);

  const { groupes, horsGroupe } = useMemo(() => regrouperParKit(detail), [detail]);

  if (modeAjout) return null;

  // Retirer le dernier kit du panier vide la liste : l'écran "panier vide"
  // ne doit pas pour autant avaler la bannière d'annulation, sinon "Annuler"
  // devient impossible à atteindre (CORRECTIONS_V15 Lot 2, bug constaté).
  const retirerKit = (groupe: GroupeKitPanier) => {
    const lignesRetirees = retirerGroupe(groupe.id);
    setKitRetire({ groupe, lignes: lignesRetirees });
    setTimeout(() => setKitRetire((c) => (c?.groupe.id === groupe.id ? null : c)), 5000);
  };

  const annulerRetrait = () => {
    if (!kitRetire) return;
    restaurerLignes(kitRetire.lignes);
    setKitRetire(null);
  };

  const bandeauAnnulation = kitRetire && (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-elevated px-4 py-2.5 text-sm text-ink"
    >
      <span>Kit retiré</span>
      <button type="button" onClick={annulerRetrait} className="font-semibold text-brand">
        Annuler
      </button>
    </div>
  );

  if (loading) {
    return <p className="px-4 py-12 text-center text-sm text-ink/50">Chargement…</p>;
  }

  if (detail.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        {bandeauAnnulation && <div className="mb-2 w-full max-w-xs">{bandeauAnnulation}</div>}
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <ShoppingCart size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">Ton panier est vide</h1>
        <p className="max-w-xs text-sm text-ink/60">
          Parcours le catalogue pour ajouter des fournitures.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand active:scale-95"
        >
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-6 lg:mx-auto lg:w-full lg:max-w-5xl lg:flex-row lg:items-start lg:gap-8">
      <div className="flex flex-1 flex-col gap-4">
        <h1 className="font-heading text-xl font-bold text-ink">Mon panier</h1>

        <FreeShippingProgress sousTotal={sousTotal} />

        {bandeauAnnulation}

        {groupes.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {groupes.map(({ groupe, lignes }) => (
              <PanierKitCard
                key={groupe.id}
                groupe={groupe}
                lignes={lignes}
                onRetirer={() => retirerKit(groupe)}
              />
            ))}
          </div>
        )}

        {horsGroupe.length > 0 && (
          <div className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated px-3">
            {horsGroupe.map((ligne) => (
              <PanierLine
                key={`${ligne.produit.id}-${ligne.variante?.id ?? "base"}`}
                ligne={ligne}
                onQuantiteChange={(q) => setQuantite(ligne.produit.id, ligne.variante?.id ?? null, q)}
                onRetirer={() => retirer(ligne.produit.id, ligne.variante?.id ?? null)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-16 z-30 -mx-4 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:sticky lg:top-20 lg:mx-0 lg:w-80 lg:shrink-0 lg:rounded-2xl lg:border lg:bg-elevated lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-ink/50">Sous-total</span>
            <span className="text-sm font-semibold text-ink">{formatPrice(sousTotal)}</span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="flex h-11 items-center justify-center rounded-full bg-action px-6 text-sm font-semibold text-on-action transition-transform active:scale-95 lg:mt-1 lg:w-full"
          >
            Commander
          </button>
        </div>
      </div>
    </div>
  );
}
