import { getCycleByValue } from "@/lib/cycles";
import type { KitItem, Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

// Les kits couvrent des classes de lycée plus simples que le découpage fin
// utilisé ailleurs dans l'app (lib/cycles.ts) : le picker et les pages kit
// valident donc la classe avec cette règle plutôt qu'avec
// cycleDef.classes.includes(...). Depuis la correction v7 : L et S en
// Seconde ; L, S1, S2 en Première et en Terminale ; STEG aux trois niveaux.
const CLASSE_LYCEE_KIT = /^(Seconde (L|S|STEG)|(Première|Terminale) (L|S1|S2|STEG))$/;

export function estClasseKitValide(cycle: string, niveau: string): boolean {
  if (cycle === "lycee") return CLASSE_LYCEE_KIT.test(niveau);
  const cycleDef = getCycleByValue(cycle);
  return cycleDef ? cycleDef.classes.includes(niveau) : false;
}

// Un kit ne stocke jamais de prix (import-kits/PROMPT-claude-code-kits.md) :
// son prix est TOUJOURS recalculé ici, à partir du prix actuel des produits.
// Utilisée partout : page du kit, listes de classe, panier, admin, balises OG.

// Seuls les champs d'affichage/calcul sont requis : les appelants n'ont pas
// toujours l'id/kit_id/produit_id de la ligne sous la main (ex. le diagnostic
// admin, qui ne les sélectionne pas).
export type ChampsLigneKit = Pick<
  KitItem,
  "quantite_defaut" | "coche_defaut" | "section" | "groupe_affichage" | "ordre"
>;

export type LigneKit = {
  item: ChampsLigneKit;
  produit: Produit;
  variantes?: VarianteAvecAttributs[];
};

// Une ligne dont le produit est masqué, en rupture ou sans prix de vente n'est
// ni affichée ni comptée (Étape 4 du prompt).
export function ligneEstAffichable(produit: Produit): boolean {
  if (produit.statut_publication !== "publie") return false;
  if (produit.statut === "epuise") return false;
  if (!produit.prix || produit.prix <= 0) return false;
  return true;
}

export function lignesAffichables(lignes: LigneKit[]): LigneKit[] {
  return lignes.filter((l) => ligneEstAffichable(l.produit));
}

// Groupe qui porte les livres "La Clé des Cracks" / "La Clé du Bac" — seul
// marqueur disponible à la lecture (le ref d'origine CDC-* n'est pas persisté).
const GROUPE_PARASCOLAIRE_SCIENTIFIQUE = "Parascolaire scientifique";

export function aUneCleDesCracksAffichable(lignes: LigneKit[]): boolean {
  return lignesAffichables(lignes).some(
    (l) => l.item.groupe_affichage === GROUPE_PARASCOLAIRE_SCIENTIFIQUE,
  );
}

// Un kit sans aucune ligne "principal" affichable n'est pas affiché du tout.
export function kitEstAffichable(lignes: LigneKit[]): boolean {
  return lignesAffichables(lignes).some((l) => l.item.section === "principal");
}

export type EtatLignes = (item: ChampsLigneKit) => boolean;

const parDefaut: EtatLignes = (item) => item.coche_defaut;

// La fonction unique de calcul du prix. `estCochee` par défaut = coche_defaut
// de chaque ligne (prix "officiel" affiché en liste/admin/OG) ; la page kit
// interactive passe l'état live des cases à cocher du client.
export function calculerPrixKit(
  lignes: LigneKit[],
  estCochee: EtatLignes = parDefaut,
): { total: number; nbArticles: number } {
  return lignesAffichables(lignes).reduce(
    (acc, { item, produit }) => {
      if (!estCochee(item)) return acc;
      return {
        total: acc.total + item.quantite_defaut * produit.prix,
        nbArticles: acc.nbArticles + item.quantite_defaut,
      };
    },
    { total: 0, nbArticles: 0 },
  );
}

// --- Regroupement des cahiers -----------------------------------------------
// "Les lignes du groupe Cahiers sont regroupées en une seule ligne « X cahiers »"
const GROUPE_CAHIERS = "Cahiers";

export type LigneAffichage =
  | { type: "simple"; ligne: LigneKit }
  | { type: "groupe_cahiers"; quantiteTotale: number; lignes: LigneKit[] };

// Construit la liste d'affichage d'une section : les lignes "Cahiers" sont
// fusionnées en une seule entrée repliable, les autres restent telles quelles.
// L'ordre d'origine (item.ordre) est préservé pour tout le reste.
export function construireAffichageSection(lignes: LigneKit[]): LigneAffichage[] {
  const tries = [...lignes].sort((a, b) => a.item.ordre - b.item.ordre);
  const resultat: LigneAffichage[] = [];
  const cahiers: LigneKit[] = [];
  let inserted = false;

  for (const l of tries) {
    if (l.item.groupe_affichage === GROUPE_CAHIERS) {
      cahiers.push(l);
      if (!inserted) {
        resultat.push({ type: "groupe_cahiers", quantiteTotale: 0, lignes: [] });
        inserted = true;
      }
      continue;
    }
    resultat.push({ type: "simple", ligne: l });
  }

  if (cahiers.length > 0) {
    const groupe = resultat.find((r): r is Extract<LigneAffichage, { type: "groupe_cahiers" }> =>
      r.type === "groupe_cahiers",
    );
    if (groupe) {
      groupe.lignes = cahiers;
      groupe.quantiteTotale = cahiers.reduce((sum, l) => sum + l.item.quantite_defaut, 0);
    }
  }

  return resultat;
}

export function lignesParSection(lignes: LigneKit[], section: KitItem["section"]): LigneKit[] {
  return lignesAffichables(lignes).filter((l) => l.item.section === section);
}

// --- Séries à venir (correction v7) ------------------------------------------
// Contenu statique (import-kits/kits.json "series_a_venir") : aucun kit n'est
// créé pour cette série, affichée sans prix, sans bouton, sans lien — un
// simple texte sous le nom de la série (pas de carte/encadré).
export type SerieAVenir = { serie: string; libelle: string; message: string };

export const SERIES_LYCEE_A_VENIR: SerieAVenir[] = [
  {
    serie: "Arabe",
    libelle: "Lycée arabe",
    message: "Les kits du lycée arabe ne sont pas encore disponibles.",
  },
];
