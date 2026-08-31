"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_panier";

export type LignePanier = {
  produitId: number;
  varianteId: number | null;
  quantite: number;
};

// Émis à chaque ajout au panier (pas aux retraits / changements de quantité) :
// la barre de confirmation `CartToast` s'y abonne. `totalArticles` est le total
// du panier APRÈS l'ajout.
export const EVENEMENT_PANIER_AJOUT = "sacado:panier-ajout";

export type DetailAjoutPanier = {
  quantiteAjoutee: number;
  totalArticles: number;
};

// Persistance du panier dès le Lot 2 (fiche produit / cartes) pour ne rien
// perdre entre deux visites. L'écran Panier lui-même (calcul des frais de
// livraison, seuil de gratuité, etc.) reste au Lot 4 comme prévu.
export function usePanier() {
  const [lignes, setLignes] = useLocalList<LignePanier>(KEY);

  const ajouter = (produitId: number, varianteId: number | null, quantite: number) => {
    let totalApres = 0;
    setLignes((current) => {
      const index = current.findIndex(
        (l) => l.produitId === produitId && l.varianteId === varianteId,
      );
      const next =
        index === -1
          ? [...current, { produitId, varianteId, quantite }]
          : current.map((l, i) =>
              i === index ? { ...l, quantite: l.quantite + quantite } : l,
            );
      totalApres = next.reduce((sum, l) => sum + l.quantite, 0);
      return next;
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<DetailAjoutPanier>(EVENEMENT_PANIER_AJOUT, {
          detail: { quantiteAjoutee: quantite, totalArticles: totalApres },
        }),
      );
    }
  };

  const retirer = (produitId: number, varianteId: number | null) => {
    setLignes((current) =>
      current.filter((l) => !(l.produitId === produitId && l.varianteId === varianteId)),
    );
  };

  const setQuantite = (produitId: number, varianteId: number | null, quantite: number) => {
    setLignes((current) =>
      current.map((l) =>
        l.produitId === produitId && l.varianteId === varianteId
          ? { ...l, quantite: Math.max(1, quantite) }
          : l,
      ),
    );
  };

  const vider = () => setLignes(() => []);

  const totalArticles = lignes.reduce((sum, l) => sum + l.quantite, 0);

  return { lignes, ajouter, retirer, setQuantite, vider, totalArticles };
}
