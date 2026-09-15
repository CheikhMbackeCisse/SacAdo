// SacAdo — réparation (TACHE_reparation_128_photos.md, Groupe 1) : les 32
// photos Seye Dynamique issues de la séquence image1.png..image33.png
// (extraite d'un classeur Excel fournisseur) sont ressorties à exactement
// 155 px après import, alors que scripts/importer-seye-dynamique.mjs ne fait
// que .resize({ width: 800, withoutEnlargement: true }) — aucune écriture
// par-dessus l'original, aucun redimensionnement supplémentaire ailleurs
// dans le code (vérifié : aucun autre script/route ne réécrit le bucket
// `produits`). La source réelle du défaut est la compression d'image
// intégrée d'Excel, appliquée uniformément à toute la séquence numérotée —
// les deux produits Seye Dynamique dont la photo ne vient PAS de cette
// séquence (#90 dell_3190.jpg, #103 dell_5400_i7_new.jpg, fournis à part)
// n'ont jamais été concernés, ce qui confirme le diagnostic.
//
// Fichier fourni : photos_hd_lot2.zip/seye_dynamique/ (34 photos 1200px,
// suffixe _v2 — vraie source, jamais l'Excel). Contient aussi les 2 produits
// hors liste des 32 (déjà en 'publie', déjà >400px) : remplacées ici aussi
// par souci de qualité, sans toucher à leur statut_publication.
//
// Usage : node scripts/remplacer-photos-seye-dynamique-v2.mjs
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

const BUCKET = "produits";
const CORBEILLE = "_corbeille";
const PREFIXE_NOUVEAU = "import-sdt-v2";
const LARGEUR_MIN_SOURCE = 400;
const RACINE = "C:/Users/WORLD INFORMATIQUE/Downloads/files_13_extracted/photos_hd_lot2/seye_dynamique";
const MANIFESTE = "remplacement_photos_seye_v2.jsonl";

// Nom de fichier (sans suffixe _v2, sans extension) -> id produit. Les 32 de
// TACHE_reparation_128_photos.md + les 2 hors liste rattachés (voir en-tête).
const MAPPING = {
  SUPPORT_REFROIDISSEUR_POUR_ORDINATEUR_PORTABLE: 91,
  DELL_LATITUDE_3120: 92,
  HP_ELITEBOOK_1030_G1: 93,
  HP_ELITEBOOK_840_G3: 94,
  DELL_LATITUDE_5400: 95,
  DELL_LATITUDE_7490_TACTILE: 96,
  DELL_LATITUDE_5400_TACTILE: 97,
  HP_ELITEBOOK_840_G6: 98,
  HP_ELITEBOOK_735_G6: 99,
  DELL_LATITUDE_7390_2_EN_1: 100,
  HP_PROBOOK_450_G7: 101,
  HP_ELITEBOOK_830_G5_TACTILE: 102,
  DELL_LATITUDE_5400_TACTILE_CORE_I7: 103, // hors liste des 32, déjà publié, rattaché par qualité
  HP_ELITEBOOK_1030_G2: 104,
  HP_ELITEBOOK_840_G6_16_GO: 105,
  HP_ELITEBOOK_830_G6_X360: 106,
  HP_ELITEBOOK_X360_1030_G3: 107,
  LENOVO_THINKPAD_L13_GEN_3: 108,
  LENOVO_THINKPAD_L13_YOGA: 109,
  MICROSOFT_SURFACE_PRO_7: 110,
  DELL_LATITUDE_7320: 111,
  MICROSOFT_SURFACE_LAPTOP_4: 112,
  HP_ELITE_X2_1013_G8: 113,
  HP_ELITEBOOK_X360_1030_G7: 114,
  LENOVO_THINKPAD_T14_GEN_3: 115,
  MACBOOK_PRO_13_POUCES_M1_2020: 116,
  LENOVO_THINKPAD_P14S_GEN_3: 117,
  LENOVO_THINKPAD_X1_YOGA_GEN_6: 118,
  LENOVO_THINKPAD_P14S_GEN_4: 119,
  DELL_PRECISION_7760: 120,
  MACBOOK_PRO_16_POUCES_2021: 121,
  MSI_THIN_15: 122,
  ASUS_TUF_A15: 123,
  DELL_LATITUDE_3190_2_EN_1: 90, // hors liste des 32, déjà publié, rattaché par qualité
};

function urlPublique(chemin) {
  return supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
}

function cheminDepuisUrl(url) {
  const marqueur = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marqueur);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marqueur.length));
}

function dejaFait() {
  if (!existsSync(MANIFESTE)) return new Set();
  return new Set(
    readFileSync(MANIFESTE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((o) => o.ok).map((o) => o.fichier),
  );
}

async function main() {
  const fait = dejaFait();
  const entrees = Object.entries(MAPPING);
  console.log(`${entrees.length} photos à remplacer, ${fait.size} déjà faites.`);

  let ok = 0;
  let echecs = 0;

  for (const [fichier, id] of entrees) {
    if (fait.has(fichier)) continue;
    try {
      const cheminSource = path.join(RACINE, `${fichier}_v2.webp`);
      const buf = readFileSync(cheminSource);
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < LARGEUR_MIN_SOURCE) {
        throw new Error(`source encore trop petite : ${meta.width}px`);
      }

      const { data: produit, error: errSelect } = await supabase
        .from("produits")
        .select("id, nom, photo, photos")
        .eq("id", id)
        .single();
      if (errSelect || !produit) throw new Error(`produit #${id} introuvable : ${errSelect?.message}`);

      const ancienneUrl = produit.photo;
      const nouveauChemin = `${PREFIXE_NOUVEAU}/${fichier}.webp`;
      const { error: errUpload } = await supabase.storage.from(BUCKET).upload(nouveauChemin, buf, {
        contentType: "image/webp",
        upsert: false,
      });
      if (errUpload) throw new Error(`upload échoué : ${errUpload.message}`);
      const nouvelleUrl = urlPublique(nouveauChemin);

      const { error: errUpdate } = await supabase
        .from("produits")
        .update({ photo: nouvelleUrl, photos: [nouvelleUrl] })
        .eq("id", id);
      if (errUpdate) throw new Error(`mise à jour échouée : ${errUpdate.message}`);

      if (ancienneUrl) {
        const ancienChemin = cheminDepuisUrl(ancienneUrl);
        if (ancienChemin && !ancienChemin.startsWith(`${CORBEILLE}/`)) {
          const { error: errMove } = await supabase.storage.from(BUCKET).move(ancienChemin, `${CORBEILLE}/${ancienChemin}`);
          if (errMove) console.log(`  (avertissement) déplacement vers corbeille échoué pour ${ancienChemin} : ${errMove.message}`);
        }
      }

      appendFileSync(MANIFESTE, JSON.stringify({ ok: true, fichier, id, nom: produit.nom, largeur: meta.width, ancienneUrl, nouvelleUrl }) + "\n");
      console.log(`✓ ${fichier} -> #${id} (${produit.nom}), ${meta.width}px`);
      ok++;
    } catch (err) {
      appendFileSync(MANIFESTE, JSON.stringify({ ok: false, fichier, id, erreur: String(err.message ?? err) }) + "\n");
      console.log(`ÉCHEC ${fichier} (#${id}) : ${err.message ?? err}`);
      echecs++;
    }
  }

  console.log(`\n${ok} remplacées, ${echecs} échecs. Détail : ${MANIFESTE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
