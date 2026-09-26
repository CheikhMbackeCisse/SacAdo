// Import du catalogue LPD (PROMPT_integration_LPD.md) : papeterie
// d'entrée de gamme + livres/manuels sourcés via LPD.
// Usage : node scripts/importer-lpd.mjs
// Prérequis : migration 0083 déjà exécutée en base. Lit .env.local. Idempotent
// par (vendeur_id, reference_fournisseur) : relancer met à jour un article déjà
// présent (prix, catégorie, photo…) au lieu d'en recréer un doublon — le
// prompt a été corrigé une première fois après le premier import (prix
// recalibrés, vraies photos fournies, unite_vente débloqué), ce script est
// désormais celui qui fait foi.
//
// Sources : manifest_lpd_v2.json, produit par scratchpad/build_manifest_v2.py
// à partir des 3 classeurs corrigés + IMAGES_LPD_pleine_resolution.zip
// (MANIFEST.csv : ref, produit, categorie, fichier, largeur, hauteur, publiable).
//
// Écarts assumés par rapport au prompt (comme les imports précédents,
// cf. importer-seye-dynamique.mjs) :
//   - `S066` (Cahier Calligraphe 200 pages) : le manifeste le marque
//     `publiable = oui`, mais l'image est une génération IA avec un logo
//     inventé et illisible (signalé explicitement par le prompt). Écartée
//     manuellement malgré le manifeste — jamais de photo générée au catalogue.
//   - Une seule taille stockée par photo (max 1200px, jamais agrandie), pas
//     de fichier 400px séparé : next/image sert déjà les tailles réduites à
//     la volée depuis une source ≥ 400px (next.config.ts), comme pour tous
//     les imports précédents.
//   - `S065` (crayons Sénégal) scindé en 2 produits distincts : lot de 12
//     (600 FCFA, `unite_vente = paquet`, `quantite_conditionnement = 12`,
//     réf. `S065`) et à l'unité (75 FCFA, `unite_vente = unite`, nouvelle
//     réf. `S065-UNITE`) — les deux conditionnements confirmés par la Note
//     du classeur, tous deux rattachés à la même photo.
//   - Livres (35 + 235) : aucune couverture fournie dans ce lot (le manifeste
//     d'images ne couvre que la papeterie). Import masqué sans photo, comme
//     avant — seuls les prix/catégories sont corrigés.
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { decoderEntitesHtml } from "./lib/entites-html.mjs";

const MANIFEST = process.env.MANIFEST ?? "C:\\Users\\WORLD INFORMATIQUE\\Downloads\\files17_extracted\\manifest_lpd_v2.json";
const RAPPORT = "rapport_import_lpd.md";

const VENDEUR_NOM = "LPD";
const DELAI = "6j";
const LARGEUR_MAX = 1200;
const LARGEUR_MIN_SOURCE = 380; // tolérance assumée du prompt (386-399px acceptés par l'équipe)
const QUALITE_WEBP = 82;

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

function snifferImage(octets) {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return "jpg";
  if (
    octets.length >= 8 &&
    octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47 &&
    octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a
  ) return "png";
  if (
    octets.length >= 12 &&
    octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46 &&
    octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50
  ) return "webp";
  return null;
}

