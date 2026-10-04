"use client";

import { useEffect, useState } from "react";
import { usePanier, type GroupeKitPanier, type LignePanier, type PersonnalisationPanier } from "./panier";
import { getProduitsByIds, getVariantesByIds } from "@/lib/supabase/queries";
import type { Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

export type LigneDetaillee = {
  produit: Produit;
  variante: VarianteAvecAttributs | null;
  quantite: number;
  prixUnitaire: number;
  totalLigne: number;
  groupe: GroupeKitPanier | null;
  personnalisation: PersonnalisationPanier | null;
};

// Le panier local ne stocke que des ids + quantités ; ce hook va chercher les
// produits/variantes correspondants (lecture publique) pour afficher photo,
// nom et prix à jour dans /panier et /checkout.
export function usePanierDetaille() {
  const { lignes, retirer, retirerGroupe, restaurerLignes, setQuantite, vider } = usePanier();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [variantes, setVariantes] = useState<VarianteAvecAttributs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const produitIds = [...new Set(lignes.map((l) => l.produitId))];
    const varianteIds = [
      ...new Set(lignes.map((l) => l.varianteId).filter((v): v is number => v !== null)),
    ];

    Promise.all([getProduitsByIds(produitIds), getVariantesByIds(varianteIds)])
      .then(([produitsData, variantesData]) => {
        if (!active) return;
        setProduits(produitsData);
        setVariantes(variantesData);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lignes]);

  const detail: LigneDetaillee[] = lignes
    .map((ligne) => {
      const produit = produits.find((p) => p.id === ligne.produitId);
      if (!produit) return null;
      const variante = ligne.varianteId
        ? (variantes.find((v) => v.id === ligne.varianteId) ?? null)
        : null;
      const base = variante?.prix ?? produit.prix;
      const prixUnitaire = ligne.personnalisation ? base + (produit.prix_personnalisation ?? 0) : base;
      return {
        produit,
        variante,
        quantite: ligne.quantite,
        prixUnitaire,
        totalLigne: prixUnitaire * ligne.quantite,
        groupe: ligne.groupe ?? null,
        personnalisation: ligne.personnalisation ?? null,
      };
    })
    .filter((d): d is LigneDetaillee => d !== null);

  const sousTotal = detail.reduce((sum, d) => sum + d.totalLigne, 0);

  return {
    detail,
    sousTotal,
    loading,
    retirer,
    retirerGroupe,
    restaurerLignes,
    setQuantite,
    vider,
  };
}

export type { LignePanier };
