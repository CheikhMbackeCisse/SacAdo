// SacAdo — réparation (TACHE_photos_et_accueil.md, chantier A.3/A.4) : 26 des
// 34 produits Thioune Teranga "lot 1" (scripts/importer-thioune-teranga.mjs)
// utilisaient la vignette 78×78 px de la négociation comme photo catalogue.
// Pour ces 26 refs, donnees_thioune.py (relevé initial du site fournisseur)
// conserve le nom du fichier photo réel sur thiouneteranga.com — on le
// retélécharge en pleine résolution ici.
//
// Les 8 refs restantes (69, 71-77, accessoires) n'ont pas de source connue
// (bug de pagination du site au moment du relevé, cf. donnees_thioune.py) :
// hors périmètre de ce script, restent masquées (scripts/depublier-thioune-lot1.mjs
// les a déjà dépubliées) en attendant de vraies photos du fournisseur.
//
// Usage : node scripts/reparer-photos-thioune-lot1.mjs
// Republie automatiquement (statut_publication = 'publie') chaque produit
// dont la nouvelle photo atteint bien 400 px.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
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

const BASE = "https://thiouneteranga.com/assets/images/product/";
const LARGEUR_MAX = 800;
const LARGEUR_MIN_SOURCE = 400;
const QUALITE_WEBP = 82;
const MANIFESTE = "reparation_thioune_lot1.jsonl";

// ref, nom exact (base produits), fichier réel sur thiouneteranga.com —
// croisé depuis donnees_thioune.py et LOT_1 de importer-thioune-teranga.mjs.
const CIBLES = [
  { ref: 29, nom: "HP EliteBook 840 G5", fichier: "69923af6d05881771191030.png" },
  { ref: 30, nom: "HP EliteBook 1040 x360 G11 14\" Core Ultra 7, 16 Go, 512 Go SSD, tactile", fichier: "69923b1ae86b81771191066.jpg" },
  { ref: 31, nom: "HP 250 Dual Core, 4 Go, 256 Go SSD", fichier: "69923b3be45f01771191099.jpg" },
  { ref: 32, nom: "HP Elite x360 1040 G11 14\" Core Ultra 7, 16 Go, 512 Go SSD", fichier: "69923b70cbe041771191152.jpg" },
  { ref: 33, nom: "HP EliteBook 830 G8 Core i5, 8 Go, 256 Go SSD, 13\" tactile", fichier: "69923b95275371771191189.jpg" },
  { ref: 34, nom: "HP ProBook 450 G10 Core i5 13e génération, 16 Go, 1 To SSD, 15,6\" Full HD", fichier: "699238d72b70a1771190487.jpg" },
  { ref: 35, nom: "HP ZBook Core Ultra 7, 32 Go, 512 Go SSD", fichier: "69923929038041771190569.jpg" },
  { ref: 36, nom: "HP ProBook (modèle et configuration à préciser)", fichier: "699239507917d1771190608.png" },
  { ref: 37, nom: "MacBook Air 13\" puce M2", fichier: "69923993abf691771190675.jpeg" },
  { ref: 38, nom: "MacBook Air 13\" puce M4", fichier: "699239c822a871771190728.jpg" },
  { ref: 39, nom: "MacBook Air puce M2", fichier: "699239ee75b521771190766.png" },
  { ref: 40, nom: "HP All In One 24\" Core i5, 8 Go, 1 To SSD", fichier: "69923a18efb9d1771190808.jpeg" },
  { ref: 41, nom: "Lenovo ThinkPad X1 Carbon Gen 12 Core Ultra 7 155H", fichier: "69923ac0cc3571771190976.jpg" },
  { ref: 42, nom: "HP EliteBook x360 1030 G4 Core i7, 16 Go, 256 Go SSD", fichier: "6a94a8867aea71788127366.jpg" },
  { ref: 43, nom: "ACEMAGIC 15,6\" FHD IPS, Intel N150, 16 Go, 512 Go SSD", fichier: "6a95cc273a9cc1788202023.jpg" },
  { ref: 44, nom: "HP EliteBook 840 G6 Core i5, 8 Go, 256 Go SSD", fichier: "6a95ceb39b65e1788202675.jpg" },
  { ref: 45, nom: "HP OmniBook 7 14-KH0000NF 14\" Ryzen AI 9 HX 475, 64 Go, 1 To SSD, OLED", fichier: "6a95d02da9edb1788203053.jpg" },
  { ref: 46, nom: "Lenovo ThinkPad T14 Core i5, 16 Go, SSD", fichier: "6a95d5a5ba6f61788204453.jpg" },
  { ref: 51, nom: "Tablette Easyfun 10,1\", 16 Go + 1 To, clavier et souris inclus", fichier: "6a9769a047c3e1788307872.jpg" },
  { ref: 62, nom: "Tablette redbeat A2 10,1\", 8 Go, 128 Go, Android 14", fichier: "6a97743765bb61788310583.jpg" },
  { ref: 63, nom: "Tablette redbeat C1 8\", 6 Go, 64 Go, Android 14", fichier: "6a977488c9d481788310664.jpg" },
  { ref: 64, nom: "Tablette Survival K3000, 16 Go, 1 To", fichier: "6a97764d5da821788311117.jpg" },
  { ref: 65, nom: "Tablette origimo 10\" 5G, 8 Go, 512 Go", fichier: "6a977699426a31788311193.jpg" },
  { ref: 66, nom: "Tablette oteeto TAB16 10,1\" Android 14, clavier et stylet inclus", fichier: "6a97770541fe71788311301.jpg" },
  { ref: 67, nom: "Tablette redbeat C1 8\", 6 Go, 64 Go, Android 14 (2)", fichier: "6a977766db8321788311398.jpg" },
  { ref: 68, nom: "Répéteur Wi-Fi 2,4 et 5 GHz", fichier: "6a9778d2eba531788311762.jpg" },
];

