// Diagnostic partagé "pourquoi cette ligne n'apparaît pas côté client"
// (produit masqué / en rupture / sans prix de vente), réutilisé par les kits
// scolaires (kits-actions.ts) et les listes personnalisées (listes-actions.ts).
// Fichier à part (pas de "use server") : un module "use server" n'accepte
// que des exports async — une fonction utilitaire synchrone comme celle-ci ne
// peut pas vivre dans kits-actions.ts ni listes-actions.ts.

export type MotifLigneCachee = "masque" | "rupture" | "sans_prix";

export type LigneCacheeAdmin = {
  libelle_besoin: string | null;
  produit_nom: string;
  motif: MotifLigneCachee;
};

export function motifLigneCachee(produit: { statut: string; statut_publication: string; prix: number }): MotifLigneCachee {
  if (produit.statut_publication !== "publie") return "masque";
  if (produit.statut === "epuise") return "rupture";
  return "sans_prix";
}
