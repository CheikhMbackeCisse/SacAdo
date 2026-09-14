// Import ponctuel du catalogue Seye Dynamique Technologie
// (TACHE_seye_dynamique_integration.md + TACHE_sdt_correctif.md).
// Usage : node scripts/importer-seye-dynamique.mjs
// Prérequis : migration 0070 déjà exécutée en base. Lit .env.local. Idempotent
// par nom de produit (relancer après une coupure réessaie seulement ce qui manque).
//
// Écarts assumés par rapport aux documents de tâche (voir chat) :
//   - Photo du "Dell Latitude 5400 tactile Core i7" : celle embarquée dans le
//     xlsx était une vignette de vidéo (icône lecture visible) — remplacée par
//     une photo fournie séparément par l'utilisateur.
//   - Pas de fichier vignette 300px séparé (demandé littéralement par le
//     document) : next/image fait déjà de l'optimisation à la volée
//     (next.config.ts), comme pour les imports précédents (Korka, Ndayane).
//   - "Six machines à plus de 500 000 FCFA" (document) : les données n'en
//     contiennent que 4. Sans conséquence, tout est importé masqué de toute
//     façon.
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SCRATCHPAD =
  "C:\\Users\\WORLDI~1\\AppData\\Local\\Temp\\claude\\C--Users-WORLD-INFORMATIQUE-Downloads-SacAdo\\d5a1ec2c-99a2-42da-999c-2e7785fc8383\\scratchpad";
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? path.join(SCRATCHPAD, "sdt_images");

const VENDEUR_NOM = "Seye Dynamique Technologie";
const VENDEUR_TELEPHONE = "78 590 68 40";
const LARGEUR_MAX = 800;
const QUALITE_WEBP = 82;

// Grilles de tarification par palier (TACHE_sdt_correctif.md §1), rangées sur
// la fiche fournisseur (migration 0070) — pas en dur dans le calcul métier,
// seulement ici pour créer le vendeur au premier lancement.
const GRILLE_REMISE = [
  { seuil: 150000, valeur: 10000 },
  { seuil: 200000, valeur: 15000 },
  { seuil: 300000, valeur: 20000 },
  { seuil: null, valeur: 25000 },
];
const GRILLE_MAJORATION = [
  { seuil: 150000, valeur: 5000 },
  { seuil: 250000, valeur: 10000 },
  { seuil: null, valeur: 15000 },
];

function palier(prixAffiche, grille) {
  for (const p of grille) {
    if (p.seuil === null || prixAffiche < p.seuil) return p.valeur;
  }
  throw new Error(`Aucun palier ne couvre le prix ${prixAffiche}`);
}

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

// Copie minimale de lib/images/sniff.ts (fichier .ts non importable tel quel
// dans un script .mjs jetable) : mêmes magic bytes, même logique.
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

