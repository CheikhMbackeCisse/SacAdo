// Copie le worker MapLibre (+ son module partagé) dans public/ pour contourner
// un bug Turbopack : Turbopack n'émet pas le sibling maplibre-gl-shared.mjs à
// côté du worker hashé, donc le worker plante à son premier import et aucune
// tuile ne se charge. On sert donc les deux fichiers en statique et on appelle
// maplibregl.setWorkerUrl() vers cette copie.
// Lancé automatiquement avant `dev` et `build` (voir package.json).

import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const distDir = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const cible = join(process.cwd(), "public", "vendor", "maplibre");

const fichiers = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(cible, { recursive: true });
for (const f of fichiers) {
  await copyFile(join(distDir, f), join(cible, f));
}
console.log(`[maplibre] worker copié dans public/vendor/maplibre/ (${fichiers.join(", ")})`);
