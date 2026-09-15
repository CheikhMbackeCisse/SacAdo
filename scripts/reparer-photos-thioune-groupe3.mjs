// SacAdo — réparation (TACHE_reparation_128_photos.md, Groupe 3) : 3 des 8
// accessoires Thioune Teranga restés en vignette 78 px après
// scripts/reparer-photos-thioune-lot1.mjs (hors périmètre à l'époque, source
// inconnue). Deux photos réelles (envois WhatsApp du fournisseur) sont
// désormais fournies dans photos_hd_lot2.zip/thioune_teranga/ :
//   - SUPPORT_PLIABLE_ALUMINIUM_LAPTOP_v2.webp -> #1136
//   - CLE_USB_WIFI_ADAPTATEUR_v2.webp -> #1134 ET #1135 (même photo)
// Les 5 autres (#1129, #1130, #1131, #1132, #1137) restent sans source et
// donc dépubliés (déjà en_attente depuis depublier-thioune-lot1.mjs).
//
// Republie automatiquement (statut_publication = 'publie') chaque produit
// dont la nouvelle photo atteint bien 400 px, comme reparer-photos-thioune-lot1.mjs.
//
// Usage : node scripts/reparer-photos-thioune-groupe3.mjs
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
const PREFIXE_NOUVEAU = "import-tt-v2";
const LARGEUR_MIN_SOURCE = 400;
const RACINE = "C:/Users/WORLD INFORMATIQUE/Downloads/files_13_extracted/photos_hd_lot2/thioune_teranga";
const MANIFESTE = "reparation_thioune_groupe3.jsonl";

const CIBLES = [
  { fichier: "SUPPORT_PLIABLE_ALUMINIUM_LAPTOP", id: 1136 },
  { fichier: "CLE_USB_WIFI_ADAPTATEUR", id: 1134 },
  { fichier: "CLE_USB_WIFI_ADAPTATEUR", id: 1135 },
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
      const cheminSource = path.join(RACINE, `${cible.fichier}_v2.webp`);
      const buf = readFileSync(cheminSource);
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < LARGEUR_MIN_SOURCE) throw new Error(`source encore trop petite : ${meta.width}px`);

      const { data: produit, error: errSelect } = await supabase
        .from("produits")
        .select("id, nom, photo")
        .eq("id", cible.id)
        .single();
      if (errSelect || !produit) throw new Error(`produit #${cible.id} introuvable : ${errSelect?.message}`);

      const ancienneUrl = produit.photo;
      // Chemin distinct par id (même fichier source réutilisé pour 1134/1135) : deux
      // objets storage séparés, jamais deux lignes produits pointant le même chemin
      // sous un même nom déjà utilisé par un autre produit.
      const nouveauChemin = `${PREFIXE_NOUVEAU}/${cible.fichier}_${cible.id}.webp`;
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

      appendFileSync(MANIFESTE, JSON.stringify({ ok: true, fichier: cible.fichier, id: cible.id, nom: produit.nom, largeur: meta.width, ancienneUrl, nouvelleUrl }) + "\n");
      console.log(`✓ ${cible.fichier} -> #${cible.id} (${produit.nom}), ${meta.width}px, republié`);
      ok++;
    } catch (err) {
      appendFileSync(MANIFESTE, JSON.stringify({ ok: false, fichier: cible.fichier, id: cible.id, erreur: String(err.message ?? err) }) + "\n");
      console.log(`ÉCHEC ${cible.fichier} (#${cible.id}) : ${err.message ?? err}`);
      echecs++;
    }
  }

  console.log(`\n${ok} réparés et republiés, ${echecs} échecs.`);
  console.log(`Restent dépubliés, sans source connue : #1129, #1130, #1131, #1132, #1137.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
