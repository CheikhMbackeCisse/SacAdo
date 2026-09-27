// CORRECTIONS_KITS Lot 5 §2 : peuple kits.images_mosaique (migration 0090)
// depuis l'onglet "Images du kit" de kits_sacado_final.xlsx (cahier,
// géométrie, livre, stylos — dans cet ordre, ids dédupliqués).
// Usage : node scripts/lot5-images-kits.mjs --dry-run
//         node scripts/lot5-images-kits.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = "kits_sacado_final.xlsx";

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

const PRODUIT_ID_PAR_CLE = { TP100: 1728, TP200: 1729 };

function resoudreProduitId(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (PRODUIT_ID_PAR_CLE[valeur] !== undefined) return PRODUIT_ID_PAR_CLE[valeur];
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const wb = XLSX.read(readFileSync(FICHIER), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Images du kit"], { defval: null });

  const { data: kits, error: errKits } = await supabase.from("kits").select("id, nom");
  if (errKits) throw new Error(`Lecture kits échouée : ${errKits.message}`);
  const kitIdParNom = new Map(kits.map((k) => [k.nom, k.id]));

  let maj = 0;
  const erreurs = [];

  for (const ligne of rows) {
    const nomKit = ligne["Kit"];
    const kitId = kitIdParNom.get(nomKit);
    if (!kitId) {
      erreurs.push(`Kit introuvable : ${nomKit}`);
      continue;
    }

    const brut = [
      ligne["Image 1 : cahier"],
      ligne["Image 2 : géométrie"],
      ligne["Image 3 : livre"],
      ligne["Image 4 : stylos"],
    ].map(resoudreProduitId);

    // Dédup en conservant l'ordre (§2 : "si deux ID sont identiques, n'afficher l'image qu'une fois").
    const ids = [...new Set(brut.filter((id) => id !== null))];

    console.log(`${DRY_RUN ? "[dry-run] " : ""}#${kitId} ${nomKit} : [${ids.join(", ")}]`);
    if (!DRY_RUN) {
      const { error } = await supabase.from("kits").update({ images_mosaique: ids }).eq("id", kitId);
      if (error) {
        erreurs.push(`#${kitId} ${nomKit} : ${error.message}`);
        continue;
      }
    }
    maj++;
  }

  console.log(`\n${maj}/${rows.length} kits mis à jour, ${erreurs.length} erreurs.`);
  if (erreurs.length > 0) {
    console.log("\n--- Erreurs ---");
    erreurs.forEach((e) => console.log("- " + e));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
