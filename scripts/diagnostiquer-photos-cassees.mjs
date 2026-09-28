// Diagnostic (lecture seule) : quels produits publiés référencent une photo
// dont le FICHIER n'existe plus dans le bucket Storage "produits" ? C'est ce
// qui fait apparaître des cartes "sans photo" (icône grise) dans "À
// découvrir", même si `accueil_classement` filtre déjà `photo is not null`
// — le champ n'est pas null, mais le fichier a disparu.
//
// Approche par listing Storage (API authentifiée, pas de requête HTTP par
// produit) plutôt que par vérification HTTP individuelle : un premier essai
// en HTTP a produit ~20% de faux positifs sous charge (l'hébergeur d'images
// renvoie des erreurs de charge, pas de vraies absences — vérifié au curl
// individuel), et une version prudente (faible concurrence, 3 tentatives)
// est fiable mais prend un quart d'heure pour ~1700 produits. Lister une
// fois le contenu réel de chaque dossier du bucket est immédiat et exact.
//
// Usage : node scripts/diagnostiquer-photos-cassees.mjs
import { existsSync, readFileSync } from "node:fs";
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

async function toutesLesLignes() {
  const lignes = [];
  const TAILLE_PAGE = 1000;
  for (let offset = 0; ; offset += TAILLE_PAGE) {
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, photo, photos")
      .eq("statut_publication", "publie")
      .not("photo", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + TAILLE_PAGE - 1);
    if (error) throw error;
    lignes.push(...data);
    if (data.length < TAILLE_PAGE) break;
  }
  return lignes;
}

// Liste récursive d'un dossier du bucket (l'API ne liste qu'un niveau à la fois).
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
      // Un dossier n'a pas de `id` (metadata) dans l'API Storage.
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

function cheminDepuisUrl(url) {
  if (!url.startsWith(PREFIXE_URL)) return null;
  return decodeURIComponent(url.slice(PREFIXE_URL.length));
}

async function main() {
  console.log("Listage du bucket Storage...");
  const fichiersReels = await listerDossier("");
  console.log(`  ${fichiersReels.size} fichier(s) réellement présents dans le bucket "${BUCKET}".`);

  const produits = await toutesLesLignes();
  console.log(`\n${produits.length} produits publiés avec une photo renseignée.`);

  const casses = [];
  const horsBucket = [];
  for (const p of produits) {
    if (p.photo.startsWith("/")) {
      if (!existsSync(`public${p.photo}`)) casses.push(p);
      continue;
    }
    const chemin = cheminDepuisUrl(p.photo);
    if (chemin == null) {
      horsBucket.push(p);
      continue;
    }
    if (!fichiersReels.has(chemin)) casses.push(p);
  }

  console.log(`\n${horsBucket.length} produit(s) avec une photo hébergée ailleurs (pas ce bucket, ignorés) :`);
  for (const p of horsBucket.slice(0, 5)) console.log(`  #${p.id} -> ${p.photo}`);
  if (horsBucket.length > 5) console.log(`  ... et ${horsBucket.length - 5} de plus.`);

  console.log(`\n${casses.length} produit(s) avec une photo principale dont le fichier n'existe plus :`);
  for (const p of casses) console.log(`  #${p.id} "${p.nom}" -> ${p.photo}`);

  console.log(`\nRésumé : ${casses.length} / ${produits.length} cassées.`);
}

main().then(() => process.exit(0));
