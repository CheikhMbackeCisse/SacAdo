import type { CategorieDepense } from "@/lib/supabase/types";

// Séparé de comptabilite-actions.ts ("use server") : un fichier Server Actions
// ne peut exporter que des fonctions async (règle Next.js), pas une constante.
export const CATEGORIES_DEPENSE: { valeur: CategorieDepense; label: string }[] = [
  { valeur: "carburant", label: "Carburant" },
  { valeur: "salaire_chauffeur", label: "Salaire chauffeur" },
  { valeur: "achat_fournisseur", label: "Achat fournisseur" },
  { valeur: "divers", label: "Divers" },
];
