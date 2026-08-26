export type CycleValue = "prescolaire" | "elementaire" | "college" | "lycee";

export type CycleDef = {
  value: CycleValue;
  label: string;
  classes: string[];
};

// Cycles et classes fixes (voir MODELE_DONNEES.md "Parcours Kits"). kits.cycle
// et kits.niveau utilisent exactement ces valeurs.
export const CYCLES: CycleDef[] = [
  {
    value: "prescolaire",
    label: "Préscolaire",
    classes: ["Petite section", "Moyenne section", "Grande section"],
  },
  {
    value: "elementaire",
    label: "Élémentaire",
    classes: ["CI", "CP", "CE1", "CE2", "CM1", "CM2"],
  },
  {
    value: "college",
    label: "Collège",
    classes: ["6e", "5e", "4e", "3e"],
  },
  {
    value: "lycee",
    label: "Lycée",
    classes: ["2nde", "1ère", "Tle"],
  },
];

export function getCycleByValue(value: string): CycleDef | undefined {
  return CYCLES.find((c) => c.value === value);
}
