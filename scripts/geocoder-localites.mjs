// PROMPT_ADMIN_COMPTA_LOCALITES.md — Lot 2, étape 2 : géocodage de toutes les
// localités existantes à partir de leur nom + "Dakar, Sénégal" (OpenStreetMap
// Nominatim, 1 req/s, cache local). Rapport : trouvées / introuvables /
// douteuses (trop loin du centre du groupe).
//
// Seules les localités "trouvées" (ni introuvables ni douteuses) sont
// écrites en base automatiquement. Les douteuses et introuvables restent
// sans coordonnées : elles apparaissent en rouge dans la page admin
// « Localités sur la carte » (§3), où l'admin les place à la main — plus
// sûr qu'écrire une coordonnée probablement fausse.
//
// Usage :
//   node scripts/geocoder-localites.mjs --dry-run   (rapport seul, lecture)
//   node scripts/geocoder-localites.mjs             (géocode + écrit les "trouvées")
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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

const DRY_RUN = process.argv.includes("--dry-run");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "SacAdo/1.0 (+https://sacado.sn; fournitures scolaires Senegal)";
const CACHE_PATH = "scripts/.cache-geocodage-localites.json";
// Toutes les localités du système de groupes sont actuellement en région de
// Dakar (migration 0034). On ne tente qu'un seul suffixe : essayer plusieurs
// régions et choisir "le premier vrai lieu trouvé, même loin" s'est avéré
// dangereux (un résultat Nominatim en class=place à Saint-Louis l'emportait
// sur un POI correct à Dakar pour "Khar Yallah").
const SUFFIXE = "Dakar, Sénégal";
// jsonv2 nomme ce champ "category" (pas "class", qui n'existe que dans le
// format v1 de Nominatim). "place"/"boundary" = vrai lieu géographique,
// préféré à un commerce/équipement homonyme (ex: "Diass couture" à Dakar
// plutôt que la commune de Diass, qui n'est elle-même PAS dans la région de
// Dakar — un autre bon exemple de pourquoi un seul suffixe + report manuel
// est plus sûr qu'une cascade de suffixes).
const CATEGORIES_LIEU = new Set(["place", "boundary"]);
// Au-delà de cette distance du barycentre des localités déjà acceptées du
// même groupe, le résultat est marqué "douteux" et laissé sans coordonnées
// (pas écrit) plutôt qu'accepté silencieusement.
const SEUIL_DOUTEUX_KM = 20;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chargerCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function sauvegarderCache(cache) {
  mkdirSync("scripts", { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function geocoder(nom, cache) {
  const q = `${nom}, ${SUFFIXE}`;
  if (cache[q] !== undefined) return cache[q] ? { ...cache[q], requete: q } : null;

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "3");
  url.searchParams.set("countrycodes", "sn");
  url.searchParams.set("accept-language", "fr");

  let resultat = null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const candidat = (data ?? []).find((d) => CATEGORIES_LIEU.has(d.category)) ?? (data ?? [])[0];
      if (candidat?.lat && candidat?.lon) {
        resultat = { lat: Number(candidat.lat), lng: Number(candidat.lon), display_name: candidat.display_name };
      }
    }
  } catch (e) {
    console.error(`  Erreur Nominatim pour "${q}":`, e.message);
  }

  cache[q] = resultat;
  sauvegarderCache(cache);
  await sleep(1100); // 1 req/s max, marge de sécurité

  return resultat ? { ...resultat, requete: q } : null;
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  console.log(`=== Géocodage des localités (${DRY_RUN ? "DRY-RUN, lecture seule" : "ÉCRITURE"}) ===\n`);

  const { data: localites, error } = await supabase
    .from("localites")
    .select("id, nom, groupe_id, lat, lng")
    .order("groupe_id")
    .order("nom");
  if (error) {
    console.error("Erreur lecture localites:", error.message);
    process.exit(1);
  }

  const cache = chargerCache();
  const trouvees = [];
  const introuvables = [];
  const douteuses = [];
  // Centre de référence par groupe, construit au fur et à mesure (barycentre
  // des localités déjà acceptées du même groupe).
  const centreParGroupe = new Map();

  for (const loc of localites) {
    process.stdout.write(`Géocodage "${loc.nom}"... `);
    const res = await geocoder(loc.nom, cache);
    if (!res) {
      console.log("INTROUVABLE");
      introuvables.push(loc);
      continue;
    }

    const centre = centreParGroupe.get(loc.groupe_id);
    const dist = centre ? distanceKm(centre.lat, centre.lng, res.lat, res.lng) : 0;
    const estDouteux = centre != null && dist > SEUIL_DOUTEUX_KM;

    console.log(
      `${res.lat.toFixed(5)}, ${res.lng.toFixed(5)}${estDouteux ? `  ⚠ ${dist.toFixed(0)} km du groupe — ${res.display_name}` : ""}`,
    );

    if (estDouteux) {
      douteuses.push({ ...loc, lat: res.lat, lng: res.lng, distanceKm: dist, display_name: res.display_name });
    } else {
      trouvees.push({ ...loc, lat: res.lat, lng: res.lng, display_name: res.display_name });
      // Met à jour le barycentre du groupe avec ce point accepté.
      const n = (centre?.n ?? 0) + 1;
      centreParGroupe.set(loc.groupe_id, {
        lat: ((centre?.lat ?? 0) * (n - 1) + res.lat) / n,
        lng: ((centre?.lng ?? 0) * (n - 1) + res.lng) / n,
        n,
      });
    }
  }

  console.log("\n=== RAPPORT ===");
  console.log(`Trouvées (écrites automatiquement) : ${trouvees.length}/${localites.length}`);
  console.log(`Introuvables (laissées sans coordonnées, à placer à la main) : ${introuvables.length}`);
  introuvables.forEach((l) => console.log(`  - #${l.id} "${l.nom}" (groupe ${l.groupe_id})`));
  console.log(
    `Douteuses — >${SEUIL_DOUTEUX_KM} km du reste de leur groupe (laissées sans coordonnées, à vérifier et placer à la main) : ${douteuses.length}`,
  );
  douteuses.forEach((l) =>
    console.log(`  - #${l.id} "${l.nom}" -> ${l.distanceKm.toFixed(0)} km — ${l.display_name}`),
  );

  if (DRY_RUN) {
    console.log("\nDRY-RUN : rien écrit en base. Relancer sans --dry-run pour appliquer.");
    return;
  }

  console.log(`\nÉcriture en base de ${trouvees.length} localité(s) "trouvée(s)" (douteuses/introuvables exclues)...`);
  for (const l of trouvees) {
    const { error: errUpdate } = await supabase
      .from("localites")
      .update({ lat: l.lat, lng: l.lng })
      .eq("id", l.id);
    if (errUpdate) console.error(`  Erreur écriture #${l.id} "${l.nom}":`, errUpdate.message);
  }
  console.log(`${trouvees.length} localité(s) mise(s) à jour.`);
}

main();
