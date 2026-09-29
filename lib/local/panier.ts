"use client";

import { useLocalList } from "./use-local-list";
import { mesurer } from "@/lib/mesure-client";

const KEY = "sacado_panier";

// Groupe d'un kit ajouté au panier (CORRECTIONS_V15 Lot 2) : rattache chaque
// ligne d'un kit à une même instance (`id`), pour l'afficher comme UNE carte
// dans le panier au lieu d'une ligne par produit. Deux kits identiques (deux
// enfants dans la même classe) portent deux `id` différents.
export type GroupeKitPanier = {
  id: string;
  kitId: number;
  cycle: string;
  niveau: string;
  gamme: string; // slug (essentiel/confort/complet), pour rouvrir la bonne page
  gammeLabel: string; // libellé affiché (ex. "Confort")
  photo: string | null;
  beneficiaireId?: number | null;
  beneficiairePrenom?: string | null;
};

export type LignePanier = {
  produitId: number;
  varianteId: number | null;
  quantite: number;
  // Absent sur les lignes ajoutées hors kit, ou sur les paniers enregistrés
  // avant ce lot (rétro-compatibilité : elles s'affichent comme avant).
  groupe?: GroupeKitPanier | null;
};

// Émis à chaque ajout au panier (pas aux retraits / changements de quantité) :
// la barre de confirmation `CartToast` s'y abonne. `totalArticles` est le total
// du panier APRÈS l'ajout.
export const EVENEMENT_PANIER_AJOUT = "sacado:panier-ajout";

export type DetailAjoutPanier = {
  quantiteAjoutee: number;
  totalArticles: number;
};

function genererIdGroupe(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // contexte non sécurisé (HTTP simple) : repli ci-dessous
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Persistance du panier dès le Lot 2 (fiche produit / cartes) pour ne rien
// perdre entre deux visites. L'écran Panier lui-même (calcul des frais de
// livraison, seuil de gratuité, etc.) reste au Lot 4 comme prévu.
export function usePanier() {
  const [lignes, setLignes] = useLocalList<LignePanier>(KEY);

  const emettreAjout = (quantiteAjoutee: number, totalApres: number) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent<DetailAjoutPanier>(EVENEMENT_PANIER_AJOUT, {
        detail: { quantiteAjoutee, totalArticles: totalApres },
      }),
    );
  };

  const ajouter = (produitId: number, varianteId: number | null, quantite: number) => {
    let totalApres = 0;
    setLignes((current) => {
      const index = current.findIndex(
        (l) => l.produitId === produitId && l.varianteId === varianteId && !l.groupe,
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

    emettreAjout(quantite, totalApres);

    // Signal de classement (poids 3) : le contexte catégorie est résolu en base
    // à partir du produit côté /api/mesure.
    mesurer({ type: "ajout_panier", produitId });
  };

  // Ajoute (ou remplace, en mode "modifier") toutes les lignes d'un kit en un
  // seul geste : une seule entrée de toast, une seule carte dans le panier.
  // `groupe.id` absent = nouveau kit (id généré ici) ; fourni = remplace les
  // lignes de ce groupe existant par la sélection courante.
  const ajouterKit = (
    groupe: Omit<GroupeKitPanier, "id"> & { id?: string },
    items: { produitId: number; varianteId: number | null; quantite: number }[],
  ) => {
    const groupeComplet: GroupeKitPanier = { ...groupe, id: groupe.id ?? genererIdGroupe() };
    let totalApres = 0;
    let quantiteAjoutee = 0;
    setLignes((current) => {
      const sansAncienGroupe = current.filter((l) => l.groupe?.id !== groupeComplet.id);
      const nouvelles: LignePanier[] = items.map((it) => ({ ...it, groupe: groupeComplet }));
      quantiteAjoutee = nouvelles.reduce((sum, l) => sum + l.quantite, 0);
      const next = [...sansAncienGroupe, ...nouvelles];
      totalApres = next.reduce((sum, l) => sum + l.quantite, 0);
      return next;
    });

    emettreAjout(quantiteAjoutee, totalApres);
    items.forEach((it) => mesurer({ type: "ajout_panier", produitId: it.produitId }));
    return groupeComplet;
  };

  // Retire toutes les lignes d'un kit d'un coup ; renvoie les lignes retirées
  // pour permettre un « Annuler » (restaurerLignes ci-dessous).
  const retirerGroupe = (groupeId: string): LignePanier[] => {
    const retirees = lignes.filter((l) => l.groupe?.id === groupeId);
    setLignes((current) => current.filter((l) => l.groupe?.id !== groupeId));
    return retirees;
  };

  // Undo d'un retrait (kit ou ligne simple) : remet exactement les lignes
  // fournies, telles qu'elles étaient.
  const restaurerLignes = (lignesARestaurer: LignePanier[]) => {
    if (lignesARestaurer.length === 0) return;
    setLignes((current) => [...current, ...lignesARestaurer]);
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

  return {
    lignes,
    ajouter,
    ajouterKit,
    retirer,
    retirerGroupe,
    restaurerLignes,
    setQuantite,
    vider,
    totalArticles,
  };
}
