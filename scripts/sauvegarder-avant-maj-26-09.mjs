// Sauvegarde des tables produits, categories et kits (+ kit_items) avant le
// chantier "maj-26-09" (voir maj-26-09/PROMPT-maj-catalogue-26-09.md, règle
// "Sauvegarde d'abord"). Usage : node scripts/sauvegarder-avant-maj-26-09.mjs
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

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

const DEST = "maj-26-09/sauvegarde";
mkdirSync(DEST, { recursive: true });

async function fetchAll(table, select = "*") {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function ecrireXlsx(rows, cheminSansExt) {
  const feuille = XLSX.utils.json_to_sheet(rows);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "data");
  XLSX.writeFile(classeur, `${cheminSansExt}.xlsx`);
}

async function main() {
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");

  const produits = await fetchAll("produits");
  ecrireXlsx(produits, `${DEST}/produits_${horodatage}`);
  console.log(`✓ produits : ${produits.length} lignes`);

  const categories = await fetchAll("categories");
  ecrireXlsx(categories, `${DEST}/categories_${horodatage}`);
  console.log(`✓ categories : ${categories.length} lignes`);

  const kits = await fetchAll("kits");
  ecrireXlsx(kits, `${DEST}/kits_${horodatage}`);
  console.log(`✓ kits : ${kits.length} lignes`);

  const kitItems = await fetchAll("kit_items");
  ecrireXlsx(kitItems, `${DEST}/kit_items_${horodatage}`);
  console.log(`✓ kit_items : ${kitItems.length} lignes`);

  console.log(`\nSauvegarde écrite dans ${DEST}/ (horodatage ${horodatage}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
