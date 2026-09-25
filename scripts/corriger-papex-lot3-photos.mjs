// Lot 3 de corrections photos Papex (retour du fondateur, chat) :
//   - SAC-113 (intercalaires) : la photo de lot 2 montrait encore un jeu de
//     12 positions alors que le produit est un jeu de 6. Le fondateur a
//     fourni la bonne photo (boîte Exacompta marquée "6").
//   - SAC-115 (souris, variante blanche) : photo de remplacement fournie
//     directement par le fondateur pour le boîtier blanc (même produit que
//     le lot 2, fichier source différent).
//   - Parapheurs (SAC-050/114) : abandonné sur demande du fondateur, aucune
//     des 4 photos candidates ne correspondait avec certitude. Pas d'action.
// Usage : node scripts/corriger-papex-lot3-photos.mjs
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

const TAILLES = [400, 800, 1200];
const QUALITE = { 400: 78, 800: 80, 1200: 82 };

async function televerserVariantes(cheminLocal, idBase) {
  if (!existsSync(cheminLocal)) throw new Error(`Fichier introuvable : ${cheminLocal}`);
  const buf = readFileSync(cheminLocal);
  const meta = await sharp(buf).metadata();
  if ((meta.width ?? 0) < 400) throw new Error(`${cheminLocal} trop petit : ${meta.width}px (minimum 400px)`);

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

  // SAC-113 : nouvelle photo -v3 (la -v2 du lot précédent montrait 12 positions).
  const url113 = await televerserVariantes(
    String.raw`C:\Users\WORLD INFORMATIQUE\Downloads\1406E_1_39.jpg`,
    "SAC-113-v3",
  );
  await supabase
    .from("produits")
    .update({ photo: url113, photos: [url113] })
    .eq("vendeur_id", vendeur.id)
    .eq("reference_fournisseur", "SAC-113");
  console.log("✓ SAC-113 : photo 6 positions appliquée.");

  // SAC-115 : remplace la principale (blanche) par le fichier fourni directement.
  const url115 = await televerserVariantes(
    String.raw`C:\Users\WORLD INFORMATIQUE\Downloads\3395-raton-tnb-mwrubby1-inalambrico-1600-dpi-ambidextro-clic-silencioso-plata-blanco-cd30e899-44ce-4822-b720-37e3b4e6e616.webp`,
    "SAC-115-v3",
  );
  const { data: sac115 } = await supabase
    .from("produits")
    .select("photos")
    .eq("vendeur_id", vendeur.id)
    .eq("reference_fournisseur", "SAC-115")
    .single();
  const nouvellesPhotos = [url115, ...sac115.photos.slice(1)]; // garde les 2 secondaires déjà en place
  await supabase
    .from("produits")
    .update({ photo: url115, photos: nouvellesPhotos })
    .eq("vendeur_id", vendeur.id)
    .eq("reference_fournisseur", "SAC-115");
  console.log("✓ SAC-115 : photo principale (blanche) mise à jour.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
