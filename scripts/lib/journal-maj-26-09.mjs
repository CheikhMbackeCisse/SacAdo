// Journal partagé des scripts du chantier maj-26-09 : chaque script y ajoute
// ses entrées, et scripts/maj-26-09-generer-rapports.mjs les assemble en
// maj-26-09/rapports/modifications.md à la fin.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const CHEMIN = "maj-26-09/rapports/journal-corrections.json";

export function ajouterEntree(entree) {
  mkdirSync("maj-26-09/rapports", { recursive: true });
  const journal = existsSync(CHEMIN) ? JSON.parse(readFileSync(CHEMIN, "utf8")) : [];
  journal.push({ horodatage: new Date().toISOString(), ...entree });
  writeFileSync(CHEMIN, JSON.stringify(journal, null, 2), "utf8");
}

export function ajouterEntrees(entrees) {
  for (const e of entrees) ajouterEntree(e);
}
