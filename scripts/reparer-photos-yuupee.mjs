// SacAdo — réparation (TACHE_photos_et_accueil.md, chantier A.3) : les photos
// Yuupee sous 400 px viennent d'une vignette WordPress trop petite (le
// script d'import d'origine, scripts/telecharger-images-yuupee.mjs, utilisait
// url_800 sans savoir qu'il retombait parfois sur une vignette). Ce script
// re-télécharge la vraie photo produit (`images[].src`, jamais `thumbnail`)
// depuis l'API WooCommerce Store officielle de yuupee.com, par id_produit.
//
// L'id_produit Yuupee/WooCommerce est récupérable directement dans le chemin
// de stockage déjà en base : import-yuupee-photos/{id_produit}_{index}.webp
// (voir manifeste_telechargement.jsonl / produits_a_importer.json). On
// réécrit le même fichier de storage (même URL, upsert) : aucune mise à jour
// de `produits.photo`/`photos` n'est nécessaire.
//
// Usage : node scripts/reparer-photos-yuupee.mjs
// Entrée : rapport_photos_sous_400px.jsonl (scripts/mesurer-photos-catalogue.mjs)
// Sortie : reparation_yuupee.jsonl (reprise : les chemins déjà réussis sont sautés).
import { readFileSync, appendFileSync, existsSync } from "node:fs";
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

const RAPPORT = "rapport_photos_sous_400px.jsonl";
const MANIFESTE = "reparation_yuupee.jsonl";
const BUCKET = "produits";
const PREFIXE = "import-yuupee-photos";
const LARGEUR_MAX = 800;
const LARGEUR_MIN_SOURCE = 400;
const TAILLE_MAX_OCTETS = 200 * 1024;
const TAILLE_LOT_API = 80;
const CONCURRENCE = 6;

