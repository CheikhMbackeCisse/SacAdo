// SacAdo — remplacement des photos par les versions haute résolution
// (TACHE_remplacement_photos.md, livraison photos_hd_nommees.zip).
//
// Contenu de l'archive : korka_diallo/ (43 photos), ndayane_sport/ (10),
// thioune_teranga/ (9, lot 2 uniquement — A01 iPad exclu, produit supprimé
// de la base, signalé plutôt que deviné). Rapprochement par nom de fichier
// sans extension :
//   - Korka Diallo : nom normalisé (accents retirés, majuscules, séparateurs
//     -> _) == nom du produit. Deux produits (#74, #79) ont deux photos
//     (suffixe _2 = photos[1]) — vérifié : ce sont les deux seuls produits
//     "livres" dont `photos` contient déjà 2 entrées.
//   - Ndayane Sport : les fichiers ne reprennent pas les noms d'origine
//     (WhatsApp Image ...), rapprochement fait par inspection visuelle des
//     10 photos contre les 10 produits #80-#89 (voir chat).
//   - Thioune Teranga lot 2 : mêmes noms que `photo:` dans LOT_2 de
//     scripts/importer-thioune-teranga.mjs (A02-A09), extension près.
//
// Ne réutilise jamais un nom de fichier de storage existant (cache CDN) :
// chaque photo est uploadée sous import-photos-hd-v2/<slug>.webp. L'ancien
// fichier est déplacé vers _corbeille/ (jamais supprimé), même convention
// que scripts/purger-brouillons-images.mjs.
//
// Vignettes 400px de l'archive : PAS utilisées. next/image (next.config.ts,
// remotePatterns Supabase + formats AVIF/WebP) sert déjà des variantes
// redimensionnées à la volée dans les grilles — stocker un second fichier
// dédié serait une infrastructure parallèle inutilisée ailleurs dans le
// projet (voir CLAUDE.md : pas d'abstraction non requise par le reste du
// code). Les 1200px seules alimentent `photo`/`photos`.
//
// Usage : node scripts/remplacer-photos-hd.mjs
import { readFileSync, readdirSync, appendFileSync, existsSync } from "node:fs";
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
const PREFIXE_NOUVEAU = "import-photos-hd-v2";
const LARGEUR_MIN_SOURCE = 400;
const RACINE = "C:/Users/WORLD INFORMATIQUE/Downloads/files12_extract/photos_hd";
const MANIFESTE = "remplacement_photos_hd.jsonl";

function urlPublique(chemin) {
  return supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
}

function cheminDepuisUrl(url) {
  const marqueur = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marqueur);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marqueur.length));
}

// Korka Diallo : mapping calculé par correspondance exacte des noms
// normalisés (voir chat), 41/41 trouvés sans ambiguïté.
const korkaMapping = JSON.parse(readFileSync("C:/Users/WORLD INFORMATIQUE/Downloads/files12_extract/korka_mapping.json", "utf8"));

const CIBLES = [];
for (const m of korkaMapping) {
  CIBLES.push({ groupe: "korka_diallo", fichier: m.fichier, id: m.id, nom: m.nom, slot: 0 });
  const fichierDouble = `${m.fichier}_2`;
  if (existsSync(path.join(RACINE, "korka_diallo", `${fichierDouble}.webp`))) {
    CIBLES.push({ groupe: "korka_diallo", fichier: fichierDouble, id: m.id, nom: m.nom, slot: 1 });
  }
}

// Ndayane Sport : rapprochement visuel confirmé (voir chat) — les noms de
// fichiers ne reprennent pas la convention d'origine (WhatsApp Image ...).
const NDAYANE = [
  { fichier: "ballon_basket", id: 81, nom: "Ballon de basket" },
  { fichier: "ballon_train", id: 82, nom: "Ballon de football waterproof" },
  { fichier: "ballon_trionda", id: 80, nom: "Ballon de football cousu main" },
  { fichier: "chasubles", id: 83, nom: "Chasubles de sport, lot de 10" },
  { fichier: "corde_a_sauter", id: 85, nom: "Corde à sauter, avec ou sans compteur" },
  { fichier: "manchons", id: 84, nom: "Manchons de maintien pour protège-tibias, la paire" },
  { fichier: "short", id: 89, nom: "Short de sport" },
  { fichier: "survetement", id: 86, nom: "Ensemble survêtement de sport, veste et pantalon" },
  { fichier: "tshirt_camo", id: 87, nom: "T-shirt de sport respirant, motif camouflage" },
  { fichier: "tshirt_uni", id: 88, nom: "T-shirt de sport respirant, uni" },
];
for (const n of NDAYANE) CIBLES.push({ groupe: "ndayane_sport", fichier: n.fichier, id: n.id, nom: n.nom, slot: 0 });

