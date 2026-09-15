// SacAdo — upload des 29 photos du petit catalogue "CATALOGUE YUUPEE IOT -
// OFFRE EDUCATIVE" (composants des kits, Chantier A). Contrairement aux 3
// gros classeurs, ce fichier n'a pas d'équivalent dans le scrape du site
// Yuupee (par_produit.json / manifeste_telechargement.json) : pas d'URL
// hébergeable à 800px, seulement les vignettes 78×78 déjà extraites
// (sortie/iot_composants/images, lot "extraction images"). On les héberge
// telles quelles : mieux qu'aucune photo, en attendant mieux du fournisseur.
// Usage : node scripts/uploader-photos-iot-composants.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
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

const DOSSIER_IMAGES =
  "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/sortie/iot_composants/images";
const MANIFESTE_SOURCE =
  "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/sortie/iot_composants/manifeste.json";
const SORTIE =
  "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/photos_iot_composants.json";

async function main() {
  const manifeste = JSON.parse(readFileSync(MANIFESTE_SOURCE, "utf8"));
  const resultats = [];

  for (const entree of manifeste) {
    const fichier = path.basename(entree.image); // "5.webp" etc. (nom = numéro de ligne)
    const cheminLocal = path.join(DOSSIER_IMAGES, path.basename(entree.image));
    const buf = await readFile(cheminLocal);
    const chemin = `import-yuupee-iot-composants/${fichier}`;
    const { error } = await supabase.storage
      .from("produits")
      .upload(chemin, buf, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(`Upload échoué (${fichier}) : ${error.message}`);
    const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
    resultats.push({ ligne: entree.ligne, designation: entree.designation, prix_public: entree.prix_public, url: data.publicUrl });
    console.log(`✓ ${entree.designation} -> ${data.publicUrl}`);
  }

  writeFileSync(SORTIE, JSON.stringify(resultats, null, 2), "utf8");
  console.log(`\n${resultats.length} photos hébergées. Manifeste : ${SORTIE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