function dejaFait() {
  if (!existsSync(MANIFESTE)) return new Set();
  return new Set(
    readFileSync(MANIFESTE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((o) => o.ok)
      .map((o) => o.chemin),
  );
}

// Reconnaît import-yuupee-photos/{id_produit}_{index}.webp et en extrait les
// deux parties. Les 29 produits IoT (import-yuupee-iot-composants/) n'ont
// pas cette forme : id_produit non récupérable, hors périmètre de ce script.
function analyserChemin(url) {
  const m = url.match(/import-yuupee-photos\/(\d+)_(\d+)\.webp$/);
  if (!m) return null;
  return { chemin: `${PREFIXE}/${m[1]}_${m[2]}.webp`, idProduit: Number(m[1]), index: Number(m[2]) };
}

async function recupererProduits(ids) {
  const parId = new Map();
  for (let i = 0; i < ids.length; i += TAILLE_LOT_API) {
    const lot = ids.slice(i, i + TAILLE_LOT_API);
    const res = await fetch(
      `https://yuupee.com/wp-json/wc/store/v1/products?include=${lot.join(",")}&per_page=${lot.length}`,
      { headers: { "User-Agent": "Mozilla/5.0 (SacAdo réparation photos)" } },
    );
    if (!res.ok) throw new Error(`API Yuupee HTTP ${res.status} (lot ${i / TAILLE_LOT_API + 1})`);
    const data = await res.json();
    for (const p of data) parId.set(p.id, p);
    console.log(`  API : lot ${i / TAILLE_LOT_API + 1}, ${data.length}/${lot.length} produits trouvés`);
  }
  return parId;
}

async function telecharger(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (SacAdo réparation photos)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function convertirWebp(buf) {
  let qualite = 82;
  let largeur = LARGEUR_MAX;
  for (let essai = 0; essai < 4; essai++) {
    const sortie = await sharp(buf).resize({ width: largeur, withoutEnlargement: true }).webp({ quality: qualite }).toBuffer();
    if (sortie.length <= TAILLE_MAX_OCTETS || (qualite <= 55 && largeur <= 500)) return sortie;
    qualite -= 12;
    if (qualite <= 55) largeur = Math.round(largeur * 0.75);
  }
  return sharp(buf).resize({ width: 500, withoutEnlargement: true }).webp({ quality: 55 }).toBuffer();
}

async function main() {
  const rapport = readFileSync(RAPPORT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const produitsYuupee = rapport.filter((p) => p.vendeur === "Yuupee");

  const cibles = [];
  for (const p of produitsYuupee) {
    for (const photo of p.photos_sous_400px) {
      const analyse = analyserChemin(photo.url);
      if (!analyse) continue; // IoT composants ou autre motif : hors périmètre
      cibles.push({ ...analyse, produitId: p.id, produitNom: p.nom, largeurActuelle: photo.largeur });
    }
  }
  console.log(`${cibles.length} photos Yuupee à réparer (sur ${produitsYuupee.length} produits signalés).`);

  const fait = dejaFait();
  const restantes = cibles.filter((c) => !fait.has(c.chemin));
  console.log(`${fait.size} déjà réparées, ${restantes.length} restantes.`);
  if (restantes.length === 0) return;

  const idsUniques = [...new Set(restantes.map((c) => c.idProduit))];
  console.log(`Interrogation de l'API Yuupee pour ${idsUniques.length} id_produit...`);
  const produitsApi = await recupererProduits(idsUniques);

  // Le champ `index` de nos chemins ne correspond pas forcément à la position
  // de la même vue dans le tableau `images` de l'API (constaté : la plupart
  // des échecs venaient de là, pas d'un manque réel de source). On mesure
  // donc TOUTES les images disponibles pour le produit et on retient la plus
  // grande, une seule fois par produit — réutilisée pour chaque chemin/index
  // encore sous 400px de ce produit.
  const meilleureParProduit = new Map();
  function trouverMeilleureImage(idProduit) {
    if (meilleureParProduit.has(idProduit)) return meilleureParProduit.get(idProduit);
    const promesse = (async () => {
      const produitApi = produitsApi.get(idProduit);
      if (!produitApi) return { erreur: "id_produit introuvable côté API Yuupee (produit retiré du site ?)" };
      let meilleur = null;
      for (const image of produitApi.images ?? []) {
        if (!image?.src) continue;
        try {
          const brut = await telecharger(image.src);
          const meta = await sharp(brut).metadata();
          if ((meta.width ?? 0) > (meilleur?.largeur ?? 0)) {
            meilleur = { brut, largeur: meta.width ?? 0 };
          }
        } catch {
          // image individuelle inaccessible : on continue avec les autres
        }
      }
      return meilleur ?? { erreur: "aucune image exploitable côté API" };
    })();
    meilleureParProduit.set(idProduit, promesse);
    return promesse;
  }

  let curseur = 0;
  let ok = 0;
  let echecs = 0;
  async function travailleur() {
    while (curseur < restantes.length) {
      const cible = restantes[curseur++];
      try {
        const meilleur = await trouverMeilleureImage(cible.idProduit);
        if (meilleur.erreur) throw new Error(meilleur.erreur);
        if (meilleur.largeur < LARGEUR_MIN_SOURCE) {
          throw new Error(`source API encore trop petite : ${meilleur.largeur}px (meilleure disponible)`);
        }

        const webp = await convertirWebp(meilleur.brut);
        const { error } = await supabase.storage.from(BUCKET).upload(cible.chemin, webp, {
          contentType: "image/webp",
          upsert: true,
        });
        if (error) throw new Error(`upload échoué : ${error.message}`);

        appendFileSync(
          MANIFESTE,
          JSON.stringify({ ok: true, chemin: cible.chemin, produitId: cible.produitId, produitNom: cible.produitNom, largeurAvant: cible.largeurActuelle, largeurApres: meilleur.largeur }) + "\n",
        );
        ok++;
      } catch (err) {
        appendFileSync(
          MANIFESTE,
          JSON.stringify({ ok: false, chemin: cible.chemin, produitId: cible.produitId, produitNom: cible.produitNom, erreur: String(err.message ?? err) }) + "\n",
        );
        echecs++;
      }
      if ((ok + echecs) % 50 === 0) console.log(`  ${ok + echecs}/${restantes.length} (${ok} ok, ${echecs} échecs)`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCE }, travailleur));

  console.log(`\nTerminé : ${ok} ok, ${echecs} échecs.`);
  console.log(`Détail : ${MANIFESTE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
