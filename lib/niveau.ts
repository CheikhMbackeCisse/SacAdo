// Jetons d'un niveau déclaré, pour interroger `niveaux_categories`
// (démarrage à froid + saisonnalité par niveau, TACHE_identite §2.5).
//
//   "Terminale S1", "lycee" -> ["Terminale", "S", "lycee"]
//   "6e", "college"         -> ["6e", "college"]
//   "CP", "elementaire"     -> ["CP", "elementaire"]
//   "Grande section"        -> ["Grande section"]

const NIVEAUX_A_SERIE = new Set(["Seconde", "Première", "Premiere", "Terminale"]);

export function tokensNiveau(classe: string, cycle?: string | null): string[] {
  const jetons = new Set<string>();
  const c = (classe ?? "").trim();
  if (!c) return [];

  const espace = c.indexOf(" ");
  const base = espace > 0 ? c.slice(0, espace) : c;

  if (espace > 0 && NIVEAUX_A_SERIE.has(base)) {
    jetons.add(base);
    const serie = c.slice(espace + 1).trim().toUpperCase();
    if (/^[SLTG]/.test(serie)) jetons.add(serie[0]);
  } else {
    jetons.add(c);
  }

  if (cycle) jetons.add(cycle);
  return [...jetons];
}

// Cycle déduit d'un niveau isolé ("6e" -> "college"). null si inconnu.
export function cycleDeNiveau(niveau: string | null | undefined): string | null {
  const n = (niveau ?? "").trim();
  if (["Petite section", "Moyenne section", "Grande section"].includes(n)) return "prescolaire";
  if (["CI", "CP", "CE1", "CE2", "CM1", "CM2"].includes(n)) return "elementaire";
  if (["6e", "5e", "4e", "3e"].includes(n)) return "college";
  if (["Seconde", "Première", "Premiere", "Terminale"].includes(n)) return "lycee";
  return null;
}

// Recompose la classe "Terminale" + "S1" -> "Terminale S1".
export function classeComplete(niveau: string | null | undefined, serie: string | null | undefined): string {
  const n = (niveau ?? "").trim();
  const s = (serie ?? "").trim();
  return s ? `${n} ${s}` : n;
}

// Valeur rangée dans le cookie `sacado_niveau` : "cycle|classe".
export const COOKIE_NIVEAU = "sacado_niveau";

export function encoderNiveau(cycle: string, classe: string): string {
  return `${cycle}|${classe}`;
}

export function decoderNiveau(valeur: string | undefined | null): { cycle: string; classe: string } | null {
  if (!valeur) return null;
  const i = valeur.indexOf("|");
  if (i < 0) return null;
  const cycle = valeur.slice(0, i).trim();
  const classe = valeur.slice(i + 1).trim();
  if (!classe) return null;
  return { cycle, classe };
}
