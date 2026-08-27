export type CycleValue = "prescolaire" | "elementaire" | "college" | "lycee";

export type CycleDef = {
  value: CycleValue;
  label: string;
  // photo du cycle sous /public/images (convention cycle-<value>.jpg)
  image: string;
  classes: string[];
};

// Cycles et classes fixes (voir MODELE_DONNEES.md "Parcours Kits"). kits.cycle
// et kits.niveau utilisent exactement ces valeurs.
export const CYCLES: CycleDef[] = [
  {
    value: "prescolaire",
    label: "Préscolaire",
    image: "/images/cycle-prescolaire.jpg",
    classes: ["Petite section", "Moyenne section", "Grande section"],
  },
  {
    value: "elementaire",
    label: "Élémentaire",
    image: "/images/cycle-elementaire.jpg",
    classes: ["CI", "CP", "CE1", "CE2", "CM1", "CM2"],
  },
  {
    value: "college",
    label: "Collège",
    image: "/images/cycle-college.jpg",
    classes: ["6e", "5e", "4e", "3e"],
  },
  {
    value: "lycee",
    label: "Lycée",
    // Niveaux écrits en toutes lettres, séries à partir de la Première
    // (la Seconde n'est pas encore sérialisée en L1/L2/S1/S2).
    image: "/images/cycle-lycee.jpg",
    classes: [
      "Seconde L",
      "Seconde S",
      "Première L1",
      "Première L2",
      "Première S1",
      "Première S2",
      "Terminale L1",
      "Terminale L2",
      "Terminale S1",
      "Terminale S2",
      "Terminale T",
      "Terminale G",
    ],
  },
];

export function getCycleByValue(value: string): CycleDef | undefined {
  return CYCLES.find((c) => c.value === value);
}
