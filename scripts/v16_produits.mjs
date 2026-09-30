// CORRECTIONS_V16 Lot B : 3 nouveaux produits + prix 1287 + masquage des 9
// kits T. Dry-run par défaut, --apply pour écrire. (Nommé .mjs pour rester
// cohérent avec les autres scripts du repo — aucun runtime TS n'est
// installé ; voir CORRECTIONS_V16.md qui suggérait v16_produits.ts.)
// Usage : node scripts/v16_produits.mjs [--apply]
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

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

const VENDEUR_LPD_ID = "bcb4028f-ddf4-4ac2-990a-e399bb7086db"; // vendeurs.nom_boutique = 'LPD'
const DELAI = "6j";
const LARGEUR_MAX = 1200;
const QUALITE_WEBP = 82;
const KITS_SERIE_T = [502, 503, 504, 517, 518, 519, 538, 539, 540];

function snifferImage(octets) {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return "jpg";
  if (
    octets.length >= 8 &&
    octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47 &&
    octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a
  ) return "png";
  if (
    octets.length >= 12 &&
    octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46 &&
    octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50
  ) return "webp";
  return null;
}

async function uploaderPhoto(fichier, ref) {
  const buf = await readFile(fichier);
  if (!snifferImage(buf.subarray(0, 12))) {
    throw new Error(`Fichier non reconnu comme image : ${fichier}`);
  }
  const webp = await sharp(buf)
    .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer();
  const chemin = `v16/${ref}-${randomUUID()}.webp`;
  if (DRY_RUN) {
    console.log(`   [dry-run] upload storage produits/${chemin} (${(webp.length / 1024).toFixed(0)} Ko)`);
    return `[dry-run: ${chemin}]`;
  }
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${fichier}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

async function main() {
  console.log(`=== CORRECTIONS_V16 — Lot B : produits et kits masqués ${DRY_RUN ? "(dry-run)" : "(APPLY)"} ===\n`);

  // ------------------------------------------------------------------
  // Récupération des produits de référence (1299, 1682) pour copier
  // catégorie / sous-catégorie / photo.
  // ------------------------------------------------------------------
  const { data: refCraie, error: eCraie } = await supabase
    .from("produits")
    .select("categorie_id, sous_categorie_id, photo, photos, mots_cles")
    .eq("id", 1299)
    .single();
  if (eCraie || !refCraie) throw new Error(`Produit 1299 introuvable : ${eCraie?.message}`);

  const { data: refDico, error: eDico } = await supabase
    .from("produits")
    .select("categorie_id, sous_categorie_id")
    .eq("id", 1682)
    .single();
  if (eDico || !refDico) throw new Error(`Produit 1682 introuvable : ${eDico?.message}`);

  const { data: catLivres, error: eCatLivres } = await supabase
    .from("categories")
    .select("id")
    .eq("nom", "Livres et annales")
    .single();
  if (eCatLivres || !catLivres) throw new Error(`Catégorie "Livres et annales" introuvable : ${eCatLivres?.message}`);

  // ------------------------------------------------------------------
  // 1. Les 3 nouveaux produits
  // ------------------------------------------------------------------
  const nouveauxProduits = [
    {
      code: "CRAIE-U",
      ligne: {
        nom: "Craie blanche Giotto Robercolor (à l'unité)",
        categorie_id: refCraie.categorie_id,
        sous_categorie_id: refCraie.sous_categorie_id,
        prix: 25,
        prix_achat: 25,
        delai: DELAI,
        stock: 0,
        statut: "dispo",
        statut_publication: "publie",
        publie_par: "admin",
        vendeur_id: VENDEUR_LPD_ID,
        unite_vente: "unite",
        gamme: "essentiel",
        mots_cles: refCraie.mots_cles,
        photo: refCraie.photo,
        photos: refCraie.photos,
      },
      photoFichier: null, // réutilise la photo de 1299, pas d'upload
    },
    {
      code: "ANGLAIS-JMD",
      ligne: {
        nom: "Je me débrouille en anglais",
        auteur: "John Smith",
        categorie_id: catLivres.id,
        sous_categorie_id: null,
        niveau: "Lycee",
        prix: 3000,
        prix_achat: 2000,
        delai: DELAI,
        stock: 0,
        statut: "dispo",
        statut_publication: "publie",
        publie_par: "admin",
        vendeur_id: VENDEUR_LPD_ID,
        unite_vente: "unite",
      },
      photoFichier: "public/images/prod-je-me-debrouille-en-anglais.webp",
    },
    {
      code: "LAROUSSE-60",
      ligne: {
        nom: "Dictionnaire Larousse de français de poche, 60 000 mots",
        categorie_id: refDico.categorie_id,
        sous_categorie_id: refDico.sous_categorie_id,
        prix: 2750,
        prix_achat: 2000,
        delai: DELAI,
        stock: 0,
        statut: "dispo",
        statut_publication: "publie",
        publie_par: "admin",
        vendeur_id: VENDEUR_LPD_ID,
        unite_vente: "unite",
      },
      photoFichier: "public/images/prod-dictionnaire-larousse-poche.webp",
    },
  ];

  const idsCreesOuSimules = {};

  for (const p of nouveauxProduits) {
    console.log(`1. ${p.code} — ${p.ligne.nom}`);
    if (p.photoFichier) {
      const url = await uploaderPhoto(p.photoFichier, p.code);
      p.ligne.photo = url;
      p.ligne.photos = [url];
    }
    console.log(`   ${JSON.stringify(p.ligne, null, 2).split("\n").join("\n   ")}`);

    if (DRY_RUN) {
      idsCreesOuSimules[p.code] = `[dry-run:${p.code}]`;
      continue;
    }
    const { data: cree, error } = await supabase.from("produits").insert(p.ligne).select("id").single();
    if (error || !cree) throw new Error(`Création ${p.code} échouée : ${error?.message}`);
    idsCreesOuSimules[p.code] = cree.id;
    console.log(`   ✓ créé #${cree.id}`);
  }

  // ------------------------------------------------------------------
  // 2. Prix du produit 1287
  // ------------------------------------------------------------------
  const { data: gourde, error: eGourde } = await supabase
    .from("produits")
    .select("id, nom, prix")
    .eq("id", 1287)
    .single();
  if (eGourde || !gourde) throw new Error(`Produit 1287 introuvable : ${eGourde?.message}`);
  console.log(`\n2. ${gourde.nom} (#1287) : ${gourde.prix} F -> 2500 F`);
  if (!DRY_RUN) {
    const { error } = await supabase.from("produits").update({ prix: 2500 }).eq("id", 1287);
    if (error) throw new Error(`Mise à jour 1287 échouée : ${error.message}`);
    console.log("   ✓ mis à jour");
  }

  // ------------------------------------------------------------------
  // 3. Masquer les 9 kits de la série T encore publiés
  // ------------------------------------------------------------------
  const { data: kitsT, error: eKitsT } = await supabase
    .from("kits")
    .select("id, nom, niveau, gamme, statut")
    .in("id", KITS_SERIE_T);
  if (eKitsT) throw new Error(`Lecture kits T échouée : ${eKitsT.message}`);
  console.log(`\n3. Kits série T (${KITS_SERIE_T.join(", ")}) :`);
  const kitsAMasquer = (kitsT ?? []).filter((k) => k.statut === "publie");
  for (const k of kitsT ?? []) {
    console.log(`   #${k.id} — ${k.nom} (${k.niveau} ${k.gamme}) : statut actuel = ${k.statut}${k.statut === "publie" ? " -> masque" : " (déjà masqué)"}`);
  }
  if (!DRY_RUN && kitsAMasquer.length > 0) {
    const { error } = await supabase
      .from("kits")
      .update({ statut: "masque" })
      .in("id", kitsAMasquer.map((k) => k.id));
    if (error) throw new Error(`Masquage kits T échoué : ${error.message}`);
    console.log(`   ✓ ${kitsAMasquer.length} kits masqués`);
  }

  // ------------------------------------------------------------------
  // 4. Correspondance code -> ID
  // ------------------------------------------------------------------
  if (!DRY_RUN) {
    await writeFile(
      "data/kits/v16_nouveaux_produits.json",
      JSON.stringify(idsCreesOuSimules, null, 2),
      "utf8",
    );
    console.log("\n4. Correspondance écrite : data/kits/v16_nouveaux_produits.json");
    console.log("   " + JSON.stringify(idsCreesOuSimules));
  } else {
    console.log("\n4. [dry-run] data/kits/v16_nouveaux_produits.json non écrit.");
  }

  console.log(`\n=== Fin Lot B ${DRY_RUN ? "(dry-run — rien écrit en base)" : "(APPLY — écrit en base)"} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
