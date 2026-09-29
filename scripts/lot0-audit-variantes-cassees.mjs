// LOT 0 (lecture seule) : recense TOUTES les photos produit dont l'URL,
// une fois passée dans le chargeur d'image réel
// (lib/images/supabase-image-loader.ts), pointe vers un fichier qui
// n'existe pas dans le bucket Storage "produits".
//
// Reproduit exactement la logique du chargeur (VARIANT_SUFFIX regex +
// KNOWN_WIDTHS) sans le modifier, pour les deux tailles réellement
// demandées en production (400 et 800 — voir le commentaire du loader :
// -1200 n'est jamais demandé par le composant <Image>, seulement par le
// zoom en repli manuel). Ne modifie rien : affiche juste la liste.
//
// Usage : node scripts/lot0-audit-variantes-cassees.mjs
import { readFileSync } from "node:fs";
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

const BUCKET = "produits";
const PREFIXE_URL = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const VARIANT_SUFFIX = /-(400|800|1200)(\.webp)$/i;
const KNOWN_WIDTHS = [400, 800];

function matchProductPhotoVariant(src) {
  if (!src.includes("/storage/v1/object/public/produits/")) return null;
  const match = src.match(VARIANT_SUFFIX);
  if (!match || match.index === undefined) return null;
  return { base: src.slice(0, match.index), ext: match[2] };
}

function urlsDemandeesParLeChargeur(src) {
  const parsed = matchProductPhotoVariant(src);
  if (!parsed) return null; // le chargeur sert l'URL telle quelle, jamais de variante recomposée
  return KNOWN_WIDTHS.map((w) => `${parsed.base}-${w}${parsed.ext}`);
}

function cheminDepuisUrl(url) {
  if (!url.startsWith(PREFIXE_URL)) return null;
  return decodeURIComponent(url.slice(PREFIXE_URL.length));
}

async function listerDossier(chemin) {
  const fichiers = new Set();
  const TAILLE_PAGE = 1000;
  for (let offset = 0; ; offset += TAILLE_PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(chemin, { limit: TAILLE_PAGE, offset });
    if (error) throw new Error(`list(${chemin}) : ${error.message}`);
    for (const entree of data) {
      const chemComplet = chemin ? `${chemin}/${entree.name}` : entree.name;
      if (entree.id == null) {
        for (const f of await listerDossier(chemComplet)) fichiers.add(f);
      } else {
        fichiers.add(chemComplet);
      }
    }
    if (data.length < TAILLE_PAGE) break;
  }
  return fichiers;
}

async function toutesLesLignes() {
  const lignes = [];
  const TAILLE_PAGE = 1000;
  for (let offset = 0; ; offset += TAILLE_PAGE) {
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, photo, photos, statut_publication")
      .not("photo", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + TAILLE_PAGE - 1);
    if (error) throw error;
    lignes.push(...data);
    if (data.length < TAILLE_PAGE) break;
  }
  return lignes;
}

async function main() {
  console.log("Listage du bucket Storage...");
  const fichiersReels = await listerDossier("");
  console.log(`  ${fichiersReels.size} fichier(s) réellement présents dans le bucket "${BUCKET}".`);

  const produits = await toutesLesLignes();
  console.log(`\n${produits.length} produits avec une photo renseignée (tous statuts).`);

  const casses = [];
  let concernes = 0;

  for (const p of produits) {
    const urlsAVerifier = [p.photo, ...(Array.isArray(p.photos) ? p.photos : [])].filter(Boolean);
    for (const url of urlsAVerifier) {
      const demandees = urlsDemandeesParLeChargeur(url);
      if (!demandees) continue; // ne correspond pas au motif -NNN.webp, pas concerné
      concernes++;
      for (const cible of demandees) {
        const chemin = cheminDepuisUrl(cible);
        if (chemin == null) continue;
        if (!fichiersReels.has(chemin)) {
          casses.push({ id: p.id, nom: p.nom, statut: p.statut_publication, source: url, cibleManquante: cible });
        }
      }
    }
  }

  console.log(`\n${concernes} URL(s) de photo correspondent au motif -NNN.webp (donc passées au recalcul de variante par le chargeur).`);
  console.log(`\n${casses.length} cas où la variante recalculée par le chargeur n'existe pas dans le bucket :`);
  for (const c of casses) {
    console.log(`  #${c.id} "${c.nom}" [${c.statut}]`);
    console.log(`      source     : ${c.source}`);
    console.log(`      manquante  : ${c.cibleManquante}`);
  }

  console.log(`\nRésumé : ${casses.length} fichier(s) manquant(s) sur ${concernes} URL(s) concernées, ${produits.length} produits scannés.`);
}

main().then(() => process.exit(0));
