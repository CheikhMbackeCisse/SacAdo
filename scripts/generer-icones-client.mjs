// Génère les icônes PWA de l'app CLIENT à partir de public/images/logo.jpg
// (cartable bleu SacAdo sur fond blanc). Lancer après avoir remplacé logo.jpg :
//   node scripts/generer-icones-client.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/images/logo.jpg";
const DEST = "public/icons";
const BLANC = "#ffffff";

await mkdir(DEST, { recursive: true });

// « any » : le logo tel quel, calé sur un carré blanc.
for (const taille of [192, 512]) {
  await sharp(SRC)
    .resize(taille, taille, { fit: "contain", background: BLANC })
    .flatten({ background: BLANC })
    .png()
    .toFile(`${DEST}/client-${taille}.png`);
  console.log("écrit", `${DEST}/client-${taille}.png`);
}

// « maskable » : le cartable reste dans la zone sûre (~80 %), Android rogne les
// bords. On réduit le logo puis on complète en blanc jusqu'à 512.
const interne = Math.round(512 * 0.78);
const marge = Math.round((512 - interne) / 2);
await sharp(SRC)
  .resize(interne, interne, { fit: "contain", background: BLANC })
  .flatten({ background: BLANC })
  .extend({ top: marge, bottom: marge, left: marge, right: marge, background: BLANC })
  .png()
  .toFile(`${DEST}/client-maskable-512.png`);
console.log("écrit", `${DEST}/client-maskable-512.png`);
