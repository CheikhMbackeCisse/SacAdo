"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_kits_panier";

// Classe (cycle + niveau) d'un kit ajouté au panier, pour :
//   - offrir l'ebook de cette classe après l'achat (MODULE_EBOOKS.md) ;
//   - attribuer les produits du kit au bon bénéficiaire pour la
//     personnalisation (TACHE_identite §2.3) — `beneficiaireId` + `produitIds`.
// Rattaché à la commande au checkout, puis vidé avec le panier. Aucune donnée
// personnelle ici (juste un id de bénéficiaire).
export type KitPanier = {
  id: string;
  cycle: string;
  niveau: string;
  beneficiaireId?: number | null;
  produitIds?: number[];
};

type ExtraKit = { beneficiaireId?: number | null; produitIds?: number[] };

export function useKitsPanier() {
  const [lignes, set] = useLocalList<KitPanier>(KEY);

  const enregistrer = (cycle: string, niveau: string, extra?: ExtraKit) => {
    set((current) => {
      const i = current.findIndex((l) => l.cycle === cycle && l.niveau === niveau);
      if (i >= 0) {
        const copie = [...current];
        copie[i] = { ...copie[i], ...extra };
        return copie;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [...current, { id, cycle, niveau, ...extra }];
    });
  };

  const vider = () => set(() => []);

  return { lignes, enregistrer, vider };
}
