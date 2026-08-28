"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_kit_enfants";

// Prénom de l'enfant saisi au moment d'ajouter un kit au panier, pour
// personnaliser l'ebook offert. Rattaché à la commande au checkout, puis vidé.
export type KitEnfant = { id: string; kit: string; prenom: string };

export function useKitEnfants() {
  const [lignes, set] = useLocalList<KitEnfant>(KEY);

  const enregistrer = (kit: string, prenom: string) => {
    const p = prenom.trim();
    set((current) => {
      // Un seul prénom par kit : ré-ajouter le même kit remplace l'entrée.
      const sansCeKit = current.filter((l) => l.kit !== kit);
      if (!p) return sansCeKit;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [...sansCeKit, { id, kit, prenom: p }];
    });
  };

  const vider = () => set(() => []);

  return { lignes, enregistrer, vider };
}
