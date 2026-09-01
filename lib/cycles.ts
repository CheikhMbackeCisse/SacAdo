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

// --- Regroupement des séries du lycée (affichage uniquement) ----------------
// Première et Terminale ont trop de séries pour une liste à plat : on les
// regroupe par TYPE (littéraire / scientifique / technique / gestion / arabe).
// Le parcours devient Cycle -> Classe -> Type de série -> Série -> Kit.
// Aucune donnée n'est modifiée : `kits.niveau` garde ses valeurs ("Terminale L1").

export type SerieType = "litteraire" | "scientifique" | "technique" | "gestion" | "arabe";

const TYPE_LABELS: Record<SerieType, string> = {
  litteraire: "Séries littéraires",
  scientifique: "Séries scientifiques",
  technique: "Technique",
  gestion: "Gestion",
  arabe: "Arabe",
};

const TYPE_ORDRE: SerieType[] = ["litteraire", "scientifique", "technique", "gestion", "arabe"];
const NIVEAU_ORDRE = ["Seconde", "Première", "Terminale"];

// Découpe "Première L1" -> { niveau: "Première", serie: "L1" }.
export function decouperClasseLycee(classe: string): { niveau: string; serie: string } {
  const i = classe.indexOf(" ");
  if (i === -1) return { niveau: classe, serie: "" };
  return { niveau: classe.slice(0, i), serie: classe.slice(i + 1) };
}

// Déduit le type d'une série à partir de son code (tolère les séries pas encore
// présentes dans les données : S3/STIDD, STEG, LA, S1A/S2A...).
function typeDeSerie(serie: string): SerieType {
  const s = serie.toUpperCase();
  if (s === "LA" || (s.startsWith("S") && s.endsWith("A"))) return "arabe";
  if (s.startsWith("STIDD") || s === "S3" || s === "T") return "technique";
  if (s.startsWith("STEG") || s === "G") return "gestion";
  if (s.startsWith("L")) return "litteraire";
  if (s.startsWith("S")) return "scientifique";
  return "litteraire";
}

export type LyceeGroupeSeries = { type: SerieType; label: string; classes: string[] };
export type LyceeNiveauStructure = {
  niveau: string;
  // Séries listées directement (Seconde : peu de séries).
  directes: string[];
  // Séries regroupées par type (Première / Terminale).
  groupes: LyceeGroupeSeries[];
};

// Au-delà de ce nombre de séries, on regroupe par type plutôt que lister à plat.
const SEUIL_REGROUPEMENT = 2;

export function structurerLycee(classes: string[]): LyceeNiveauStructure[] {
  const parNiveau = new Map<string, string[]>();
  for (const classe of classes) {
    const { niveau } = decouperClasseLycee(classe);
    parNiveau.set(niveau, [...(parNiveau.get(niveau) ?? []), classe]);
  }

  const niveaux = [...parNiveau.keys()].sort(
    (a, b) => NIVEAU_ORDRE.indexOf(a) - NIVEAU_ORDRE.indexOf(b),
  );

  return niveaux.map((niveau) => {
    const series = parNiveau.get(niveau) ?? [];
    if (series.length <= SEUIL_REGROUPEMENT) {
      return { niveau, directes: series, groupes: [] };
    }

    const parType = new Map<SerieType, string[]>();
    for (const classe of series) {
      const { serie } = decouperClasseLycee(classe);
      const type = typeDeSerie(serie);
      parType.set(type, [...(parType.get(type) ?? []), classe]);
    }

    const groupes = TYPE_ORDRE.filter((t) => parType.has(t)).map((type) => ({
      type,
      label: TYPE_LABELS[type],
      classes: parType.get(type) ?? [],
    }));

    return { niveau, directes: [], groupes };
  });
}
