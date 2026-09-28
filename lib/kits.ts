import type { KitItem, Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

// Valide une classe d'URL (ex: "Terminale S1") contre la liste des classes
// actives du cycle, chargée en base (migration 0099, ADMIN.md Lot 3) par
// l'appelant via getClassesActives(cycle).
export function estClasseKitValide(niveau: string, classesDuCycle: { classe: string }[]): boolean {
  return classesDuCycle.some((c) => c.classe === niveau);
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

// Vide depuis CORRECTIONS_KITS Lot 5 §4 : les kits des séries arabes (SA, LA,
// S1A, S2A, L-AR) et de la série T existent désormais (import
// scripts/importer-kits-final.mjs) — plus rien "à venir" à annoncer.
export const SERIES_LYCEE_A_VENIR: SerieAVenir[] = [];

// --- Série T retirée (CORRECTIONS_V12 Lot 1) --------------------------------
// Le fondateur a retiré la série T (plus aucun nouveau kit). Les 9 kits
// existants passent en statut "masque" (jamais supprimés : des commandes y
// font référence), et les anciennes adresses redirigent en 308 vers
// /kits/lycee plutôt que d'afficher "bientôt disponible".
export const CLASSES_RETIREES: readonly string[] = ["Seconde T", "Première T", "Terminale T"];

export function estClasseRetiree(niveau: string): boolean {
  return CLASSES_RETIREES.includes(niveau);
}

// --- Classes du lycée (CORRECTIONS_KITS Lot 5 §3) ---------------------------
// Ordre et groupement exacts de l'onglet "Écran lycée" de
// kits_sacado_final.xlsx. Remplace "Terminale G" (n'existe plus, voir STEG).
export type ClasseLycee = { classe: string; groupe: string; ordre: number };

export const CLASSES_LYCEE: ClasseLycee[] = [
  { classe: "Seconde L", groupe: "Séries littéraires", ordre: 1 },
  { classe: "Seconde S", groupe: "Séries scientifiques", ordre: 2 },
  { classe: "Seconde STEG", groupe: "Gestion", ordre: 3 },
  { classe: "Seconde T", groupe: "Technique", ordre: 4 },
  { classe: "Seconde SA", groupe: "Séries arabes", ordre: 5 },
  { classe: "Seconde LA", groupe: "Séries arabes", ordre: 6 },
  { classe: "Première L1", groupe: "Séries littéraires", ordre: 7 },
  { classe: "Première L2", groupe: "Séries littéraires", ordre: 8 },
  { classe: "Première S1", groupe: "Séries scientifiques", ordre: 9 },
  { classe: "Première S2", groupe: "Séries scientifiques", ordre: 10 },
  { classe: "Première STEG", groupe: "Gestion", ordre: 11 },
  { classe: "Première T", groupe: "Technique", ordre: 12 },
  { classe: "Première S1A", groupe: "Séries arabes", ordre: 13 },
  { classe: "Première S2A", groupe: "Séries arabes", ordre: 14 },
  { classe: "Première LA", groupe: "Séries arabes", ordre: 15 },
  { classe: "Première L-AR", groupe: "Séries arabes", ordre: 16 },
  { classe: "Terminale L1", groupe: "Séries littéraires", ordre: 17 },
  { classe: "Terminale L2", groupe: "Séries littéraires", ordre: 18 },
  { classe: "Terminale S1", groupe: "Séries scientifiques", ordre: 19 },
  { classe: "Terminale S2", groupe: "Séries scientifiques", ordre: 20 },
  { classe: "Terminale STEG", groupe: "Gestion", ordre: 21 },
  { classe: "Terminale T", groupe: "Technique", ordre: 22 },
  { classe: "Terminale S1A", groupe: "Séries arabes", ordre: 23 },
  { classe: "Terminale S2A", groupe: "Séries arabes", ordre: 24 },
  { classe: "Terminale LA", groupe: "Séries arabes", ordre: 25 },
  { classe: "Terminale L-AR", groupe: "Séries arabes", ordre: 26 },
];
