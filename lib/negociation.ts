import type { AuteurProposition, NegociationProposition } from "@/lib/supabase/types";

// Limite d'allers-retours par défaut (garde-fou anti-négociation sans fin).
// Paramétrable dans l'admin à l'étape suivante ; pour l'instant en dur.
export const TOURS_MAX_DEFAUT = 4;

export type EtatNegociation = {
  // Dernière proposition encore sur la table (statut 'en_cours'), s'il y en a une.
  derniere: NegociationProposition | null;
  // Prix actuellement proposé (celui de `derniere`), ou null si le fil est vide
  // / clôturé.
  prixCourant: number | null;
  // À qui de jouer : l'AUTRE partie que l'auteur de la dernière proposition.
  // null si personne n'a la balle (fil vide ou négociation clôturée).
  balle: AuteurProposition | null;
  // Nombre de tours = nombre total de propositions du fil.
  tours: number;
};

// Ordonne le fil par date croissante (défensif : on ne suppose pas l'ordre SQL).
function parDate(props: NegociationProposition[]): NegociationProposition[] {
  return [...props].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function etatNegociation(props: NegociationProposition[]): EtatNegociation {
  const triees = parDate(props);
  const derniere = triees.filter((p) => p.statut === "en_cours").at(-1) ?? null;

  return {
    derniere,
    prixCourant: derniere?.prix_propose ?? null,
    balle: derniere ? autre(derniere.auteur) : null,
    tours: triees.length,
  };
}

export function autre(auteur: AuteurProposition): AuteurProposition {
  return auteur === "vendeur" ? "admin" : "vendeur";
}

// Qui doit jouer, en tenant compte du statut du produit :
//   - produit publié / refusé → personne (null) ;
//   - fil avec une proposition en_cours → l'autre que son auteur ;
//   - fil vide + 'en_attente' → soumission initiale du vendeur, balle côté admin.
export function balleCote(
  statutPublication: string,
  fil: NegociationProposition[],
): AuteurProposition | null {
  if (statutPublication !== "en_attente" && statutPublication !== "negociation") return null;
  const { derniere, balle } = etatNegociation(fil);
  if (derniere) return balle;
  return statutPublication === "en_attente" ? "admin" : null;
}

// Prix actuellement sur la table : dernière proposition en_cours, ou à défaut le
// prix courant du produit (cas de la soumission initiale sans ligne de fil).
export function prixEnJeu(produitPrix: number, fil: NegociationProposition[]): number {
  return etatNegociation(fil).prixCourant ?? produitPrix;
}

// Vrai quand le fil a atteint la limite : plus de nouvelle contre-proposition,
// on ne peut plus qu'accepter le dernier prix ou abandonner.
export function limiteAtteinte(tours: number, toursMax = TOURS_MAX_DEFAUT): boolean {
  return tours >= toursMax;
}
