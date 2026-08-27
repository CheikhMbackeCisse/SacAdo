import type { Gamme } from "@/lib/supabase/types";

export type GammeDef = {
  value: Gamme;
  label: string;
  tagline: string;
  // Ce que la gamme apporte en plus, en une phrase (comparaison).
  apport: string;
};

// Noms VALIDÉS : Essentiel / Confort / Complet. Pas de "premium" ni aucun terme
// qui dévalorise les autres gammes (voir CORRECTIONS_V3).
export const GAMMES: GammeDef[] = [
  {
    value: "essentiel",
    label: "Essentiel",
    tagline: "L'indispensable, budget maîtrisé",
    apport: "Le strict nécessaire pour démarrer l'année.",
  },
  {
    value: "confort",
    label: "Confort",
    tagline: "Plus complet, meilleure qualité",
    apport: "Quantités pour tenir l'année et fournitures de meilleure qualité.",
  },
  {
    value: "complet",
    label: "Complet",
    tagline: "Tout pour l'année, rien à racheter",
    apport: "Le cartable, les extras et le nécessaire d'arts plastiques inclus.",
  },
];

export const GAMME_ORDER: Record<Gamme, number> = {
  essentiel: 0,
  confort: 1,
  complet: 2,
};

export function getGammeDef(value: string): GammeDef | undefined {
  return GAMMES.find((g) => g.value === value);
}

export function isGamme(value: string): value is Gamme {
  return value === "essentiel" || value === "confort" || value === "complet";
}
