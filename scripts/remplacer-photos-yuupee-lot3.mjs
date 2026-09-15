// SacAdo — réparation (TACHE_remplacement_14_photos.md) : 14 des 29 produits
// Yuupee restés sans photo exploitable après scripts/reparer-photos-yuupee.mjs
// (produit retiré du catalogue WooCommerce, API muette) reçoivent une vraie
// photo fournie séparément (photos_hd_lot3.zip, 1200px, correspondance par
// identifiant en préfixe de nom de fichier — aucun rapprochement à deviner).
//
// Écart assumé par rapport au document de tâche (voir chat) : la vignette
// 400px fournie en double n'est PAS téléversée séparément. Comme pour
// scripts/remplacer-photos-hd.mjs, next/image (next.config.ts, remotePatterns
// Supabase + formats AVIF/WebP) sert déjà des variantes redimensionnées à la
// volée dans les grilles à partir de la seule image 1200px — stocker un
// second fichier dédié serait une infrastructure parallèle inutilisée
// ailleurs dans le projet. Le document mentionne aussi une table
// `produits_images` qui n'existe pas dans ce projet (migration 0068 : choix
// assumé de réutiliser `produits.photos` jsonb) — non créée ici non plus.
//
// Republie automatiquement (statut_publication = 'publie') chaque produit
// traité, comme les scripts de réparation précédents.
//
// Usage : node scripts/remplacer-photos-yuupee-lot3.mjs
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
const PREFIXE_NOUVEAU = "import-yuupee-hd-v2";
const LARGEUR_MIN_SOURCE = 400;
const RACINE = "C:/Users/WORLD INFORMATIQUE/Downloads/files_14_extracted/photos_hd_lot3/yuupee";
const MANIFESTE = "remplacement_photos_yuupee_lot3.jsonl";

const CIBLES = [
  { id: 369, fichier: "369_CLE_USB_ADVANCE_32GO_v2.webp" },
  { id: 381, fichier: "381_CARTE_SD_SANDISK_ULTRA_SDHC_32GO_v2.webp" },
  { id: 504, fichier: "504_CARTOUCHE_HP_912XL_CYAN_v2.webp" },
  { id: 505, fichier: "505_CARTOUCHE_HP_912XL_MAGENTA_v2.webp" },
  { id: 506, fichier: "506_CARTOUCHE_HP_912XL_JAUNE_v2.webp" },
  { id: 507, fichier: "507_CARTOUCHE_HP_912XL_NOIR_v2.webp" },
  { id: 508, fichier: "508_CARTOUCHE_HP_950XL_NOIR_v2.webp" },
  { id: 517, fichier: "517_CARTOUCHE_HP_963XL_NOIR_v2.webp" },
  { id: 527, fichier: "527_CARTOUCHE_HP_301_TRICOLORE_v2.webp" },
  { id: 553, fichier: "553_TONER_HP_216A_MAGENTA_v2.webp" },
  { id: 642, fichier: "642_IMPRIMANTE_CANON_SELPHY_CP1500_v2.webp" },
  { id: 760, fichier: "760_ARDUINO_DUE_v2.webp" },
  { id: 1109, fichier: "1109_MODULE_LORA_RYLR998_v2.webp" },
  { id: 1110, fichier: "1110_ESC_30A_BRUSHLESS_v2.webp" },
];

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
    readFileSync(MANIFESTE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((o) => o.ok).map((o) => o.id),
  );
}

async function main() {
  const fait = dejaFait();
  let ok = 0;
  let echecs = 0;

  for (const cible of CIBLES) {
    if (fait.has(cible.id)) continue;
    try {
      const buf = readFileSync(path.join(RACINE, cible.fichier));
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < LARGEUR_MIN_SOURCE) throw new Error(`source encore trop petite : ${meta.width}px`);

      const { data: produit, error: errSelect } = await supabase
        .from("produits")
        .select("id, nom, photo")
        .eq("id", cible.id)
        .single();
      if (errSelect || !produit) throw new Error(`produit #${cible.id} introuvable : ${errSelect?.message}`);

      const ancienneUrl = produit.photo;
      const nouveauChemin = `${PREFIXE_NOUVEAU}/${cible.fichier}`;
      const { error: errUpload } = await supabase.storage.from(BUCKET).upload(nouveauChemin, buf, {
        contentType: "image/webp",
        upsert: false,
      });
      if (errUpload) throw new Error(`upload échoué : ${errUpload.message}`);
      const nouvelleUrl = urlPublique(nouveauChemin);

      const { error: errUpdate } = await supabase
        .from("produits")
        .update({ photo: nouvelleUrl, photos: [nouvelleUrl], statut_publication: "publie" })
        .eq("id", cible.id);
      if (errUpdate) throw new Error(`mise à jour échouée : ${errUpdate.message}`);

      if (ancienneUrl) {
        const ancienChemin = cheminDepuisUrl(ancienneUrl);
        if (ancienChemin && !ancienChemin.startsWith(`${CORBEILLE}/`)) {
          const { error: errMove } = await supabase.storage.from(BUCKET).move(ancienChemin, `${CORBEILLE}/${ancienChemin}`);
          if (errMove) console.log(`  (avertissement) déplacement vers corbeille échoué pour ${ancienChemin} : ${errMove.message}`);
        }
      }

      appendFileSync(MANIFESTE, JSON.stringify({ ok: true, id: cible.id, nom: produit.nom, largeur: meta.width, ancienneUrl, nouvelleUrl }) + "\n");
      console.log(`✓ #${cible.id} (${produit.nom}), ${meta.width}px, republié`);
      ok++;
    } catch (err) {
      appendFileSync(MANIFESTE, JSON.stringify({ ok: false, id: cible.id, erreur: String(err.message ?? err) }) + "\n");
      console.log(`ÉCHEC #${cible.id} : ${err.message ?? err}`);
      echecs++;
    }
  }

  console.log(`\n${ok} remplacées et republiées, ${echecs} échecs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