async function uploaderPhoto(fichier, ref) {
  const buf = await readFile(fichier);
  if (!snifferImage(buf.subarray(0, 12))) {
    throw new Error(`Fichier non reconnu comme image : ${fichier}`);
  }
  const { width } = await sharp(buf).metadata();
  if ((width ?? 0) < LARGEUR_MIN_SOURCE) {
    throw new Error(`source trop petite : ${fichier} fait ${width}px (minimum ${LARGEUR_MIN_SOURCE}px)`);
  }
  const webp = await sharp(buf)
    .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer();
  const chemin = `import-lpd/${ref}-${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${fichier}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

async function assurerVendeurLPD() {
  const { data: existant, error } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", VENDEUR_NOM)
    .maybeSingle();
  if (error) throw new Error(`Lecture vendeur échouée : ${error.message}`);
  if (existant) return existant.id;

  const { data: cree, error: errCreation } = await supabase
    .from("vendeurs")
    .insert({ nom_boutique: VENDEUR_NOM, user_id: null, actif: true })
    .select("id")
    .single();
  if (errCreation || !cree) throw new Error(`Création du vendeur LPD échouée : ${errCreation?.message}`);
  console.log(`✓ fournisseur créé : ${VENDEUR_NOM} (#${cree.id})`);
  return cree.id;
}

// Le manifeste source contient parfois des entités HTML non décodées
// (ex. "d&rsquo;activités", "&#8211;") — voir maj-26-09 §3.
function construireLigne(item, vendeurId) {
  return {
    nom: decoderEntitesHtml(item.nom),
    categorie_id: item.categorie_id,
    sous_categorie_id: null,
    prix: item.prix,
    prix_achat: item.prix_achat ?? null,
    prix_achat_previsionnel: item.prix_achat_previsionnel ?? false,
    prix_a_verifier: item.prix_a_verifier ?? false,
    delai: DELAI,
    stock: 0,
    statut: "dispo",
    statut_publication: "en_attente",
    publie_par: "admin",
    vendeur_id: vendeurId,
    reference_fournisseur: item.reference_fournisseur,
    gamme: "essentiel",
    unite_vente: item.unite_vente ?? "unite",
    quantite_conditionnement: item.quantite_conditionnement ?? null,
    mots_cles: item.mots_cles ?? null,
    auteur: item.auteur ?? null,
    editeur: item.editeur ?? null,
    type_ouvrage: item.type_ouvrage ?? null,
    niveau: item.niveau ?? null,
  };
}

async function importerLot(items, source, vendeurId, journal) {
  let crees = 0;
  let mis_a_jour = 0;
  for (const item of items) {
    const { data: existant, error: errLecture } = await supabase
      .from("produits")
      .select("id, photo")
      .eq("vendeur_id", vendeurId)
      .eq("reference_fournisseur", item.reference_fournisseur)
      .maybeSingle();
    if (errLecture) throw new Error(`Lecture échouée (${item.reference_fournisseur}) : ${errLecture.message}`);

    const ligne = construireLigne(item, vendeurId);

    // Photo : uploadée une seule fois. Si le produit existe déjà et a déjà
    // une photo, on ne la remplace pas (évite de recréer un fichier storage
    // à chaque relance) — sauf si l'item n'a explicitement plus de source
    // (jamais le cas ici, une photo publiable ne redevient pas non publiable).
    if (item.photo_fichier && !(existant?.photo)) {
      console.log(`… photo : ${item.reference_fournisseur} — ${item.nom}`);
      const url = await uploaderPhoto(item.photo_fichier, item.reference_fournisseur);
      ligne.photo = url;
      ligne.photos = [url];
    } else if (existant?.photo) {
      ligne.photo = existant.photo; // conserve la photo déjà en place
    } else {
      ligne.photo = null;
    }

    if (existant) {
      const { error } = await supabase.from("produits").update(ligne).eq("id", existant.id);
      if (error) throw new Error(`Mise à jour échouée (${item.reference_fournisseur} — ${item.nom}) : ${error.message}`);
      console.log(`↻ mis à jour #${existant.id} : ${item.reference_fournisseur} — ${item.nom}`);
      mis_a_jour++;
      journal.push({
        ref: item.reference_fournisseur, produit_id: existant.id, nom: item.nom, source,
        publiable: !item.motif_non_publiable, motif_non_publiable: item.motif_non_publiable ?? null,
      });
      continue;
    }

    const { data: cree, error } = await supabase.from("produits").insert(ligne).select("id").single();
    if (error || !cree) {
      throw new Error(`Création échouée (${item.reference_fournisseur} — ${item.nom}) : ${error?.message}`);
    }
    console.log(`✓ créé #${cree.id} : ${item.reference_fournisseur} — ${item.nom}`);
    crees++;
    journal.push({
      ref: item.reference_fournisseur, produit_id: cree.id, nom: item.nom, source,
      publiable: !item.motif_non_publiable, motif_non_publiable: item.motif_non_publiable ?? null,
    });
  }
  return { crees, mis_a_jour };
}

function construireRapport(journal, resultats) {
  const parMotif = new Map();
  for (const j of journal) {
    if (!j.motif_non_publiable) continue;
    if (!parMotif.has(j.motif_non_publiable)) parMotif.set(j.motif_non_publiable, []);
    parMotif.get(j.motif_non_publiable).push(j);
  }

  const lignes = [];
  lignes.push("# Rapport d'import LPD");
  lignes.push("");
  lignes.push(`Généré le ${new Date().toISOString().slice(0, 10)} par scripts/importer-lpd.mjs.`);
  lignes.push("");
  lignes.push("## Résumé");
  lignes.push("");
  for (const [source, r] of Object.entries(resultats)) {
    lignes.push(`- **${source}** : ${r.crees} créés, ${r.mis_a_jour} mis à jour.`);
  }
  lignes.push("");
  lignes.push(
    "Tous les articles sont importés **masqués** (`statut_publication = en_attente`). " +
    "`unite_vente = unite` partout (décision commerciale, ne bloque pas la publication), " +
    "sauf le lot de crayons Sénégal (`S065`, `paquet` de 12) scindé de sa version à " +
    "l'unité (`S065-UNITE`). La papeterie a une vraie photo quand le manifeste la " +
    "juge publiable ; les livres n'en ont aucune dans ce lot (couvertures non fournies).",
  );
  lignes.push("");
  lignes.push("## Articles non publiables, par motif");
  lignes.push("");
  for (const [motif, items] of parMotif) {
    lignes.push(`### ${motif} (${items.length})`);
    lignes.push("");
    for (const it of items) {
      lignes.push(`- \`${it.ref}\` #${it.produit_id} — ${it.nom} (${it.source})`);
    }
    lignes.push("");
  }
  return lignes.join("\n");
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const vendeurId = await assurerVendeurLPD();

  const journal = [];
  const resultats = {};
  resultats.grille = await importerLot(manifest.grille, "grille", vendeurId, journal);
  resultats.livres_lpd = await importerLot(manifest.livres_lpd, "livres_lpd", vendeurId, journal);
  resultats.catalogue_livres = await importerLot(manifest.catalogue_livres, "catalogue_livres", vendeurId, journal);

  const totalCrees = Object.values(resultats).reduce((s, r) => s + r.crees, 0);
  const totalMaj = Object.values(resultats).reduce((s, r) => s + r.mis_a_jour, 0);
  console.log(`\nTerminé : ${totalCrees} créés, ${totalMaj} mis à jour.`);

  const rapport = construireRapport(journal, resultats);
  await writeFile(RAPPORT, rapport, "utf8");
  console.log(`Rapport écrit : ${RAPPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
