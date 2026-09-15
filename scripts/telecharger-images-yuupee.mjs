// SacAdo — téléchargement + conversion WebP + hébergement Supabase des photos
// Yuupee (source : yuupee_images_urls.xlsx, onglet "Telechargement", exporté
// en JSON par le fondateur). Ne touche PAS la table produits (ces produits
// n'existent pas encore en base) : produit uniquement un manifeste
// id_produit -> photos hébergées, consommé par le futur script d'import.
//
// Règles du fondateur :
//   - url_800 en priorité (déjà généré par WordPress, pas de redimension
//     nécessaire en théorie) ; url_originale en repli si url_800 échoue.
//   - Convertir en WebP après téléchargement (source en .jpg/.png).
//   - Toujours plafonner à 800px de large (sécurité : ~260 lignes n'ont pas
//     de srcset exploitable, url_800 y retombe sur la vignette ou l'original
//     — on ne fait pas confiance à l'étiquette, on impose la borne nous-mêmes).
//   - Héberger sur Supabase Storage, jamais un lien direct vers yuupee.com.
//
// Usage : node scripts/telecharger-images-yuupee.mjs
// Reprise : relire manifeste.jsonl, ignorer les nom_fichier_cible déjà faits.
//
// Toutes les photos du manifeste sont téléversées ici, pas seulement celles
// qui seront finalement retenues par l'import (le script d'import choisit
// après coup combien de photos garder par produit). Une fois l'import terminé
// et les produits publiés, lancer scripts/purger-brouillons-images.mjs
// --prefixe=import-yuupee-photos pour déplacer les photos non retenues vers
// une corbeille réversible (jamais de suppression directe du bucket).
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

const SOURCE_JSON = "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/telechargement.json";
const MANIFESTE = "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/manifeste_telechargement.jsonl";
const BUCKET = "produits";
const PREFIXE_STOCKAGE = "import-yuupee-photos";

const LARGEUR_MAX = 800;
const LARGEUR_MIN_SOURCE = 400;
const TAILLE_MAX_OCTETS = 200 * 1024;
const CONCURRENCE = 10;
const TENTATIVES = 3;

function dejaFait() {
  if (!existsSync(MANIFESTE)) return new Set();
  const lignes = readFileSync(MANIFESTE, "utf8").split("\n").filter(Boolean);
  return new Set(lignes.map((l) => JSON.parse(l).nom_fichier_cible));
}

async function telecharger(url, tentatives = TENTATIVES) {
  for (let i = 1; i <= tentatives; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (SacAdo import)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("réponse vide");
      return buf;
    } catch (err) {
      if (i === tentatives) throw err;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

async function recadrer(buf) {
  // Les photos Yuupee sont posées sur un grand canevas blanc avec le produit
  // centré en petit : on rogne la marge unie avant tout redimensionnement,
  // sinon le produit n'occupe qu'une fraction de son cadre à l'affichage.
  try {
    return await sharp(buf).trim({ threshold: 12 }).toBuffer();
  } catch {
    return buf; // rien à rogner (pas de bordure unie détectée) : image inchangée
  }
}

async function convertirWebp(bufOriginal) {
  const buf = await recadrer(bufOriginal);
  let qualite = 82;
  let largeur = LARGEUR_MAX;
  for (let essai = 0; essai < 4; essai++) {
    const sortie = await sharp(buf)
      .resize({ width: largeur, withoutEnlargement: true })
      .webp({ quality: qualite })
      .toBuffer();
    if (sortie.length <= TAILLE_MAX_OCTETS || (qualite <= 55 && largeur <= 500)) {
      return sortie;
    }
    qualite -= 12;
    if (qualite <= 55) largeur = Math.round(largeur * 0.75);
  }
  // dernier essai, quoi qu'il arrive
  return sharp(buf).resize({ width: 500, withoutEnlargement: true }).webp({ quality: 55 }).toBuffer();
}

async function traiterLigne(ligne) {
  const cheminSortie = `${PREFIXE_STOCKAGE}/${ligne.nom_fichier_cible.replace(/\.[^.]+$/, "")}.webp`;

  let brut;
  let sourceUtilisee = "url_800";
  try {
    brut = await telecharger(ligne.url_800);
  } catch {
    if (!ligne.url_originale || ligne.url_originale === ligne.url_800) {
      return { ...basePourManifeste(ligne), ok: false, erreur: "url_800 et url_originale indisponibles" };
    }
    try {
      brut = await telecharger(ligne.url_originale);
      sourceUtilisee = "url_originale (repli)";
    } catch (err2) {
      return { ...basePourManifeste(ligne), ok: false, erreur: `échec des deux URL : ${err2.message}` };
    }
  }

  let meta;
  try {
    meta = await sharp(brut).metadata();
  } catch (err) {
    return { ...basePourManifeste(ligne), ok: false, erreur: `image illisible : ${err.message}` };
  }

  // Contrôle bloquant (TACHE_photos_et_accueil.md §A.2) : une source trop
  // petite ne doit jamais entrer au catalogue, agrandie ou non.
  if ((meta.width ?? 0) < LARGEUR_MIN_SOURCE) {
    return {
      ...basePourManifeste(ligne),
      ok: false,
      erreur: `source trop petite : ${meta.width}px < ${LARGEUR_MIN_SOURCE}px (source : ${sourceUtilisee})`,
    };
  }

  const webp = await convertirWebp(brut);

  const { error: errUpload } = await supabase.storage
    .from(BUCKET)
    .upload(cheminSortie, webp, { contentType: "image/webp", upsert: true });
  if (errUpload) {
    return { ...basePourManifeste(ligne), ok: false, erreur: `upload échoué : ${errUpload.message}` };
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(cheminSortie);

  return {
    ...basePourManifeste(ligne),
    ok: true,
    url_hebergee: data.publicUrl,
    largeur_source: meta.width,
    hauteur_source: meta.height,
    poids_octets: webp.length,
    source_utilisee: sourceUtilisee,
  };
}

function basePourManifeste(ligne) {
  return {
    id_produit: ligne.id_produit,
    index_photo: ligne.index_photo,
    nom_fichier_cible: ligne.nom_fichier_cible,
  };
}

async function main() {
  const lignes = JSON.parse(readFileSync(SOURCE_JSON, "utf8"));
  const fait = dejaFait();
  let restantes = lignes.filter((l) => !fait.has(l.nom_fichier_cible));
  if (process.env.LIMITE) restantes = restantes.slice(0, Number(process.env.LIMITE));

  console.log(`${lignes.length} lignes au total, ${fait.size} déjà traitées, ${restantes.length} restantes.`);

  let ok = 0;
  let echecs = 0;
  let curseur = 0;

  async function travailleur() {
    while (curseur < restantes.length) {
      const ligne = restantes[curseur++];
      const resultat = await traiterLigne(ligne);
      appendFileSync(MANIFESTE, JSON.stringify(resultat) + "\n");
      if (resultat.ok) {
        ok++;
        if (ok % 100 === 0) console.log(`  ${ok + echecs}/${restantes.length} (${ok} ok, ${echecs} échecs)`);
      } else {
        echecs++;
        console.log(`  ÉCHEC ${ligne.nom_fichier_cible} : ${resultat.erreur}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCE }, travailleur));

  console.log(`\nTerminé cette session : ${ok} ok, ${echecs} échecs.`);
  console.log(`Manifeste complet : ${MANIFESTE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
