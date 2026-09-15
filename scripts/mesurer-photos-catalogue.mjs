// SacAdo — diagnostic (TACHE_photos_et_accueil.md, chantier A.4) : mesure la
// largeur réelle de chaque photo référencée par `produits` (colonnes `photo`
// + `photos[]`) et liste celles sous 400 px. Lecture seule (aucune écriture
// en base, aucun upload). Sert à chiffrer l'ampleur du problème avant
// réparation (scripts/reparer-photos-*.mjs) et à vérifier après coup.
//
// Usage : node scripts/mesurer-photos-catalogue.mjs
// Sortie : rapport_photos_sous_400px.jsonl (une ligne par produit concerné),
// + résumé console par vendeur. Reprise : seules les URL déjà mesurées AVEC
// SUCCÈS dans cache_dimensions_photos.jsonl sont sautées lors d'un second
// passage — les échecs (429, etc.) sont retentés.
import { readFileSync, appendFileSync, existsSync, unlinkSync } from "node:fs";
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

const SEUIL = 400;
const CACHE = "cache_dimensions_photos.jsonl";
const RAPPORT = "rapport_photos_sous_400px.jsonl";
const CONCURRENCE = 6;
const TENTATIVES = 4;

function chargerCache() {
  if (!existsSync(CACHE)) return new Map();
  const lignes = readFileSync(CACHE, "utf8").split("\n").filter(Boolean);
  const cache = new Map();
  for (const l of lignes) {
    const o = JSON.parse(l);
    // Ne compte comme "fait" que les mesures réussies : un échec (429,
    // timeout...) doit être retenté au passage suivant, pas traité comme
    // définitif.
    if (o.largeur !== null) cache.set(o.url, o.largeur);
  }
  return cache;
}

async function mesurerDistant(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  return meta.width ?? null;
}

// Quelques produits de démo pointent vers /images/... (fichiers du dépôt,
// public/images/) plutôt qu'une URL Supabase Storage — pas une requête
// réseau, une lecture disque directe.
async function mesurerLocal(urlRelative) {
  const buf = readFileSync(path.join("public", urlRelative));
  const meta = await sharp(buf).metadata();
  return meta.width ?? null;
}

async function mesurerAvecReprise(url) {
  const local = url.startsWith("/");
  for (let tentative = 1; tentative <= TENTATIVES; tentative++) {
    try {
      return local ? await mesurerLocal(url) : await mesurerDistant(url);
    } catch (err) {
      if (tentative === TENTATIVES) throw err;
      // Backoff plus long que d'habitude : les 429 observés viennent du
      // rate-limit du bucket Supabase Storage sous forte concurrence.
      await new Promise((r) => setTimeout(r, 800 * tentative));
    }
  }
}

async function chargerTousLesProduits() {
  // PostgREST plafonne à 1000 lignes par défaut : sans pagination explicite,
  // tout produit avec un id au-delà de la 1000e ligne (triée par id) est
  // silencieusement absent du résultat, sans erreur.
  const TAILLE_PAGE = 1000;
  const produits = [];
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, photo, photos, statut_publication, vendeur_id, vendeurs(nom_boutique)")
      .order("id")
      .range(debut, debut + TAILLE_PAGE - 1);
    if (error) throw new Error(`Lecture produits échouée : ${error.message}`);
    produits.push(...data);
    if (data.length < TAILLE_PAGE) break;
  }
  return produits;
}

async function main() {
  const produits = await chargerTousLesProduits();

  const cache = chargerCache();
  const urls = new Set();
  for (const p of produits) {
    if (p.photo) urls.add(p.photo);
    if (Array.isArray(p.photos)) for (const u of p.photos) if (u) urls.add(u);
  }
  const aMesurer = [...urls].filter((u) => !cache.has(u));
  console.log(`${urls.size} URL distinctes, ${cache.size} déjà en cache (succès), ${aMesurer.length} à mesurer.`);

  let curseur = 0;
  let ok = 0;
  let echecs = 0;
  async function travailleur() {
    while (curseur < aMesurer.length) {
      const url = aMesurer[curseur++];
      try {
        const largeur = await mesurerAvecReprise(url);
        cache.set(url, largeur);
        appendFileSync(CACHE, JSON.stringify({ url, largeur }) + "\n");
        ok++;
      } catch (err) {
        appendFileSync(CACHE, JSON.stringify({ url, largeur: null, erreur: String(err.message ?? err) }) + "\n");
        echecs++;
        console.log(`  ÉCHEC ${url} : ${err.message ?? err}`);
      }
      if ((ok + echecs) % 200 === 0) console.log(`  ${ok + echecs}/${aMesurer.length} (${ok} ok, ${echecs} échecs)`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCE }, travailleur));
  console.log(`Mesure terminée : ${ok} ok, ${echecs} échecs définitifs (relancer le script pour retenter).`);

  // Rapport par produit (régénéré à chaque passage, le cache lui persiste).
  if (existsSync(RAPPORT)) unlinkSync(RAPPORT);
  const parVendeur = new Map();
  let total = 0;
  for (const p of produits) {
    const toutesUrls = [p.photo, ...(Array.isArray(p.photos) ? p.photos : [])].filter(Boolean);
    const petites = toutesUrls
      .map((u) => ({ url: u, largeur: cache.get(u) ?? null }))
      .filter((x) => x.largeur !== null && x.largeur < SEUIL);
    if (petites.length === 0) continue;
    total++;
    const vendeur = p.vendeurs?.nom_boutique ?? "(sans vendeur)";
    parVendeur.set(vendeur, (parVendeur.get(vendeur) ?? 0) + 1);
    appendFileSync(
      RAPPORT,
      JSON.stringify({
        id: p.id,
        nom: p.nom,
        vendeur,
        statut_publication: p.statut_publication,
        photos_sous_400px: petites,
      }) + "\n",
    );
  }

  console.log(`\n${total} produits avec au moins une photo < ${SEUIL}px. Détail : ${RAPPORT}`);
  console.log("Par vendeur :");
  for (const [vendeur, n] of [...parVendeur.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${vendeur} : ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
