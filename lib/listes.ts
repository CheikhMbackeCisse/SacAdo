import { ligneEstAffichable } from "@/lib/kits";
import type { ListeItem, Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

// Mêmes règles d'affichage qu'un kit (produit publié, en stock, avec prix de
// vente) : ligneEstAffichable ne dépend que de Produit, réutilisée telle quelle.
export type ChampsLigneListe = Pick<ListeItem, "quantite_defaut" | "coche_defaut" | "ordre">;

export type LigneListe = {
  item: ChampsLigneListe;
  produit: Produit;
  variantes?: VarianteAvecAttributs[];
};

export function lignesAffichablesListe(lignes: LigneListe[]): LigneListe[] {
  return lignes.filter((l) => ligneEstAffichable(l.produit));
}

export function listeEstAffichable(lignes: LigneListe[]): boolean {
  return lignesAffichablesListe(lignes).length > 0;
}

export type EtatLignesListe = (item: ChampsLigneListe) => boolean;

const cocheeParDefaut: EtatLignesListe = (item) => item.coche_defaut;
const quantiteParDefaut = (item: ChampsLigneListe) => item.quantite_defaut;

// Contrairement à calculerPrixKit (lib/kits.ts), la quantité comptée est la
// quantité COURANTE choisie par le client (3e paramètre) — absente côté kits
// puisque leur quantité est figée par l'admin.
export function calculerPrixListe(
  lignes: LigneListe[],
  estCochee: EtatLignesListe = cocheeParDefaut,
  quantiteCourante: (item: ChampsLigneListe) => number = quantiteParDefaut,
): { total: number; nbArticles: number } {
  return lignesAffichablesListe(lignes).reduce(
    (acc, { item, produit }) => {
      if (!estCochee(item)) return acc;
      const q = quantiteCourante(item);
      return { total: acc.total + q * produit.prix, nbArticles: acc.nbArticles + q };
    },
    { total: 0, nbArticles: 0 },
  );
}
