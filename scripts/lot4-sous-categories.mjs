// CORRECTIONS_KITS Lot 4 : sous_categories_produits.xlsx.
// Onglet "Arborescence" : crée les sous-catégories "Nouvelle", renomme celles
// marquées "Renommer" (garde leur id). Usage :
//   node scripts/lot4-sous-categories.mjs --dry-run
//   node scripts/lot4-sous-categories.mjs
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

function slugify(texte) {
  return texte
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Extrait le nom actuel entre « » d'une remarque "Renommer l'existante « X »".
function nomActuelDepuisRemarque(remarque) {
  const m = remarque.match(/«\s*(.+?)\s*»/);
  return m ? m[1] : null;
}

async function main() {
  const wb = XLSX.read(readFileSync(FICHIER), { type: "buffer" });
  const arbo = XLSX.utils.sheet_to_json(wb.Sheets["Arborescence"], { defval: null });

  const { data: categories, error: errCat } = await supabase.from("categories").select("id, nom");
  if (errCat) throw new Error(`Lecture catégories échouée : ${errCat.message}`);
  const categorieIdParNom = new Map(categories.map((c) => [c.nom, c.id]));

  const { data: sousCategories, error: errSc } = await supabase
    .from("sous_categories")
    .select("id, nom, categorie_id, ordre");
  if (errSc) throw new Error(`Lecture sous-catégories échouée : ${errSc.message}`);

  let crees = 0;
  let renommees = 0;
  const erreurs = [];

  for (const ligne of arbo) {
    const remarque = (ligne["Remarque"] ?? "").toString().trim();
    if (!remarque) continue;

    const categorieId = categorieIdParNom.get(ligne["Catégorie"]);
    if (!categorieId) {
      erreurs.push(`Catégorie introuvable : ${ligne["Catégorie"]}`);
      continue;
    }

    if (remarque === "Nouvelle") {
      const nom = ligne["Sous-catégorie"];
      const slug = slugify(nom);
      const dejaLa = sousCategories.find((s) => s.categorie_id === categorieId && s.nom === nom);
      if (dejaLa) {
        console.log(`= déjà existante : ${ligne["Catégorie"]} / ${nom}`);
        continue;
      }
      const ordreMax = Math.max(
        0,
        ...sousCategories.filter((s) => s.categorie_id === categorieId).map((s) => s.ordre),
      );
      console.log(`${DRY_RUN ? "[dry-run] " : ""}créer sous-catégorie : ${ligne["Catégorie"]} / ${nom} (slug ${slug}, ordre ${ordreMax + 1})`);
      if (!DRY_RUN) {
        const { data: cree, error } = await supabase
          .from("sous_categories")
          .insert({ nom, slug, categorie_id: categorieId, ordre: ordreMax + 1 })
          .select("id, nom, categorie_id, ordre")
          .single();
        if (error) {
          erreurs.push(`Création "${nom}" : ${error.message}`);
          continue;
        }
        sousCategories.push(cree);
      }
      crees++;
      continue;
    }

    if (remarque.startsWith("Renommer")) {
      const nomActuel = nomActuelDepuisRemarque(remarque);
      const nomCible = ligne["Sous-catégorie"];
      const existante = sousCategories.find((s) => s.categorie_id === categorieId && s.nom === nomActuel);
      if (!existante) {
        erreurs.push(`Renommer "${nomActuel}" -> "${nomCible}" : sous-catégorie actuelle introuvable (catégorie ${ligne["Catégorie"]})`);
        continue;
      }
      const nouveauSlug = slugify(nomCible);
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}renommer #${existante.id} : "${nomActuel}" -> "${nomCible}" (slug ${nouveauSlug})`,
      );
      if (!DRY_RUN) {
        const { error } = await supabase
          .from("sous_categories")
          .update({ nom: nomCible, slug: nouveauSlug })
          .eq("id", existante.id);
        if (error) {
          erreurs.push(`Renommage #${existante.id} : ${error.message}`);
          continue;
        }
        existante.nom = nomCible;
      }
      renommees++;
      continue;
    }
  }

  console.log("");
  console.log(`Créées : ${crees}, renommées : ${renommees}, erreurs : ${erreurs.length}`);
  if (erreurs.length > 0) {
    console.log("\n--- Erreurs ---");
    erreurs.forEach((e) => console.log("- " + e));
  }

  if (!DRY_RUN) {
    writeFileSync(
      "rapport-lot4-sous-categories.md",
      [
        "# Rapport Lot 4 — sous-catégories",
        "",
        `Lancé le ${new Date().toISOString()}.`,
        "",
        `- Créées : ${crees}`,
        `- Renommées : ${renommees}`,
        `- Erreurs : ${erreurs.length}`,
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
