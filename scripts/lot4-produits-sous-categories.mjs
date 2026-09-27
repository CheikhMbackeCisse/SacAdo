// CORRECTIONS_KITS Lot 4 (suite) : applique la catégorie/sous-catégorie cible
// aux produits marqués "À modifier = Oui" dans sous_categories_produits.xlsx.
// Prérequis : scripts/lot4-sous-categories.mjs déjà exécuté. Usage :
//   node scripts/lot4-produits-sous-categories.mjs --dry-run
//   node scripts/lot4-produits-sous-categories.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = "sous_categories_produits.xlsx";

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

async function main() {
  const wb = XLSX.read(readFileSync(FICHIER), { type: "buffer" });
  const produits = XLSX.utils.sheet_to_json(wb.Sheets["Produits"], { defval: null });
  const aModifier = produits.filter((p) => p["À modifier"] === "Oui");

  const { data: categories, error: errCat } = await supabase.from("categories").select("id, nom");
  if (errCat) throw new Error(`Lecture catégories échouée : ${errCat.message}`);
  const categorieIdParNom = new Map(categories.map((c) => [c.nom, c.id]));

  const { data: sousCategories, error: errSc } = await supabase
    .from("sous_categories")
    .select("id, nom, categorie_id");
  if (errSc) throw new Error(`Lecture sous-catégories échouée : ${errSc.message}`);

  let appliques = 0;
  const erreurs = [];

  for (const p of aModifier) {
    const categorieId = categorieIdParNom.get(p["Catégorie cible"]);
    if (!categorieId) {
      erreurs.push(`#${p.ID} ${p.Nom} : catégorie cible introuvable "${p["Catégorie cible"]}"`);
      continue;
    }
    const sousCategorie = sousCategories.find(
      (s) => s.categorie_id === categorieId && s.nom === p["Sous-catégorie cible"],
    );
    if (!sousCategorie) {
      erreurs.push(
        `#${p.ID} ${p.Nom} : sous-catégorie cible introuvable "${p["Sous-catégorie cible"]}" (catégorie ${p["Catégorie cible"]})`,
      );
      continue;
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("produits")
        .update({ categorie_id: categorieId, sous_categorie_id: sousCategorie.id })
        .eq("id", p.ID);
      if (error) {
        erreurs.push(`#${p.ID} ${p.Nom} : ${error.message}`);
        continue;
      }
    }
    appliques++;
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}${appliques}/${aModifier.length} produits mis à jour, ${erreurs.length} erreurs.`,
  );
  if (erreurs.length > 0) {
    console.log("\n--- Erreurs ---");
    erreurs.forEach((e) => console.log("- " + e));
  }

  if (!DRY_RUN) {
    // Contrôle final : plus aucun produit sans sous-catégorie.
    const { count } = await supabase
      .from("produits")
      .select("id", { count: "exact", head: true })
      .is("sous_categorie_id", null);
    console.log(`\nProduits sans sous-catégorie après import : ${count}`);

    writeFileSync(
      "rapport-lot4-produits.md",
      [
        "# Rapport Lot 4 — sous-catégories des produits",
        "",
        `Lancé le ${new Date().toISOString()}.`,
        "",
        `- Produits mis à jour : ${appliques} / ${aModifier.length}`,
        `- Erreurs : ${erreurs.length}`,
        `- Produits sans sous-catégorie après import : ${count}`,
        "",
        ...(erreurs.length ? erreurs.map((e) => `- ${e}`) : ["(aucune erreur)"]),
      ].join("\n"),
      "utf8",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
