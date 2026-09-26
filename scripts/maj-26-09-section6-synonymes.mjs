// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 6 (synonymes de recherche :
// classes, matières, quelques produits manquants). Pure donnée (table
// `synonymes` déjà en place, migration 0041/0045) : aucune migration requise.
// Idempotent (on conflict do nothing sur `terme`, unique).
// Usage : node scripts/maj-26-09-section6-synonymes.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ajouterEntree } from "./lib/journal-maj-26-09.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Groupes existants complétés (3e/terminale déjà là, formes manquantes ajoutées).
const AJOUTS_GROUPES_EXISTANTS = [
  { groupe: 102, termes: ["3eme"] },
  { groupe: 103, termes: ["term"] },
];

// Nouveaux groupes : classes (120-133), matières (140-152), produits (160-162).
// "pc" (physique-chimie) et tout token à 2 lettres ambigu avec l'informatique
// (déjà "pc bureau"/"pc portable" groupe 40-41) volontairement exclu.
const NOUVEAUX_GROUPES = [
  { groupe: 120, termes: ["ci", "cours d initiation"] },
  { groupe: 121, termes: ["cp", "cours preparatoire"] },
  { groupe: 122, termes: ["ce1"] },
  { groupe: 123, termes: ["ce2"] },
  { groupe: 124, termes: ["cm1"] },
  { groupe: 125, termes: ["cm2"] },
  { groupe: 126, termes: ["6e", "6eme", "sixieme"] },
  { groupe: 127, termes: ["5e", "5eme", "cinquieme"] },
  { groupe: 128, termes: ["4e", "4eme", "quatrieme"] },
  { groupe: 129, termes: ["seconde", "2nde", "2de", "2nd"] },
  { groupe: 130, termes: ["premiere", "1re", "1ere"] },
  { groupe: 140, termes: ["maths", "mathematiques", "math"] },
  { groupe: 141, termes: ["francais", "lecture", "grammaire", "conjugaison"] },
  { groupe: 142, termes: ["svt", "sciences de la vie et de la terre", "biologie", "sciences naturelles"] },
  { groupe: 143, termes: ["physique", "chimie", "physique chimie", "sciences physiques"] },
  { groupe: 144, termes: ["hg", "histoire", "geographie", "histoire geo"] },
  { groupe: 145, termes: ["anglais", "english"] },
  { groupe: 146, termes: ["espagnol"] },
  { groupe: 147, termes: ["arabe"] },
  { groupe: 148, termes: ["philosophie", "philo"] },
  { groupe: 149, termes: ["education civique", "ec", "ecm"] },
  { groupe: 150, termes: ["decouverte du monde", "ddm"] },
  { groupe: 151, termes: ["langue et communication", "lc"] },
  { groupe: 152, termes: ["ses", "economie"] },
  { groupe: 160, termes: ["post it", "post-it", "notes adhesives", "pense bete"] },
  { groupe: 161, termes: ["cahier grand format", "grand cahier"] },
  { groupe: 162, termes: ["cahier petit format", "petit cahier"] },
];

async function main() {
  let inserts = 0;
  for (const { groupe, termes } of [...AJOUTS_GROUPES_EXISTANTS, ...NOUVEAUX_GROUPES]) {
    for (const terme of termes) {
      const { error } = await supabase.from("synonymes").insert({ groupe, terme }).select().maybeSingle();
      if (error) {
        if (error.code === "23505") continue; // déjà présent (contrainte unique sur terme)
        console.error(`✗ groupe ${groupe} "${terme}" —`, error.message);
        continue;
      }
      console.log(`✓ groupe ${groupe} : "${terme}"`);
      inserts++;
    }
  }
  console.log(`\nSynonymes ajoutés : ${inserts}`);
  ajouterEntree({
    section: "6",
    cible: "Synonymes classes/matières/produits",
    action: "insertion",
    statut: "fait",
    detail: `${inserts} nouveaux termes. Volontairement exclus : "pc" seul (collision avec ordinateurs, groupe 40/41), "l"/"l2"/"steg" seuls (déjà couverts par le filtre Série livres, trop courts/risqués en synonyme libre).`,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
