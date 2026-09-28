import "@/styles/fond-decor.css";

export type VarianteFondDecor = "general" | "elementaire" | "college" | "lycee";

// Préscolaire et élémentaire partagent le même fond (CORRECTIONS_V12 Lot 3).
const VARIANTE_PAR_CYCLE: Record<string, VarianteFondDecor> = {
  prescolaire: "elementaire",
  elementaire: "elementaire",
  college: "college",
  lycee: "lycee",
};

export function varianteFondDuCycle(cycle: string): VarianteFondDecor {
  return VARIANTE_PAR_CYCLE[cycle] ?? "general";
}

// CORRECTIONS_V12 Lot 3 : décor pastel derrière le contenu, sur les pages
// kits/accueil uniquement (jamais panier/commande/paiement/compte/admin —
// pages de décision, restent sobres). Une seule image par page, sans
// préchargement prioritaire : le contenu passe avant le décor.
export function FondDecor({ variante }: { variante: VarianteFondDecor }) {
  return <div aria-hidden="true" className={`fond-decor fond-decor--${variante}`} />;
}
