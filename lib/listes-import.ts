// Analyse d'un texte collé (une liste de fournitures, une ligne par article)
// en {libellé, quantité} — étape 1 de l'import d'une liste personnalisée
// (admin colle le texte, chaque ligne est ensuite recherchée dans le
// catalogue). Pas de "use server" : fonction pure, testée isolément
// (lib/listes-import.test.ts).

export type LigneImportBrute = { texteOriginal: string; libelle: string; quantite: number };

// Puces/cases à cocher fréquentes en tête de ligne (copiées depuis une photo
// de liste scolaire ou une app type "espace parent") : strictement
// décoratives, jamais une quantité.
const PREFIXE_PUCE = /^(?:[-*•]|\[\s*[xX]?\s*\]|☐|□)\s*/;
// Numérotation de liste ("1. ", "2) ") : un index, jamais une quantité —
// contrairement à "6 cahiers" où le nombre EST la quantité (pas suivi de
// ponctuation de numérotation).
const PREFIXE_NUMEROTATION = /^\d+[.)]\s+/;

// Quantité en fin de ligne : "x6", "×6", "(x6)", "(6)", "- 6".
const QUANTITE_FINALE = /[\s(]*[x×]\s*(\d{1,3})\)?\s*$|[-–]\s*(\d{1,3})\s*$|\((\d{1,3})\)\s*$/i;
// Quantité en tête de ligne restante : "6 cahiers", "6x cahiers".
const QUANTITE_INITIALE = /^(\d{1,3})\s*[x×]?\s+/i;

// Les regex de quantité ne capturent jamais plus de 3 chiffres (voir
// QUANTITE_FINALE/QUANTITE_INITIALE) : seul 0 reste à écarter ici.
function borner(quantite: number): number {
  return Math.max(1, quantite);
}

export function parserLigneImport(texteOriginal: string): LigneImportBrute | null {
  let ligne = texteOriginal.trim();
  if (!ligne) return null;

  ligne = ligne.replace(PREFIXE_PUCE, "").trim();
  ligne = ligne.replace(PREFIXE_NUMEROTATION, "").trim();
  if (!ligne) return null;

  const finale = ligne.match(QUANTITE_FINALE);
  if (finale) {
    const quantite = Number(finale[1] ?? finale[2] ?? finale[3]);
    ligne = ligne.slice(0, finale.index).trim();
    if (!ligne) return null;
    return { texteOriginal, libelle: ligne, quantite: borner(quantite) };
  }

  const initiale = ligne.match(QUANTITE_INITIALE);
  if (initiale) {
    const reste = ligne.slice(initiale[0].length).trim();
    if (reste) return { texteOriginal, libelle: reste, quantite: borner(Number(initiale[1])) };
  }

  return { texteOriginal, libelle: ligne, quantite: 1 };
}

export function parserTexteImport(texte: string): LigneImportBrute[] {
  return texte
    .split("\n")
    .map((l) => parserLigneImport(l))
    .filter((l): l is LigneImportBrute => l !== null);
}