function dejaFait() {
  if (!existsSync(MANIFESTE)) return new Set();
  return new Set(
    readFileSync(MANIFESTE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((o) => o.ok).map((o) => o.ref),
  );
}

async function main() {
  const fait = dejaFait();
  const restantes = CIBLES.filter((c) => !fait.has(c.ref));
  console.log(`${CIBLES.length} refs à traiter, ${fait.size} déjà faites, ${restantes.length} restantes.`);

  let ok = 0;
  let echecs = 0;

  for (const cible of restantes) {
    try {
      const res = await fetch(BASE + cible.fichier, { headers: { "User-Agent": "Mozilla/5.0 (SacAdo réparation photos)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const brut = Buffer.from(await res.arrayBuffer());

      const meta = await sharp(brut).metadata();
      if ((meta.width ?? 0) < LARGEUR_MIN_SOURCE) {
        throw new Error(`source encore trop petite : ${meta.width}px`);
      }

      const webp = await sharp(brut).resize({ width: LARGEUR_MAX, withoutEnlargement: true }).webp({ quality: QUALITE_WEBP }).toBuffer();
      const chemin = `import-tt-reparation/${randomUUID()}.webp`;
      const { error: errUpload } = await supabase.storage.from("produits").upload(chemin, webp, { contentType: "image/webp", upsert: false });
      if (errUpload) throw new Error(`upload échoué : ${errUpload.message}`);
      const { data } = supabase.storage.from("produits").getPublicUrl(chemin);

      const { data: produit, error: errSelect } = await supabase.from("produits").select("id").eq("nom", cible.nom).maybeSingle();
      if (errSelect || !produit) throw new Error(`produit introuvable en base : ${cible.nom}`);

      const { error: errUpdate } = await supabase
        .from("produits")
        .update({ photo: data.publicUrl, photos: [data.publicUrl], statut_publication: "publie" })
        .eq("id", produit.id);
      if (errUpdate) throw new Error(`mise à jour échouée : ${errUpdate.message}`);

      appendFileSync(MANIFESTE, JSON.stringify({ ok: true, ref: cible.ref, nom: cible.nom, produitId: produit.id, largeur: meta.width, url: data.publicUrl }) + "\n");
      console.log(`✓ ref ${cible.ref} : ${cible.nom} (${meta.width}px, republié)`);
      ok++;
    } catch (err) {
      appendFileSync(MANIFESTE, JSON.stringify({ ok: false, ref: cible.ref, nom: cible.nom, erreur: String(err.message ?? err) }) + "\n");
      console.log(`ÉCHEC ref ${cible.ref} (${cible.nom}) : ${err.message ?? err}`);
      echecs++;
    }
  }

  console.log(`\n${ok} réparés et republiés, ${echecs} échecs.`);
  console.log(`Refs 69, 71-77 (8 accessoires) hors périmètre — restent masquées, à obtenir du fournisseur.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
