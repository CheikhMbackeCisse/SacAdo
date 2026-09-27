// SacAdo — Configuration de la facture (MODULE_FACTURES.md §2).
//
// TVA volontairement désactivée pour l'instant : le fondateur doit vérifier
// les règles sénégalaises avec un comptable avant d'en afficher une. Mettre
// un taux ici (ex. 0.18) active le calcul HT/TVA/TTC dans le PDF (lib/factures/
// document.tsx) sans autre changement — c'est tout l'intérêt de ce champ.
export const TAUX_TVA: number | null = null;

// Numéro de facture affiché = id de la table `factures` (continu, sans trou,
// jamais réutilisé — migration 0091), simplement mis en forme sur 6 chiffres.
export function numeroFacture(factureId: number): string {
  return String(factureId).padStart(6, "0");
}
