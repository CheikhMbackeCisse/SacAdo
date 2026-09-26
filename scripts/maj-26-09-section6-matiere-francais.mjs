// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 6 ("Matière Français") :
// donne matiere='Français' aux manuels de français/grammaire/conjugaison/Bled
// et aux oeuvres littéraires (liste déjà curée par
// scripts/exporter-livres-litteraires-excel.mjs). N'écrase jamais une matiere
// déjà renseignée. Idempotent.
// Usage : node scripts/maj-26-09-section6-matiere-francais.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ajouterEntree } from "./lib/journal-maj-26-09.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Manuels/grammaires/conjugaison/Bled explicitement identifiés (nom).
const IDS_MANUELS_FRANCAIS = [
  1336, 1350, 1351, 1358, 1359, 1360, 1361, 1362, 1363, 1392, 1393, 1394,
  1395, 1396, 1400, 1401, 1403, 1426, 1441, 1442, 1443, 1444, 1448, 1549,
  1550, 1682,
];

// Oeuvres littéraires (romans, contes, théâtre, poésie, récits classiques),
// même liste que scripts/exporter-livres-litteraires-excel.mjs.
const IDS_LIVRES_LITTERAIRES = [
  1320, 1317, 1417, 1419, 1322, 1302, 1304, 1307, 1323, 1420, 1421, 1321,
  1423, 1422, 1318, 1306, 1233, 1316, 1314, 1425, 1308, 1305, 1310, 1311,
  1427, 1309, 1312, 1428, 1303, 1315, 1313, 1432, 1433, 1434, 1301, 1324,
  1435, 1319,
];

async function main() {
  const ids = [...new Set([...IDS_MANUELS_FRANCAIS, ...IDS_LIVRES_LITTERAIRES])];
  const { data: existants } = await supabase.from("produits").select("id, matiere").in("id", ids);
  const aTraiter = (existants ?? []).filter((p) => !p.matiere).map((p) => p.id);
  const dejaRenseignes = (existants ?? []).filter((p) => p.matiere).length;

  if (aTraiter.length > 0) {
    const { error } = await supabase.from("produits").update({ matiere: "Français" }).in("id", aTraiter);
    if (error) throw error;
  }
  console.log(`✓ matiere='Français' appliqué à ${aTraiter.length} livres (${dejaRenseignes} avaient déjà une matière, non touchés).`);
  ajouterEntree({
    section: "6",
    cible: "Matière Français (filtre livres)",
    action: "remplissage",
    statut: "fait",
    detail: `${aTraiter.length}/${ids.length} livres tagués (manuels de français/grammaire/conjugaison/Bled + oeuvres littéraires déjà cataloguées). ${dejaRenseignes} avaient déjà une autre matière, non écrasés.`,
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
