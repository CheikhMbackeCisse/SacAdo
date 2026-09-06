"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_kits_panier";

// Classe (cycle + niveau) d'un kit ajouté au panier, pour offrir l'ebook de
// cette classe après l'achat (MODULE_EBOOKS.md). Aucune donnée personnelle.
// Rattaché à la commande au checkout, puis vidé avec le panier.
export type KitPanier = { id: string; cycle: string; niveau: string };

export function useKitsPanier() {
  const [lignes, set] = useLocalList<KitPanier>(KEY);

  const enregistrer = (cycle: string, niveau: string) => {
    set((current) => {
      if (current.some((l) => l.cycle === cycle && l.niveau === niveau)) return current;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [...current, { id, cycle, niveau }];
    });
  };

  const vider = () => set(() => []);

  return { lignes, enregistrer, vider };
}
