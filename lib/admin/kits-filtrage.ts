import type { FiltresKitsAdmin, KitAvecCompte } from "./kits-actions";

// Fonction pure, hors du fichier "use server" kits-actions.ts (qui ne peut
// exporter que des actions serveur async) — permet à /admin/kits de ne
// charger kits+kit_items qu'une fois et de filtrer en mémoire pour la liste
// filtrée ET la liste complète (PROMPT_ADMIN_KITS_PRODUITS.md lot 5).
export function filtrerKitsAdmin(kits: KitAvecCompte[], filtres: FiltresKitsAdmin): KitAvecCompte[] {
  return kits.filter(
    (k) =>
      (!filtres.cycle || k.cycle === filtres.cycle) &&
      (!filtres.niveau || k.niveau === filtres.niveau) &&
      (!filtres.gamme || k.gamme === filtres.gamme) &&
      (!filtres.statut || k.statut === filtres.statut),
  );
}
