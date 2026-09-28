// Vérification post-migration 0094 (CORRECTIONS_V11 lot 4, onglet "Tests" de
// synonymes_a_ajouter.xlsx). Usage : node scripts/verifier-recherche-lot4.mjs
// Lecture seule, jetable après usage.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function chercher(terme, limite = 10) {
  const { data, error } = await supabase.rpc("rechercher_produits", { terme, limite });
  if (error) return `ERREUR: ${error.message}`;
  return data.map((d) => d.nom).join(" | ") || "(vide)";
}

async function main() {
  console.log("=== Critère de réussite : même résultat, même ordre ===");
  const variantes = ["mathematiques 3eme", "maths troisieme", "MATHS 3E", "Mathématiques Troisième"];
  const resultats = [];
  for (const terme of variantes) {
    const r = await chercher(terme);
    resultats.push(r);
    console.log(`  "${terme}" -> ${r}`);
  }
  const identiques = resultats.every((r) => r === resultats[0]);
  console.log(identiques ? "  OK : les 4 formulations donnent exactement le même résultat." : "  ECHEC : résultats différents.");

  console.log("\n=== Onglet Tests ===");
  const tests = [
    ["mathematiques 3eme", "MATHEMATIQUES TROISIEME, Mathématiques 3éme, Excellence Maths 3ème"],
    ["maths 3e", "idem"],
    ["physique chimie 3e", "PHYSIQUE CHIMIE TROISIEME, Sciences Physiques 3ème"],
    ["svt 1ere", "Science de la vie et de la terre 1ʳᵉ"],
    ["francais tle", "Livre de Français Tlᵉ"],
    ["lc cm2", "Langue et communication C.M.2"],
    ["cahier 200 pages", "cahiers 192 et 200 pages"],
    ["travaux pratiques", "cahiers MyFriend"],
    ["bic rouge", "stylos rouges"],
    ["calculette", "Casio fx-991ES en premier"],
    ["une si longue lettre", "le roman"],
    ["mathematiqes 3em", "même résultat que mathematiques 3eme"],
    ["rapporteur", "rapporteurs d'abord, pas les équerres"],
    ["Mathématiques Troisième", "exactement la même liste, dans le même ordre, que « mathematiques 3eme »"],
    ["MATHS 3E", "idem"],
  ];
  for (const [terme, attendu] of tests) {
    const r = await chercher(terme);
    console.log(`  "${terme}"`);
    console.log(`    attendu : ${attendu}`);
    console.log(`    obtenu  : ${r}`);
  }
}

main().then(() => process.exit(0));
