// Sauvegarde kits, kit_items, produits (id, categorie_id, sous_categorie_id, prix,
// prix_achat) avant le chantier CORRECTIONS_KITS (dernier-prompt-kit.zip, Lot 2).
// Usage : node scripts/lot2-sauvegarder-kits-final.mjs
import { writeFile, mkdir } from "node:fs/promises";
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

async function fetchAll(table, select) {
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

async function main() {
  const horodatage = new Date().toISOString().slice(0, 10);
  await mkdir("backups", { recursive: true });

  const kits = await fetchAll("kits", "*");
  const kitItems = await fetchAll("kit_items", "*");
  const produits = await fetchAll("produits", "id, categorie_id, sous_categorie_id, prix, prix_achat");

  const chemin = `backups/avant_kits_final_${horodatage}.json`;
  await writeFile(chemin, JSON.stringify({ kits, kit_items: kitItems, produits }, null, 2), "utf8");

  console.log(`✓ kits : ${kits.length}`);
  console.log(`✓ kit_items : ${kitItems.length}`);
  console.log(`✓ produits : ${produits.length}`);
  console.log(`Sauvegarde écrite : ${chemin}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
