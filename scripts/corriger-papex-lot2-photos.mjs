// Remplacement de photos Papex (retour du fondateur, dossier "tof repare papex") :
// photos officielles/propres identifiées visuellement pour chaque produit,
// à la place des photos Papex d'origine (logo, qualité, ou générique).
// Convention -v2 (jamais d'écrasement d'un fichier existant, cache long).
// Usage : node scripts/corriger-papex-lot2-photos.mjs
import { readFileSync, existsSync } from "node:fs";
import sharp from "sharp";
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

const DIR = String.raw`C:\Users\WORLD INFORMATIQUE\Downloads\tof repare papex`;
const TAILLES = [400, 800, 1200];
const QUALITE = { 400: 78, 800: 80, 1200: 82 };

// { reference_fournisseur: [{ fichier, role: 'principale'|'secondaire' }] }
// Identification visuelle faite manuellement (voir chat) : chaque fichier a
// été ouvert et comparé à la désignation du produit avant d'être retenu.
const REMPLACEMENTS = {
  "SAC-001": [{ fichier: "cahiers_dessin_sans_papex_fond_ameliore.png" }], // Cahier de dessin L'écolier 32p
  "SAC-003": [{ fichier: "superman_stationery_high_quality_local.png" }], // Ensemble Superman
  "SAC-004": [{ fichier: "papex_removed_beautiful_background.png" }], // Cahier L'écolier 48p
  "SAC-005": [{ fichier: "nouvelle_image_sans_papex_fond_ameliore.png" }], // Cahier L'écolier 192p
  "SAC-022": [{ fichier: "LD0006141349.jpg" }], // Calculatrice Casio fx-92 Collège
  "SAC-032": [{ fichier: "AP_L053_Ramette_papier_A4_80gr_Rose_Fluo_CLAIREFONTAINE__091.jpg" }], // Ramette rose fluo
  "SAC-058": [{ fichier: "papier-dimpression-ez-paper.webp" }], // Ramette EZ Paper
  "SAC-065": [{ fichier: "61OrrdchKoL._AC_UF894,1000_QL80_.jpg" }], // Stylo Tops 505M bleu
  "SAC-066": [{ fichier: "265900.jpg" }], // Pack de 4 stylos Tops 505M
  "SAC-102": [{ fichier: "stylo-schneider-2.jpg" }], // Stylo Tops 505M noir
  "SAC-103": [{ fichier: "P_79151302_1.webp" }], // Stylo Tops 505M rouge
  "SAC-104": [{ fichier: "original.jpg" }], // Stylo Tops 505M vert
  "SAC-112": [{ fichier: "optimized_69d91eef7cc7b_2026-04-10_16-01-51.webp" }], // Le Robert dictionnaire
  "SAC-115": [
    { fichier: "6718-raton-tnb-mwrubby1-inalambrico-1600-dpi-ambidextro-clic-silencioso-plata-blanco-24cdcb67-9ceb-40e1-9ef6-fe770f7267c7.webp" }, // blanche (principale)
    { fichier: "pontikiasyrmatot-nbmwrubby61600dpired-silver.jpg" }, // rouge (secondaire 1)
    { fichier: "Souris-sans-fil-T-nB-Rubby-Noir-et-argent.jpg" }, // noire (secondaire 2)
  ],
};

async function televerserVariantes(fichierLocal, idBase) {
  const chemin = `${DIR}\\${fichierLocal}`;
  if (!existsSync(chemin)) throw new Error(`Fichier introuvable : ${fichierLocal}`);
  const buf = readFileSync(chemin);
  const meta = await sharp(buf).metadata();
  if ((meta.width ?? 0) < 400) throw new Error(`${fichierLocal} trop petit : ${meta.width}px (minimum 400px)`);

  const urls = {};
  for (const t of TAILLES) {
    if (t === 1200 && meta.width <= 800) continue;
    const largeur = Math.min(t, meta.width);
    const webp = await sharp(buf)
      .resize({ width: largeur, withoutEnlargement: true })
      .webp({ quality: QUALITE[t] })
      .toBuffer();
    const cheminStorage = `papex/${idBase}-${t}.webp`;
    const { error } = await supabase.storage
      .from("produits")
      .upload(cheminStorage, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (error) throw new Error(`Upload ${cheminStorage} échoué : ${error.message}`);
    urls[t] = supabase.storage.from("produits").getPublicUrl(cheminStorage).data.publicUrl;
  }
  return urls[800];
}

async function main() {
  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "Papex").single();

  for (const [ref, images] of Object.entries(REMPLACEMENTS)) {
    const photos = [];
    for (const [index, img] of images.entries()) {
      // -v2 (+ index pour les secondaires) : jamais le même nom qu'une photo
      // déjà servie/cache navigateur, convention posée par le prompt "images
      // sans Vercel".
      const idBase = index === 0 ? `${ref}-v2` : `${ref}-${index + 1}-v2`;
      const url800 = await televerserVariantes(img.fichier, idBase);
      photos.push(url800);
      console.log(`✓ ${ref} (${index === 0 ? "principale" : `secondaire ${index}`}) <- ${img.fichier}`);
    }
    const { error } = await supabase
      .from("produits")
      .update({ photo: photos[0], photos })
      .eq("vendeur_id", vendeur.id)
      .eq("reference_fournisseur", ref);
    if (error) throw new Error(`Mise à jour ${ref} échouée : ${error.message}`);
  }

  console.log(`\n${Object.keys(REMPLACEMENTS).length} produits mis à jour avec de nouvelles photos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
