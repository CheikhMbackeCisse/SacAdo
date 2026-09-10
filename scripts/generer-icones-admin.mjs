// Génère les icônes de l'app admin (PWA même domaine, TACHE_admin_pwa_meme_domaine.md §2).
// Volontairement TRÈS différentes de l'icône client (cartable bleu sur blanc) :
// fond sombre #031726 + glyphe tableau de bord blanc. Lancer :
//   node scripts/generer-icones-admin.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const FOND = "#031726";
const ACCENT = "#0B3D91";
const DEST = "public/icons";

// Glyphe « tableau de bord » (4 tuiles), tracé blanc sur viewBox 24x24.
function svg(taille, ratioGlyphe, pleinBord = false) {
  const g = Math.round(taille * ratioGlyphe);
  const decalage = Math.round((taille - g) / 2);
  // Maskable : fond carré plein bord (Android applique son propre masque).
  const rayon = pleinBord ? 0 : Math.round(taille * 0.22);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" rx="${rayon}" fill="${FOND}"/>
  <rect x="${Math.round(taille / 2 - g * 0.42)}" y="${taille - decalage - Math.round(taille * 0.06)}" width="${Math.round(g * 0.84)}" height="${Math.round(taille * 0.045)}" rx="${Math.round(taille * 0.022)}" fill="${ACCENT}"/>
  <g transform="translate(${decalage} ${decalage}) scale(${g / 24})" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="8" height="10" rx="1.5"/>
    <rect x="15" y="3" width="6" height="6" rx="1.5"/>
    <rect x="15" y="13" width="6" height="8" rx="1.5"/>
    <rect x="3" y="17" width="8" height="4" rx="1.5"/>
  </g>
</svg>`);
}

await mkdir(DEST, { recursive: true });

const cibles = [
  { nom: "admin-192.png", taille: 192, ratio: 0.62, pleinBord: false },
  { nom: "admin-512.png", taille: 512, ratio: 0.62, pleinBord: false },
  // Maskable : glyphe dans la zone sûre (~50 %), fond plein bord.
  { nom: "admin-maskable-512.png", taille: 512, ratio: 0.5, pleinBord: true },
];

for (const { nom, taille, ratio, pleinBord } of cibles) {
  await sharp(svg(taille, ratio, pleinBord)).png().toFile(`${DEST}/${nom}`);
  console.log("écrit", `${DEST}/${nom}`);
}
