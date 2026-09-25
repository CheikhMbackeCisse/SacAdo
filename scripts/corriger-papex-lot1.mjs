// Corrections ponctuelles post-import Papex (retour du fondateur, chat) :
//   1. Photo SAC-002 (trousse ovale) : photo officielle Eastpak (coloris
//      bordeaux) fournie par le fondateur, remplace l'absence de photo
//      exploitable (logo Papex sur l'unique cliché disponible). Publie le
//      produit à son prix déjà connu (4500), inchangé.
//   2. Prix : SAC-003 (ensemble Superman) 8800 -> 9500 ; SAC-065/066/102/103/104
//      (stylos Tops 505M, unité et pack de 4) achat renseigné à 80F/pièce
//      (hypothèse haute du fondateur, vente déjà correcte) ; SAC-031/034
//      (bâtons de colle Giotto) achat/vente revus à la marge plate +300F.
// Usage : node scripts/corriger-papex-lot1.mjs
import { readFileSync } from "node:fs";
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

const EASTPAK_SRC = String.raw`C:\Users\WORLD INFORMATIQUE\Downloads\tof repare papex\EK0007175V9-HERO.jpg`;
const TAILLES = [400, 800, 1200];
const QUALITE = { 400: 78, 800: 80, 1200: 82 };

async function publierPhotoSac002(vendeurId) {
  const buf = readFileSync(EASTPAK_SRC);
  const meta = await sharp(buf).metadata();
  if ((meta.width ?? 0) < 400) throw new Error(`Photo SAC-002 trop petite : ${meta.width}px`);

  const urls = {};
  for (const t of TAILLES) {
    if (t === 1200 && meta.width <= 800) continue; // même règle que optimiser_images.py
    const largeur = Math.min(t, meta.width);
    const webp = await sharp(buf)
      .resize({ width: largeur, withoutEnlargement: true })
      .webp({ quality: QUALITE[t] })
      .toBuffer();
    const chemin = `papex/SAC-002-${t}.webp`;
    const { error } = await supabase.storage
      .from("produits")
      .upload(chemin, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (error) throw new Error(`Upload SAC-002-${t}.webp échoué : ${error.message}`);
    urls[t] = supabase.storage.from("produits").getPublicUrl(chemin).data.publicUrl;
    console.log(`✓ SAC-002-${t}.webp téléversé (${largeur}px)`);
  }

  const { error } = await supabase
    .from("produits")
    .update({ photo: urls[800], photos: [urls[800]], statut_publication: "publie", motif_refus: null })
    .eq("vendeur_id", vendeurId)
    .eq("reference_fournisseur", "SAC-002");
  if (error) throw new Error(`Publication SAC-002 échouée : ${error.message}`);
  console.log("✓ SAC-002 publié avec la photo Eastpak (bordeaux), prix inchangé (4500).");
}

// { reference_fournisseur: { prix?, prix_achat? } } — seuls les champs présents sont modifiés.
const CORRECTIONS = {
  "SAC-003": { prix: 9500 },
  "SAC-065": { prix_achat: 80 },
  "SAC-102": { prix_achat: 80 },
  "SAC-103": { prix_achat: 80 },
  "SAC-104": { prix_achat: 80 },
  "SAC-066": { prix_achat: 320 }, // 4 x 80
  "SAC-031": { prix: 600, prix_achat: 300 }, // Giotto 10g : marge plate +300
  "SAC-034": { prix: 700, prix_achat: 400 }, // Giotto 20g : marge plate +300
};

async function appliquerCorrections(vendeurId) {
  for (const [ref, patch] of Object.entries(CORRECTIONS)) {
    const { data: avant } = await supabase
      .from("produits")
      .select("nom, prix, prix_achat")
      .eq("vendeur_id", vendeurId)
      .eq("reference_fournisseur", ref)
      .single();
    const { error } = await supabase
      .from("produits")
      .update(patch)
      .eq("vendeur_id", vendeurId)
      .eq("reference_fournisseur", ref);
    if (error) throw new Error(`Correction ${ref} échouée : ${error.message}`);
    console.log(
      `✓ ${ref} — ${avant.nom} : vente ${avant.prix} -> ${patch.prix ?? avant.prix}, achat ${avant.prix_achat} -> ${patch.prix_achat ?? avant.prix_achat}`,
    );
  }
}

async function main() {
  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "Papex").single();
  await publierPhotoSac002(vendeur.id);
  await appliquerCorrections(vendeur.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
