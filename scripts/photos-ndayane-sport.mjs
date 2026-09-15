// SacAdo — upload ponctuel des photos Ndayane Sport (dossier fourni par le
// fondateur le 2026-09-14) + publication des produits correspondants.
// Usage : node scripts/photos-ndayane-sport.mjs
// Prérequis : lit .env.local (comme les autres scripts d'import).
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

const DOSSIER = "C:/Users/WORLD INFORMATIQUE/Downloads/ndayane sport produit";
const EXTRAIT = path.join(DOSSIER, "extracted");

const LARGEUR_MAX = 1600;
const QUALITE_WEBP = 82;

async function uploaderPhoto(cheminAbsolu) {
  const buf = await readFile(cheminAbsolu);
  const webp = await sharp(buf)
    .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer();
  const chemin = `import-ndayane-photos/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${cheminAbsolu}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

// id produit -> fichiers locaux (ordre = ordre d'affichage, le premier devient `photo`)
const PLAN = {
  81: [path.join(DOSSIER, "WhatsApp Image 2026-09-11 at 9.40.09 AM.jpeg")],
  82: [path.join(DOSSIER, "WhatsApp Image 2026-09-07 at 10.07.39 AM.jpeg")],
  83: [
    "WhatsApp Image 2026-09-07 at 10.03.09 AM.jpeg",
    "WhatsApp Image 2026-09-07 at 10.03.10 AM.jpeg",
    "WhatsApp Image 2026-09-07 at 10.03.10 AM (1).jpeg",
  ].map((f) => path.join(EXTRAIT, f)),
  84: [
    "WhatsApp Image 2026-09-11 at 9.38.10 AM.jpeg",
    "WhatsApp Image 2026-09-11 at 9.38.10 AM (1).jpeg",
    "WhatsApp Image 2026-09-11 at 9.38.10 AM (2).jpeg",
    "WhatsApp Image 2026-09-11 at 9.38.11 AM.jpeg",
  ].map((f) => path.join(EXTRAIT, f)),
  85: [
    "WhatsApp Image 2026-09-11 at 9.37.36 AM.jpeg",
    "WhatsApp Image 2026-09-11 at 9.37.36 AM (1).jpeg",
  ].map((f) => path.join(EXTRAIT, f)),
  86: [
    "WhatsApp Image 2026-09-11 at 9.31.33 AM.jpeg",
    "WhatsApp Image 2026-09-11 at 9.31.33 AM (1).jpeg",
    "WhatsApp Image 2026-09-11 at 9.31.34 AM.jpeg",
    "WhatsApp Image 2026-09-11 at 9.31.34 AM (1).jpeg",
  ].map((f) => path.join(EXTRAIT, f)),
  // 87 (motif camouflage) : pas de vraie photo camouflage fournie — photo
  // temporaire (le premier t-shirt uni), décision du fondateur 2026-09-14, à
  // remplacer dès qu'une vraie photo camouflage arrive.
  87: [path.join(EXTRAIT, "WhatsApp Image 2026-09-11 at 9.33.23 AM.jpeg")],
  88: [
    "WhatsApp Image 2026-09-11 at 9.33.23 AM.jpeg",
    "WhatsApp Image 2026-09-11 at 9.33.23 AM (1).jpeg",
    "WhatsApp Image 2026-09-11 at 9.33.39 AM.jpeg",
  ].map((f) => path.join(EXTRAIT, f)),
  89: [
    "WhatsApp Image 2026-09-07 at 10.16.32 AM.jpeg",
    "WhatsApp Image 2026-09-07 at 10.16.32 AM (1).jpeg",
    "WhatsApp Image 2026-09-07 at 10.16.32 AM (2).jpeg",
  ].map((f) => path.join(EXTRAIT, f)),
};

async function main() {
  // Cache : un même fichier local peut servir à deux produits (photo
  // temporaire du #87), on ne l'upload qu'une fois.
  const urlParFichier = new Map();

  for (const [id, fichiers] of Object.entries(PLAN)) {
    const urls = [];
    for (const fichier of fichiers) {
      if (!urlParFichier.has(fichier)) {
        const url = await uploaderPhoto(fichier);
        urlParFichier.set(fichier, url);
        console.log(`  uploadé : ${path.basename(fichier)}`);
      }
      urls.push(urlParFichier.get(fichier));
    }

    const { error } = await supabase
      .from("produits")
      .update({
        photo: urls[0],
        photos: urls,
        statut: "dispo",
        statut_publication: "publie",
      })
      .eq("id", Number(id));

    if (error) throw new Error(`Mise à jour échouée (produit ${id}) : ${error.message}`);
    console.log(`✓ produit #${id} : ${urls.length} photo(s), publié`);
  }

  console.log("Terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