async function uploaderPhoto(filename) {
  const buf = await readFile(path.join(PHOTOS_DIR, filename));
  if (!snifferImage(buf.subarray(0, 12))) {
    throw new Error(`Fichier non reconnu comme image : ${filename}`);
  }
  const webp = await sharp(buf)
    .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer();
  const chemin = `import-sdt/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${filename}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

// Les 34 produits (TACHE_seye_dynamique_integration.md §5, ordre du tableur
// + Dell Latitude 3190 du correctif en tête). `photo` = nom de fichier dans
// PHOTOS_DIR. `prixAffiche` sert au calcul remise/majoration via les grilles
// ci-dessus, sauf pour l'accessoire (prix fixes, hors palier — §3 du correctif).
const PRODUITS = [
  // --- Correctif : nouveau produit, en tête ---
  {
    nom: "Dell Latitude 3190 2-en-1",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: null,
    ramGo: 8,
    stockageGo: 128,
    typeStockage: "SSD",
    tailleEcran: 12.0,
    ecranTactile: true,
    convertible: true,
    marque: "Dell",
    prixAffiche: 90000,
    etat: "reconditionne",
    garantieMois: 6,
    photo: "dell_3190.jpg",
  },
  // --- Accessoire : hors grilles par palier (§3 du correctif) ---
  {
    nom: "Support refroidisseur pour ordinateur portable",
    sousCategorieSlug: "accessoires-info",
    processeur: null,
    ramGo: null,
    stockageGo: null,
    typeStockage: null,
    tailleEcran: null,
    ecranTactile: null,
    convertible: null,
    marque: null,
    etat: null,
    garantieMois: null,
    photo: "image1.png",
    prixVenteFixe: 20000,
    prixAchatFixe: 17500,
  },
  // --- Ordinateurs portables (30 machines classiques et convertibles) ---
  {
    nom: "Dell Latitude 3120",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Pentium Silver N6000 4 coeurs",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 11.6,
    ecranTactile: true, convertible: true, marque: "Dell",
    prixAffiche: 100000, etat: "reconditionne", garantieMois: 6, photo: "image2.png",
  },
  {
    nom: "HP EliteBook 1030 G1",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core m3 6e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.0,
    ecranTactile: false, convertible: false, marque: "HP",
    prixAffiche: 110000, etat: "reconditionne", garantieMois: 6, photo: "image3.png",
  },
  {
    nom: "HP EliteBook 840 G3",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 6e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: false, convertible: false, marque: "HP",
    prixAffiche: 135000, etat: "reconditionne", garantieMois: 6, photo: "image4.png",
  },
  {
    nom: "Dell Latitude 5400",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: false, convertible: false, marque: "Dell",
    prixAffiche: 150000, etat: "reconditionne", garantieMois: 6, photo: "image5.png",
  },
  {
    nom: "Dell Latitude 7490 tactile",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: true, convertible: false, marque: "Dell",
    prixAffiche: 155000, etat: "reconditionne", garantieMois: 6, photo: "image6.png",
  },
  {
    nom: "Dell Latitude 5400 tactile",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: true, convertible: false, marque: "Dell",
    prixAffiche: 155000, etat: "reconditionne", garantieMois: 6, photo: "image7.png",
  },
  {
    nom: "HP EliteBook 840 G6",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5-8365U",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: false, convertible: false, marque: "HP",
    prixAffiche: 170000, etat: "reconditionne", garantieMois: 6, photo: "image8.png",
  },
  {
    nom: "HP EliteBook 735 G6",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Ryzen 5 PRO 3500U",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: false, convertible: false, marque: "HP",
    prixAffiche: 175000, etat: "reconditionne", garantieMois: 6, photo: "image9.png",
  },
  {
    nom: "Dell Latitude 7390 2-en-1",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: true, marque: "Dell",
    prixAffiche: 175000, etat: "reconditionne", garantieMois: 6, photo: "image10.png",
  },
  {
    nom: "HP ProBook 450 G7",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 10e gen",
    ramGo: 16, stockageGo: 256, typeStockage: "SSD", tailleEcran: 15.6,
    ecranTactile: false, convertible: false, marque: "HP",
    prixAffiche: 175000, etat: "reconditionne", garantieMois: 6, photo: "image11.png",
  },
  {
    nom: "HP EliteBook 830 G5 tactile",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: false, marque: "HP",
    prixAffiche: 180000, etat: "reconditionne", garantieMois: 6, photo: "image12.png",
  },
  {
    // Photo d'origine (vignette de vidéo) remplacée — voir en-tête du script.
    nom: "Dell Latitude 5400 tactile Core i7",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7 8e gen",
    ramGo: 16, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: true, convertible: false, marque: "Dell",
    prixAffiche: 185000, etat: "reconditionne", garantieMois: 6, photo: "dell_5400_i7_new.jpg",
  },
  {
    nom: "HP EliteBook 1030 G2",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 7e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: true, marque: "HP",
    prixAffiche: 185000, etat: "reconditionne", garantieMois: 6, photo: "image14.png",
  },
  {
    nom: "HP EliteBook 840 G6 - 16 Go",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5-8365U",
    ramGo: 16, stockageGo: 256, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: false, convertible: false, marque: "HP",
    prixAffiche: 185000, etat: "reconditionne", garantieMois: 6, photo: "image15.png",
  },
  {
    nom: "HP EliteBook 830 G6 x360",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 16, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: true, marque: "HP",
    prixAffiche: 220000, etat: "reconditionne", garantieMois: 6, photo: "image16.png",
  },
  {
    nom: "HP EliteBook x360 1030 G3",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 8e gen",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: true, marque: "HP",
    prixAffiche: 220000, etat: "reconditionne", garantieMois: 6, photo: "image17.png",
  },
  {
    nom: "Lenovo ThinkPad L13 Gen 3",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 12e gen",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: false, convertible: false, marque: "Lenovo",
    prixAffiche: 225000, etat: "reconditionne", garantieMois: 6, photo: "image18.png",
  },
  {
    nom: "Lenovo ThinkPad L13 Yoga",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 11e gen",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: true, marque: "Lenovo",
    prixAffiche: 225000, etat: "reconditionne", garantieMois: 6, photo: "image19.png",
  },
  // --- Tablettes ---
  {
    nom: "Microsoft Surface Pro 7+",
    sousCategorieSlug: "tablettes",
    processeur: "Core i5-1135G7",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 12.3,
    ecranTactile: true, convertible: true, marque: "Microsoft",
    prixAffiche: 240000, etat: "reconditionne", garantieMois: 6, photo: "image20.png",
  },
  {
    nom: "Dell Latitude 7320",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7 11e gen",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: false, convertible: false, marque: "Dell",
    prixAffiche: 245000, etat: "reconditionne", garantieMois: 6, photo: "image21.png",
  },
  {
    nom: "Microsoft Surface Laptop 4",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7 11e gen",
    ramGo: 16, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.5,
    ecranTactile: true, convertible: false, marque: "Microsoft",
    prixAffiche: 265000, etat: "reconditionne", garantieMois: 6, photo: "image22.png",
  },
  {
    nom: "HP Elite x2 1013 G8",
    sousCategorieSlug: "tablettes",
    processeur: "Core i5 11e gen",
    ramGo: 16, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.0,
    ecranTactile: true, convertible: true, marque: "HP",
    prixAffiche: 270000, etat: "reconditionne", garantieMois: 6, photo: "image23.png",
  },
  {
    nom: "HP EliteBook x360 1030 G7",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i5 10e gen",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 13.3,
    ecranTactile: true, convertible: true, marque: "HP",
    prixAffiche: 275000, etat: "reconditionne", garantieMois: 6, photo: "image24.png",
  },
  {
    nom: "Lenovo ThinkPad T14 Gen 3",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7-1255U",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: false, convertible: false, marque: "Lenovo",
    prixAffiche: 330000, etat: "reconditionne", garantieMois: 6, photo: "image25.png",
  },
  {
    nom: "MacBook Pro 13 pouces M1 (2020)",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Puce Apple M1",
    ramGo: 8, stockageGo: 256, typeStockage: "SSD", tailleEcran: 13.0,
    ecranTactile: false, convertible: false, marque: "Apple",
    prixAffiche: 375000, etat: "reconditionne", garantieMois: 6, photo: "image26.png",
  },
  {
    nom: "Lenovo ThinkPad P14s Gen 3",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7-1260P",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: true, convertible: false, marque: "Lenovo",
    prixAffiche: 380000, etat: "reconditionne", garantieMois: 6, photo: "image27.png",
  },
  {
    nom: "Lenovo ThinkPad X1 Yoga Gen 6",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7 11e gen",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: true, convertible: true, marque: "Lenovo",
    prixAffiche: 400000, etat: "reconditionne", garantieMois: 6, photo: "image28.png",
  },
  {
    nom: "Lenovo ThinkPad P14s Gen 4",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7-1360P",
    ramGo: 16, stockageGo: 1000, typeStockage: "SSD", tailleEcran: 14.0,
    ecranTactile: false, convertible: false, marque: "Lenovo",
    prixAffiche: 420000, etat: "reconditionne", garantieMois: 6, photo: "image29.png",
  },
  // --- Machines masquées : plus de 500 000 FCFA, hors cible étudiant (§6) ---
  {
    nom: "Dell Precision 7760",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7-11850H",
    ramGo: 32, stockageGo: 512, typeStockage: "SSD", tailleEcran: 17.3,
    ecranTactile: false, convertible: false, marque: "Dell",
    prixAffiche: 520000, etat: "reconditionne", garantieMois: 6, photo: "image30.png",
  },
  {
    nom: "MacBook Pro 16 pouces (2021)",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Puce Apple M1 Pro",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 16.2,
    ecranTactile: false, convertible: false, marque: "Apple",
    prixAffiche: 550000, etat: "reconditionne", garantieMois: 6, photo: "image31.png",
  },
  {
    nom: "MSI Thin 15",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Core i7 13e gen",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 15.0,
    ecranTactile: false, convertible: false, marque: "MSI",
    prixAffiche: 600000, etat: "reconditionne", garantieMois: 6, photo: "image32.png",
  },
  {
    nom: "Asus TUF A15",
    sousCategorieSlug: "ordinateurs-portables",
    processeur: "Ryzen 5",
    ramGo: 16, stockageGo: 512, typeStockage: "SSD", tailleEcran: 15.0,
    ecranTactile: false, convertible: false, marque: "Asus",
    prixAffiche: 660000, etat: "reconditionne", garantieMois: 6, photo: "image33.png",
  },
];

async function main() {
  console.log(`${PRODUITS.length} produits à traiter.`);

  const disponibles = new Set(await readdir(PHOTOS_DIR));
  for (const p of PRODUITS) {
    if (!disponibles.has(p.photo)) throw new Error(`Photo manquante : ${p.photo} (${p.nom})`);
  }

  const { data: categorie, error: errCat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "ordinateurs")
    .single();
  if (errCat || !categorie) throw new Error("Catégorie 'ordinateurs' (Informatique) introuvable.");

  const { data: sousCats } = await supabase
    .from("sous_categories")
    .select("id, slug")
    .eq("categorie_id", categorie.id);
  const idSousCat = Object.fromEntries((sousCats ?? []).map((s) => [s.slug, s.id]));

  // Vendeur = fiche fournisseur (migration 0036) : upsert idempotent par nom.
  let { data: vendeur } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", VENDEUR_NOM)
    .maybeSingle();
  if (!vendeur) {
    const { data: cree, error } = await supabase
      .from("vendeurs")
      .insert({
        nom_boutique: VENDEUR_NOM,
        user_id: null,
        contact_telephone: VENDEUR_TELEPHONE,
        grille_remise: GRILLE_REMISE,
        grille_majoration: GRILLE_MAJORATION,
        actif: true,
      })
      .select("id")
      .single();
    if (error || !cree) throw new Error(`Création du vendeur échouée : ${error?.message}`);
    vendeur = cree;
    console.log(`✓ vendeur créé : ${VENDEUR_NOM} (#${vendeur.id})`);
  } else {
    console.log(`= vendeur déjà présent : ${VENDEUR_NOM} (#${vendeur.id})`);
  }

  let crees = 0;
  let ignores = 0;

  for (const p of PRODUITS) {
    const { data: existant } = await supabase
      .from("produits")
      .select("id")
      .eq("nom", p.nom)
      .maybeSingle();
    if (existant) {
      console.log(`= déjà présent, ignoré : ${p.nom}`);
      ignores++;
      continue;
    }

    const sousCategorieId = idSousCat[p.sousCategorieSlug] ?? null;
    if (!sousCategorieId) throw new Error(`Sous-catégorie inconnue : ${p.sousCategorieSlug} (${p.nom})`);

    const prixAchat = p.prixAchatFixe ?? p.prixAffiche - palier(p.prixAffiche, GRILLE_REMISE);
    const prixVente = p.prixVenteFixe ?? p.prixAffiche + palier(p.prixAffiche, GRILLE_MAJORATION);

    console.log(`… photo : ${p.nom}`);
    const photoUrl = await uploaderPhoto(p.photo);

    const payload = {
      nom: p.nom,
      categorie_id: categorie.id,
      sous_categorie_id: sousCategorieId,
      prix: prixVente,
      prix_achat: prixAchat,
      delai: "6j",
      photo: photoUrl,
      photos: [photoUrl],
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      description: null,
      vendeur_id: vendeur.id,
      publie_par: "admin",
      statut_publication: "en_attente",
      processeur: p.processeur,
      ram_go: p.ramGo,
      stockage_go: p.stockageGo,
      type_stockage: p.typeStockage,
      taille_ecran: p.tailleEcran,
      ecran_tactile: p.ecranTactile,
      convertible: p.convertible,
      etat: p.etat,
      garantie_mois: p.garantieMois,
      marque: p.marque,
    };

    const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
    if (error || !inserted) throw new Error(`Insertion échouée (${p.nom}) : ${error?.message}`);
    console.log(`✓ créé #${inserted.id} : ${p.nom} — achat ${prixAchat}, vente ${prixVente}`);
    crees++;
  }

  console.log(`\n${crees} produits créés, ${ignores} déjà présents (ignorés).`);
  console.log(`Tous en statut_publication = 'en_attente' (masqués) : à republier depuis /admin/produits après vérification.`);
  console.log(`\nAvant publication :`);
  console.log(`  - obtenir par écrit les termes de garantie du fournisseur (couverture, délai, transport) ;`);
  console.log(`  - confirmer les quantités réelles disponibles (stock importé à 1 partout) ;`);
  console.log(`  - le support refroidisseur reste masqué tant que la remise n'est pas négociée (marge quasi nulle).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