// Thioune Teranga lot 2 : mêmes noms que LOT_2 dans importer-thioune-teranga.mjs.
const THIOUNE_LOT2 = [
  { fichier: "A02_TABLETTE_ANDROID_10_POUCES_MODELE_A_CONFIRMER", nom: "Tablette Android 10 pouces (modèle à confirmer)" },
  { fichier: "A03_CLE_USB_METAL_PERSONNALISABLE", nom: "Clé USB métal personnalisable" },
  { fichier: "A04_ECOUTEURS_SANS_FIL_BLUETOOTH_K_330", nom: "Écouteurs sans fil Bluetooth K-330" },
  { fichier: "A05_ECOUTEURS_SANS_FIL_BLUETOOTH_AVEC_AFFICHEUR_DE_CHA", nom: "Écouteurs sans fil Bluetooth avec afficheur de charge" },
  { fichier: "A06_BOITIER_EXTERNE_POUR_DISQUE_DUR_2_5_POUCES_SATA_VE", nom: "Boîtier externe pour disque dur 2,5 pouces, SATA vers USB 3.0" },
  { fichier: "A07_ENSEMBLE_CLAVIER_ET_SOURIS_GAMER_RETROECLAIRES_RGB", nom: "Ensemble clavier et souris gamer rétroéclairés RGB (SOREX)" },
  { fichier: "A08_CLAVIER_RETROECLAIRE_RGB_A_PANNEAU_TRANSPARENT", nom: "Clavier rétroéclairé RGB à panneau transparent" },
  { fichier: "A09_ENSEMBLE_CLAVIER_ET_SOURIS_RETROECLAIRES_RGB_TOUCH", nom: "Ensemble clavier et souris rétroéclairés RGB, touches colorées" },
];
for (const t of THIOUNE_LOT2) CIBLES.push({ groupe: "thioune_teranga", fichier: t.fichier, id: null, nom: t.nom, slot: 0 });

// A01 (iPad) : produit supprimé de la base (décision 2026-09-15, prix non
// confirmé). Signalé, pas de correspondance devinée.
const NON_APPARIES = ["thioune_teranga/A01_IPAD_APPLE_GENERATION_A_CONFIRMER"];

function dejaFait() {
  if (!existsSync(MANIFESTE)) return new Set();
  return new Set(
    readFileSync(MANIFESTE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((o) => o.ok).map((o) => `${o.groupe}/${o.fichier}`),
  );
}

async function main() {
  console.log(`Fichiers non appariés à signaler : ${NON_APPARIES.length}`);
  for (const f of NON_APPARIES) console.log(`  - ${f} : aucun produit correspondant (voir motif dans le script)`);

  const fait = dejaFait();

  for (const cible of CIBLES) {
    if (fait.has(`${cible.groupe}/${cible.fichier}`)) continue;

    try {
      let produitId = cible.id;
      if (!produitId) {
        const { data: produit, error } = await supabase.from("produits").select("id").eq("nom", cible.nom).maybeSingle();
        if (error || !produit) throw new Error(`produit introuvable en base : ${cible.nom}`);
        produitId = produit.id;
      }

      const cheminFichier = path.join(RACINE, cible.groupe, `${cible.fichier}.webp`);
      const buf = readFileSync(cheminFichier);
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < LARGEUR_MIN_SOURCE) throw new Error(`source encore trop petite : ${meta.width}px`);

      const { data: produitActuel, error: errSelect } = await supabase.from("produits").select("id, nom, photo, photos").eq("id", produitId).single();
      if (errSelect || !produitActuel) throw new Error(`lecture produit #${produitId} échouée : ${errSelect?.message}`);

      const photosActuelles = Array.isArray(produitActuel.photos) && produitActuel.photos.length > 0 ? [...produitActuel.photos] : [produitActuel.photo].filter(Boolean);
      const ancienneUrl = photosActuelles[cible.slot];

      const nouveauChemin = `${PREFIXE_NOUVEAU}/${cible.fichier}.webp`;
      const { error: errUpload } = await supabase.storage.from(BUCKET).upload(nouveauChemin, buf, { contentType: "image/webp", upsert: false });
      if (errUpload) throw new Error(`upload échoué : ${errUpload.message}`);
      const nouvelleUrl = urlPublique(nouveauChemin);

      photosActuelles[cible.slot] = nouvelleUrl;
      const nouveauPhotoPrincipal = cible.slot === 0 ? nouvelleUrl : produitActuel.photo;

      const { error: errUpdate } = await supabase.from("produits").update({ photo: nouveauPhotoPrincipal, photos: photosActuelles }).eq("id", produitId);
      if (errUpdate) throw new Error(`mise à jour échouée : ${errUpdate.message}`);

      if (ancienneUrl) {
        const ancienChemin = cheminDepuisUrl(ancienneUrl);
        if (ancienChemin && !ancienChemin.startsWith(`${CORBEILLE}/`)) {
          const { error: errMove } = await supabase.storage.from(BUCKET).move(ancienChemin, `${CORBEILLE}/${ancienChemin}`);
          if (errMove) console.log(`  (avertissement) déplacement vers corbeille échoué pour ${ancienChemin} : ${errMove.message}`);
        }
      }

      appendFileSync(MANIFESTE, JSON.stringify({ ok: true, groupe: cible.groupe, fichier: cible.fichier, produitId, slot: cible.slot, largeur: meta.width, ancienneUrl, nouvelleUrl }) + "\n");
      console.log(`✓ ${cible.groupe}/${cible.fichier} -> #${produitId} (${cible.nom}), slot ${cible.slot}, ${meta.width}px`);
    } catch (err) {
      appendFileSync(MANIFESTE, JSON.stringify({ ok: false, groupe: cible.groupe, fichier: cible.fichier, nom: cible.nom, erreur: String(err.message ?? err) }) + "\n");
      console.log(`ÉCHEC ${cible.groupe}/${cible.fichier} : ${err.message ?? err}`);
    }
  }

  console.log(`\nTerminé. ${CIBLES.length} cibles traitées (voir ${MANIFESTE} pour le détail).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
