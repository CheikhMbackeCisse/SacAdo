// Génère les icônes de l'app admin à partir du logo fourni (sac à dos bleu
// SacAdo sur fond blanc, public/images/logo-admin.jpg). Lancer :
//   node scripts/generer-icones-admin.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SOURCE = "public/images/logo-admin.jpg";
const DEST = "public/icons";
const FOND = "#FEFDFF";

await mkdir(DEST, { recursive: true });

// Icônes "any" : le logo tel quel, redimensionné.
for (const { nom, taille } of [
  { nom: "admin-192.png", taille: 192 },
  { nom: "admin-512.png", taille: 512 },
]) {
  await sharp(SOURCE).resize(taille, taille).png().toFile(`${DEST}/${nom}`);
  console.log("écrit", `${DEST}/${nom}`);
}

// Maskable : logo réduit à 80 % au centre d'un canevas carré, pour rester
// dans la zone sûre quand Android applique son propre masque (cercle, etc.).
const tailleMaskable = 512;
const logoReduit = await sharp(SOURCE)
  .resize(Math.round(tailleMaskable * 0.8), Math.round(tailleMaskable * 0.8))
  .toBuffer();

await sharp({
  create: {
    width: tailleMaskable,
    height: tailleMaskable,
    channels: 3,
    background: FOND,
  },
})
  .composite([{ input: logoReduit, gravity: "center" }])
  .png()
  .toFile(`${DEST}/admin-maskable-512.png`);
console.log("écrit", `${DEST}/admin-maskable-512.png`);
