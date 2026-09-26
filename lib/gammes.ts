import type { Gamme } from "@/lib/supabase/types";

export type GammeDef = {
  value: Gamme;
  label: string;
  tagline: string;
  // Ce que la gamme apporte en plus, en une phrase (comparaison).
  apport: string;
};

// Noms VALIDÉS : Essentiel / Complet / Confort, dans cet ordre d'affichage
// (import-kits/PROMPT-claude-code-kits.md, ordre_gamme 1/2/3). Pas de "premium"
// ni aucun terme qui dévalorise les autres gammes (voir CORRECTIONS_V3).
export const GAMMES: GammeDef[] = [
  {
    value: "essentiel",
    label: "Essentiel",
    tagline: "L'indispensable, budget maîtrisé",
    apport: "Le strict nécessaire pour démarrer l'année.",
  },
  {
    value: "complet",
    label: "Complet",
    tagline: "Tout pour l'année, rien à racheter",
    apport: "Toute la liste, fournitures de qualité supérieure et livres au programme.",
  },
  {
    value: "confort",
    label: "Confort",
    tagline: "Le Complet, en mieux équipé",
    apport: "Le Complet, plus des livres de lecture et de révision en plus.",
  },
];

export const GAMME_ORDER: Record<Gamme, number> = {
  essentiel: 1,
  complet: 2,
  confort: 3,
};

export function getGammeDef(value: string): GammeDef | undefined {
  return GAMMES.find((g) => g.value === value);
}

export function isGamme(value: string): value is Gamme {
  return value === "essentiel" || value === "confort" || value === "complet";
}
