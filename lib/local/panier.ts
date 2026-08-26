"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_panier";

export type LignePanier = {
  produitId: number;
  varianteId: number | null;
  quantite: number;
};

// Persistance du panier dès le Lot 2 (fiche produit / cartes) pour ne rien
// perdre entre deux visites. L'écran Panier lui-même (calcul des frais de
// livraison, seuil de gratuité, etc.) reste au Lot 4 comme prévu.
export function usePanier() {
  const [lignes, setLignes] = useLocalList<LignePanier>(KEY);

  const ajouter = (produitId: number, varianteId: number | null, quantite: number) => {
    setLignes((current) => {
      const index = current.findIndex(
        (l) => l.produitId === produitId && l.varianteId === varianteId,
      );
      if (index === -1) {
        return [...current, { produitId, varianteId, quantite }];
      }
      const next = [...current];
      next[index] = { ...next[index], quantite: next[index].quantite + quantite };
      return next;
    });
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
