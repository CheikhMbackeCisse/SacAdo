// Ajoute les couvertures livres LPD (35 Livres LPD + 235 Didactikos/Niokobok)
// et publie les 269 qui ont une image publiable, sur demande du fondateur
// (chat du 2026-09-20). LIT-023 reste masqué : seule référence non publiable
// du manifeste (203px, sous le plancher de 400px), aucune dérogation demandée
// pour celle-ci contrairement aux 10 articles papeterie.
// Usage : node scripts/publier-lpd-livres.mjs
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const IMAGES_DIR = "C:\\Users\\WORLD INFORMATIQUE\\Downloads\\images_livres_extracted\\IMAGES_LIVRES_pleine_resolution (1)";

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

// Découpe une ligne CSV en respectant les champs entre guillemets (titres de
// livres contenant des virgules, ex. "La Rue Cases-Nègres, Joseph Zobel").
function decouperLigneCsv(ligne) {
  const champs = [];
  let courant = "";
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      dansGuillemets = !dansGuillemets;
    } else if (c === "," && !dansGuillemets) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs;
}

function parseCsv(texte) {
  const [header, ...lignes] = texte.trim().split("\n").map((l) => l.replace(/\r$/, ""));
  const cols = decouperLigneCsv(header);
  return lignes.map((l) => {
    const vals = decouperLigneCsv(l);
    return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
  });
}

async function uploaderPhoto(fichier, ref) {
  const buf = await readFile(fichier);
  const webp = await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const chemin = `import-lpd/${ref}-${randomUUID()}.webp`;
  const { error } = await supabase.storage.from("produits").upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${fichier}) : ${error.message}`);
  return supabase.storage.from("produits").getPublicUrl(chemin).data.publicUrl;
}

async function main() {
  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "LPD").maybeSingle();
  if (!vendeur) throw new Error("Vendeur LPD introuvable.");

  const csv = await readFile(IMAGES_DIR + "\\MANIFEST.csv", "utf8");
  const lignes = parseCsv(csv);
  console.log(`${lignes.length} lignes dans le manifeste.`);

  let photoAjoutee = 0;
  let publies = 0;
  let sansPhoto = [];

  for (const ligne of lignes) {
    const ref = ligne.ref;
    const { data: produit, error: errLecture } = await supabase
      .from("produits")
      .select("id, photo, statut_publication")
      .eq("vendeur_id", vendeur.id)
      .eq("reference_fournisseur", ref)
      .maybeSingle();
    if (errLecture) throw new Error(`Lecture échouée (${ref}) : ${errLecture.message}`);
    if (!produit) {
      console.log(`! ${ref} introuvable en base, ignoré`);
      continue;
    }

    if (ligne.publiable !== "oui") {
      sansPhoto.push(ref);
      continue;
    }

    if (!produit.photo) {
      const url = await uploaderPhoto(`${IMAGES_DIR}\\${ligne.fichier}`, ref);
      const { error } = await supabase.from("produits").update({ photo: url, photos: [url] }).eq("id", produit.id);
      if (error) throw new Error(`Mise à jour photo échouée (${ref}) : ${error.message}`);
      console.log(`✓ photo ajoutée : ${ref} — ${ligne.produit}`);
      photoAjoutee++;
    }

    if (produit.statut_publication !== "publie") {
      const { error } = await supabase.from("produits").update({ statut_publication: "publie" }).eq("id", produit.id);
      if (error) throw new Error(`Publication échouée (${ref}) : ${error.message}`);
      console.log(`✓ publié : ${ref}`);
      publies++;
    }
  }

  console.log(`\nTerminé : ${photoAjoutee} photos ajoutées, ${publies} publiés.`);
  console.log(`Restent masqués (sans photo publiable) : ${sansPhoto.length}`, sansPhoto);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
