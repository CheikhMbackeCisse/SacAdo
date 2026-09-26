// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 4 (champ collection,
// livres uniquement). PRÉREQUIS : migration 0088_marques_collections.sql
// (ajoute produits.collection) doit être exécutée dans le SQL Editor Supabase
// avant de lancer ce script. N'écrase jamais une collection déjà renseignée.
// Usage : node scripts/maj-26-09-section4-collections.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ajouterEntree } from "./lib/journal-maj-26-09.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Identifiées par nom exact (retrouvées en base le 2026-09-26). Les éditions
// "La Clé des Cracks" ci-dessous sont confirmées via la table d'alias de
// scripts/import-kits.mjs (références CDC-*) — CDC-3PC est explicitement
// "Collection Kandia" par décision fondateur (voir commentaire de ce script),
// pas La Clé des Cracks malgré le préfixe CDC-.
const COLLECTIONS = {
  "La Clé des Cracks": [43, 44, 45, 39, 46, 47, 50, 51, 54, 58, 63, 64, 68],
  "Collection Kandia": [1338],
  "Bled": [1336],
  "Excellence": [1342, 1343, 1344, 1345],
  "VISA Annales": [1569],
};

async function main() {
  let maj = 0;
  for (const [collection, ids] of Object.entries(COLLECTIONS)) {
    const { data: existants } = await supabase.from("produits").select("id, collection").in("id", ids);
    const aTraiter = (existants ?? []).filter((p) => !p.collection).map((p) => p.id);
    if (aTraiter.length === 0) continue;
    const { error } = await supabase.from("produits").update({ collection }).in("id", aTraiter);
    if (error) throw error;
    console.log(`✓ ${collection} : ${aTraiter.length}/${ids.length}`);
    maj += aTraiter.length;
  }
  console.log(`\nCollections renseignées : ${maj}`);
  ajouterEntree({
    section: "4",
    cible: "Champ collection (livres)",
    action: "remplissage",
    statut: "fait",
    detail: `${maj} livres tagués sur 5 collections identifiées avec confiance (nom exact ou alias confirmé des kits). Le reste du catalogue Livres (au-delà de ces éditions nommément identifiées) n'a pas été passé en revue individuellement : à compléter au fil de l'eau.`,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
