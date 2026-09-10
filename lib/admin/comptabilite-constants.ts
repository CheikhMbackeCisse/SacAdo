import type { CategorieDepense } from "@/lib/supabase/types";

// Séparé de comptabilite-actions.ts ("use server") : un fichier Server Actions
// ne peut exporter que des fonctions async (règle Next.js), pas une constante.
export const CATEGORIES_DEPENSE: { valeur: CategorieDepense; label: string }[] = [
  { valeur: "livraison", label: "Livraison" },
  { valeur: "wave", label: "Commission Wave" },
  { valeur: "emballage", label: "Emballage" },
  { valeur: "publicite", label: "Publicité" },
  { valeur: "technique", label: "Abonnements & frais techniques" },
  { valeur: "autre", label: "Autre" },
];

export const LABEL_CATEGORIE_DEPENSE: Record<CategorieDepense, string> = Object.fromEntries(
  CATEGORIES_DEPENSE.map((c) => [c.valeur, c.label]),
) as Record<CategorieDepense, string>;

// --- Période du bénéfice (TACHE_corrections_2.md §2) -----------------------
export type BeneficePeriode = "ce-mois" | "mois-dernier" | "cette-annee" | "perso";

export const PERIODES_BENEFICE: { valeur: BeneficePeriode; label: string }[] = [
  { valeur: "ce-mois", label: "Ce mois" },
  { valeur: "mois-dernier", label: "Mois dernier" },
  { valeur: "cette-annee", label: "Cette année" },
  { valeur: "perso", label: "Période personnalisée" },
];

// Sénégal = UTC+0 toute l'année : toISOString (UTC) donne la bonne date locale.
function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resoudrePeriodeBenefice(
  bp: string | undefined,
  bd?: string,
  bf?: string,
): { type: BeneficePeriode; debut: string; fin: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (bp === "mois-dernier") {
    return {
      type: "mois-dernier",
      debut: jour(new Date(Date.UTC(y, m - 1, 1))),
      fin: jour(new Date(Date.UTC(y, m, 0))),
    };
  }
  if (bp === "cette-annee") {
    return { type: "cette-annee", debut: `${y}-01-01`, fin: jour(now) };
  }
  const dateOk = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (bp === "perso" && dateOk(bd) && dateOk(bf)) {
    const [debut, fin] = bd! <= bf! ? [bd!, bf!] : [bf!, bd!];
    return { type: "perso", debut, fin };
  }
  // Défaut : ce mois.
  return { type: "ce-mois", debut: jour(new Date(Date.UTC(y, m, 1))), fin: jour(now) };
}
