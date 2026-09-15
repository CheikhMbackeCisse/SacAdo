// Import ponctuel du catalogue Thioune Teranga (TACHE_thioune_integration.md).
// Usage : node scripts/importer-thioune-teranga.mjs
// Prérequis : migration 0078 déjà exécutée en base. Lit .env.local. Idempotent
// par nom de produit (relancer après une coupure réessaie seulement ce qui manque).
//
// Écarts assumés par rapport au document de tâche (voir chat) :
//   - iPad (référence A01) : importé une première fois avec prix = 120 000
//     (borne basse, prix_a_verifier = true), puis SUPPRIMÉ de la base et de
//     ce fichier sur décision du 2026-09-15 : pas de prix confirmé par le
//     fournisseur, donc pas d'article tant que ce n'est pas le cas. Catégorie
//     de remise confirmée par ailleurs pour le jour où il reviendra : MacBook
//     et iMac (20 %), pas Tablettes — c'est un produit Apple.
//   - Garantie : le fournisseur confirme 6 mois sur le matériel reconditionné
//     (2026-09-15). Appliqué à `etat = 'reconditionne'`, `garantie_mois = 6`
//     sur les seules catégories "MacBook et iMac" et "PC portables et PC de
//     bureau" (mêmes catégories que le parc reconditionné Seye Dynamique) ;
//     Accessoires et Tablettes restent neufs, `etat` à null.
//   - Les 3 machines à 100 000-250 000 FCFA (réf 31, 29, 44) ne reçoivent PAS
//     coefficient_visibilite = 1.50 à la main : depuis la migration 0076, ce
//     boost ×1.50 est déjà automatique pour toute machine de cette tranche de
//     prix en sous-catégorie ordinateurs-portables/ordinateurs-de-bureau,
//     tous fournisseurs confondus. Le poser en dur ici l'appliquerait deux
//     fois (×2.25 au lieu de ×1.50). On laisse coefficient_visibilite à sa
//     valeur par défaut (1.00, neutre).
//   - `etat` (neuf/reconditionné) et `garantie_mois` : laissés à null pour
//     tout le catalogue. Le document ne précise l'état produit par produit,
//     et deviner risquerait d'afficher un mauvais badge (contraire à la
//     règle d'honnêteté du produit). À obtenir du fournisseur (§8 du
//     document, qui demande déjà la durée de garantie).
//   - Référence 51 (Tablette Easyfun) : la fiche annonce "16 Go + 1 To" mais
//     l'annotation du fournisseur dans le classeur précise 500 Go réels.
//     stockage_go = 500 (le nom affiché reste celui du classeur, tel quel).
//   - Références 63 et 67 : même tablette (redbeat C1) à deux prix différents
//     (70 000 et 65 000). Le fournisseur a confirmé par écrit dans le
//     classeur qu'il n'y a aucune différence, juste deux prix pour inciter le
//     client à choisir. Les deux sont importées comme deux produits distincts.
//   - iPad classé en sous-catégorie "tablettes" pour l'affichage client (visé
//     par les acheteurs de tablettes), mais rattaché à la grille de remise
//     "MacBook et iMac" (20 %) pour le calcul du prix d'achat, conformément à
//     l'exception explicite du document (produit Apple). Le produit reste de
//     toute façon masqué (prix_a_verifier) tant que le modèle n'est pas confirmé.
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SCRATCHPAD =
  "C:\\Users\\WORLDI~1\\AppData\\Local\\Temp\\claude\\C--Users-WORLD-INFORMATIQUE-Downloads-SacAdo\\f803f52e-9353-4dd5-9276-72f11743e0eb\\scratchpad";
const PHOTOS_DIR =
  process.env.PHOTOS_DIR ??
  path.join(SCRATCHPAD, "thiouneteranga", "zip11", "photos_thioune", "photos_thioune");

const VENDEUR_NOM = "Thioune Teranga";
const LARGEUR_MAX = 800;
const QUALITE_WEBP = 82;

// Grille de remise par catégorie fournisseur (négociée, classeur "Grille de
// remise" du document de tâche) — enregistrée telle quelle sur la fiche
// fournisseur, et utilisée ici pour calculer prix_achat = prix × (1 − remise).
// Pas de grille_majoration : le prix de vente SacAdo est le prix public du
// fournisseur, la marge est la remise, rien de plus (§1 du document).
const REMISE_PAR_CATEGORIE = {
  Accessoires: 0.3,
  Tablettes: 0.15,
  "MacBook et iMac": 0.2,
  "PC portables et PC de bureau": 0.15,
};

const SOUS_CATEGORIE_PAR_CATEGORIE = {
  Accessoires: "accessoires-info",
  Tablettes: "tablettes",
  "MacBook et iMac": "ordinateurs-portables",
  "PC portables et PC de bureau": "ordinateurs-portables", // sauf HP All In One -> ordinateurs-de-bureau
};

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
  const chemin = `import-tt/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${filename}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

// Lot 1 : 34 produits (35 du classeur négocié moins la référence 70, décodeur
// TV Android — hors périmètre études, §3 du document). `ref` = colonne Réf.
// du classeur, gardée en commentaire pour retrouver la ligne d'origine.
const LOT_1 = [
  // --- Accessoires (remise 30 %) ---
  { ref: 76, nom: "Modem routeur Wi-Fi 4G LTE, emplacement SIM", categorie: "Accessoires", prix: 25000, marque: null, photo: "TT76_MODEM_ROUTEUR_WI_FI_4G_LTE_EMPLACEMENT_SIM.png" },
  { ref: 77, nom: "Modem routeur Wi-Fi TP-Link", categorie: "Accessoires", prix: 25000, marque: "TP-Link", photo: "TT77_MODEM_ROUTEUR_WI_FI_TP_LINK.png" },
  { ref: 75, nom: "Routeur modem Wi-Fi 4G de poche, emplacement SIM, batterie 3000 mAh", categorie: "Accessoires", prix: 22000, marque: null, photo: "TT75_ROUTEUR_MODEM_WI_FI_4G_DE_POCHE_EMPLACEMENT_SIM_BA.png" },
  { ref: 69, nom: "Amplificateur de signal Wi-Fi AC 300 Mbps", categorie: "Accessoires", prix: 10000, marque: null, photo: "TT69_AMPLIFICATEUR_DE_SIGNAL_WI_FI_AC_300_MBPS.png" },
  { ref: 68, nom: "Répéteur Wi-Fi 2,4 et 5 GHz", categorie: "Accessoires", prix: 8000, marque: null, photo: "TT68_REPETEUR_WI_FI_2_4_ET_5_GHZ.png" },
  { ref: 72, nom: "Clé USB Wi-Fi 300 Mbps", categorie: "Accessoires", prix: 8000, marque: null, photo: "TT72_CLE_USB_WI_FI_300_MBPS.png" },
  { ref: 71, nom: "Mini adaptateur USB Wi-Fi TP-Link TL-WN823N 300 Mbps", categorie: "Accessoires", prix: 5000, marque: "TP-Link", photo: "TT71_MINI_ADAPTATEUR_USB_WI_FI_TP_LINK_TL_WN823N_300_MB.png" },
  { ref: 74, nom: "Support pliable en aluminium pour ordinateur portable", categorie: "Accessoires", prix: 5000, marque: null, photo: "TT74_SUPPORT_PLIABLE_EN_ALUMINIUM_POUR_ORDINATEUR_PORTA.png" },
  { ref: 73, nom: "Souris sans fil rechargeable STARLIGHT 2,4 GHz / Bluetooth", categorie: "Accessoires", prix: 3500, marque: "STARLIGHT", photo: "TT73_SOURIS_SANS_FIL_RECHARGEABLE_STARLIGHT_2_4_GHZ_BLU.png" },

  // --- Tablettes (remise 15 %) ---
  { ref: 64, nom: "Tablette Survival K3000, 16 Go, 1 To", categorie: "Tablettes", prix: 85000, marque: "Survival", ramGo: 16, stockageGo: 1000, ecranTactile: true, photo: "TT64_TABLETTE_SURVIVAL_K3000_16_GO_1_TO.png" },
  { ref: 65, nom: "Tablette origimo 10\" 5G, 8 Go, 512 Go", categorie: "Tablettes", prix: 85000, marque: "origimo", tailleEcran: 10, ramGo: 8, stockageGo: 512, ecranTactile: true, photo: "TT65_TABLETTE_ORIGIMO_10_5G_8_GO_512_GO.png" },
  { ref: 66, nom: "Tablette oteeto TAB16 10,1\" Android 14, clavier et stylet inclus", categorie: "Tablettes", prix: 85000, marque: "oteeto", tailleEcran: 10.1, ecranTactile: true, photo: "TT66_TABLETTE_OTEETO_TAB16_10_1_ANDROID_14_CLAVIER_ET_S.png" },
  { ref: 62, nom: "Tablette redbeat A2 10,1\", 8 Go, 128 Go, Android 14", categorie: "Tablettes", prix: 75000, marque: "redbeat", tailleEcran: 10.1, ramGo: 8, stockageGo: 128, ecranTactile: true, photo: "TT62_TABLETTE_REDBEAT_A2_10_1_8_GO_128_GO_ANDROID_14.png" },
  { ref: 63, nom: "Tablette redbeat C1 8\", 6 Go, 64 Go, Android 14", categorie: "Tablettes", prix: 70000, marque: "redbeat", tailleEcran: 8, ramGo: 6, stockageGo: 64, ecranTactile: true, photo: "TT63_TABLETTE_REDBEAT_C1_8_6_GO_64_GO_ANDROID_14.png" },
  { ref: 51, nom: "Tablette Easyfun 10,1\", 16 Go + 1 To, clavier et souris inclus", categorie: "Tablettes", prix: 68600, marque: "Easyfun", tailleEcran: 10.1, ramGo: 16, stockageGo: 500, ecranTactile: true, photo: "TT51_TABLETTE_EASYFUN_10_1_16_GO_1_TO_CLAVIER_ET_SOURIS.png" },
  { ref: 67, nom: "Tablette redbeat C1 8\", 6 Go, 64 Go, Android 14 (2)", categorie: "Tablettes", prix: 65000, marque: "redbeat", tailleEcran: 8, ramGo: 6, stockageGo: 64, ecranTactile: true, photo: "TT67_TABLETTE_REDBEAT_C1_8_6_GO_64_GO_ANDROID_14.png" },

  // --- MacBook et iMac (remise 20 %) — reconditionné, garantie 6 mois ---
  { ref: 38, nom: "MacBook Air 13\" puce M4", categorie: "MacBook et iMac", prix: 800000, marque: "Apple", processeur: "Puce Apple M4", tailleEcran: 13, typeStockage: "SSD", ecranTactile: false, photo: "TT38_MACBOOK_AIR_13_PUCE_M4.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 39, nom: "MacBook Air puce M2", categorie: "MacBook et iMac", prix: 680000, marque: "Apple", processeur: "Puce Apple M2", typeStockage: "SSD", ecranTactile: false, photo: "TT39_MACBOOK_AIR_PUCE_M2.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 37, nom: "MacBook Air 13\" puce M2", categorie: "MacBook et iMac", prix: 598000, marque: "Apple", processeur: "Puce Apple M2", tailleEcran: 13, typeStockage: "SSD", ecranTactile: false, photo: "TT37_MACBOOK_AIR_13_PUCE_M2.png", etat: "reconditionne", garantieMois: 6 },

  // --- PC portables et PC de bureau (remise 15 %) — reconditionné, garantie 6 mois ---
  { ref: 32, nom: "HP Elite x360 1040 G11 14\" Core Ultra 7, 16 Go, 512 Go SSD", categorie: "PC portables et PC de bureau", prix: 850000, marque: "HP", processeur: "Core Ultra 7", tailleEcran: 14, ramGo: 16, stockageGo: 512, typeStockage: "SSD", ecranTactile: true, photo: "TT32_HP_ELITE_X360_1040_G11_14_CORE_ULTRA_7_16_GO_512_G.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 30, nom: "HP EliteBook 1040 x360 G11 14\" Core Ultra 7, 16 Go, 512 Go SSD, tactile", categorie: "PC portables et PC de bureau", prix: 750000, marque: "HP", processeur: "Core Ultra 7", tailleEcran: 14, ramGo: 16, stockageGo: 512, typeStockage: "SSD", ecranTactile: true, photo: "TT30_HP_ELITEBOOK_1040_X360_G11_14_CORE_ULTRA_7_16_GO_5.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 35, nom: "HP ZBook Core Ultra 7, 32 Go, 512 Go SSD", categorie: "PC portables et PC de bureau", prix: 552000, marque: "HP", processeur: "Core Ultra 7", ramGo: 32, stockageGo: 512, typeStockage: "SSD", ecranTactile: false, photo: "TT35_HP_ZBOOK_CORE_ULTRA_7_32_GO_512_GO_SSD.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 40, nom: "HP All In One 24\" Core i5, 8 Go, 1 To SSD", categorie: "PC portables et PC de bureau", sousCategorieSlug: "ordinateurs-de-bureau", prix: 550000, marque: "HP", processeur: "Core i5", tailleEcran: 24, ramGo: 8, stockageGo: 1000, typeStockage: "SSD", ecranTactile: false, photo: "TT40_HP_ALL_IN_ONE_24_CORE_I5_8_GO_1_TO_SSD.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 45, nom: "HP OmniBook 7 14-KH0000NF 14\" Ryzen AI 9 HX 475, 64 Go, 1 To SSD, OLED", categorie: "PC portables et PC de bureau", prix: 450000, marque: "HP", processeur: "Ryzen AI 9 HX 475", tailleEcran: 14, ramGo: 64, stockageGo: 1000, typeStockage: "SSD", ecranTactile: false, photo: "TT45_HP_OMNIBOOK_7_14_KH0000NF_14_RYZEN_AI_9_HX_475_64_.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 34, nom: "HP ProBook 450 G10 Core i5 13e génération, 16 Go, 1 To SSD, 15,6\" Full HD", categorie: "PC portables et PC de bureau", prix: 414000, marque: "HP", processeur: "Core i5 13e génération", tailleEcran: 15.6, ramGo: 16, stockageGo: 1000, typeStockage: "SSD", ecranTactile: false, photo: "TT34_HP_PROBOOK_450_G10_CORE_I5_13E_GENERATION_16_GO_1_.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 33, nom: "HP EliteBook 830 G8 Core i5, 8 Go, 256 Go SSD, 13\" tactile", categorie: "PC portables et PC de bureau", prix: 400000, marque: "HP", processeur: "Core i5", tailleEcran: 13, ramGo: 8, stockageGo: 256, typeStockage: "SSD", ecranTactile: true, photo: "TT33_HP_ELITEBOOK_830_G8_CORE_I5_8_GO_256_GO_SSD_13_TAC.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 43, nom: "ACEMAGIC 15,6\" FHD IPS, Intel N150, 16 Go, 512 Go SSD", categorie: "PC portables et PC de bureau", prix: 350000, marque: "ACEMAGIC", processeur: "Intel N150", tailleEcran: 15.6, ramGo: 16, stockageGo: 512, typeStockage: "SSD", ecranTactile: false, photo: "TT43_ACEMAGIC_15_6_FHD_IPS_INTEL_N150_16_GO_512_GO_SSD.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 46, nom: "Lenovo ThinkPad T14 Core i5, 16 Go, SSD", categorie: "PC portables et PC de bureau", prix: 332500, marque: "Lenovo", processeur: "Core i5", ramGo: 16, typeStockage: "SSD", ecranTactile: false, photo: "TT46_LENOVO_THINKPAD_T14_CORE_I5_16_GO_SSD.png", etat: "reconditionne", garantieMois: 6 },
  // Prix nettement sous le niveau habituel de ce modèle (§3 du document) : masqué + prix à vérifier.
  { ref: 41, nom: "Lenovo ThinkPad X1 Carbon Gen 12 Core Ultra 7 155H", categorie: "PC portables et PC de bureau", prix: 279000, marque: "Lenovo", processeur: "Core Ultra 7 155H", ecranTactile: false, photo: "TT41_LENOVO_THINKPAD_X1_CARBON_GEN_12_CORE_ULTRA_7_155H.png", prixAVerifier: true, etat: "reconditionne", garantieMois: 6 },
  // Modèle et configuration non précisés (§3 du document) : masqué + prix à vérifier.
  { ref: 36, nom: "HP ProBook (modèle et configuration à préciser)", categorie: "PC portables et PC de bureau", prix: 250000, marque: "HP", ecranTactile: false, photo: "TT36_HP_PROBOOK_MODELE_ET_CONFIGURATION_A_PRECISER.png", prixAVerifier: true, etat: "reconditionne", garantieMois: 6 },
  { ref: 42, nom: "HP EliteBook x360 1030 G4 Core i7, 16 Go, 256 Go SSD", categorie: "PC portables et PC de bureau", prix: 250000, marque: "HP", processeur: "Core i7", ramGo: 16, stockageGo: 256, typeStockage: "SSD", ecranTactile: true, photo: "TT42_HP_ELITEBOOK_X360_1030_G4_CORE_I7_16_GO_256_GO_SSD.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 44, nom: "HP EliteBook 840 G6 Core i5, 8 Go, 256 Go SSD", categorie: "PC portables et PC de bureau", prix: 190000, marque: "HP", processeur: "Core i5", ramGo: 8, stockageGo: 256, typeStockage: "SSD", ecranTactile: false, photo: "TT44_HP_ELITEBOOK_840_G6_CORE_I5_8_GO_256_GO_SSD.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 29, nom: "HP EliteBook 840 G5", categorie: "PC portables et PC de bureau", prix: 150000, marque: "HP", ecranTactile: false, photo: "TT29_HP_ELITEBOOK_840_G5.png", etat: "reconditionne", garantieMois: 6 },
  { ref: 31, nom: "HP 250 Dual Core, 4 Go, 256 Go SSD", categorie: "PC portables et PC de bureau", prix: 130000, marque: "HP", processeur: "Dual Core", ramGo: 4, stockageGo: 256, typeStockage: "SSD", ecranTactile: false, photo: "TT31_HP_250_DUAL_CORE_4_GO_256_GO_SSD.png", etat: "reconditionne", garantieMois: 6 },
];

// Lot 2 : 8 produits sans prix fournisseur (SacAdo_Thioune_articles_sans_prix_v2.xlsx,
// onglet "A chiffrer"). Prix de vente fixé sur la médiane de marché ;
// prix_achat_previsionnel = true. Les deux doublons du lot 1 évoqués dans
// le document initial (support pliable réf 74, adaptateur Wi-Fi réf 71/72)
// n'apparaissent plus dans le fichier "_v2" fourni : rien à faire de ce côté.
// iPad (réf A01) retiré (décision 2026-09-15) : pas de prix confirmé par le
// fournisseur, donc pas d'article pour l'instant — voir écarts assumés en
// tête de fichier.
const LOT_2 = [
  {
    ref: "A02", nom: "Tablette Android 10 pouces (modèle à confirmer)", categorie: "Tablettes",
    prix: 75000, tailleEcran: 10, ecranTactile: true,
    photo: "A02_TABLETTE_ANDROID_10_POUCES_MODELE_A_CONFIRMER.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A03", nom: "Clé USB métal personnalisable", categorie: "Accessoires",
    prix: 7500, photo: "A03_CLE_USB_METAL_PERSONNALISABLE.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A04", nom: "Écouteurs sans fil Bluetooth K-330", categorie: "Accessoires",
    prix: 7000, photo: "A04_ECOUTEURS_SANS_FIL_BLUETOOTH_K_330.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A05", nom: "Écouteurs sans fil Bluetooth avec afficheur de charge", categorie: "Accessoires",
    prix: 9000, photo: "A05_ECOUTEURS_SANS_FIL_BLUETOOTH_AVEC_AFFICHEUR_DE_CHA.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A06", nom: "Boîtier externe pour disque dur 2,5 pouces, SATA vers USB 3.0", categorie: "Accessoires",
    prix: 5000, photo: "A06_BOITIER_EXTERNE_POUR_DISQUE_DUR_2_5_POUCES_SATA_VE.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A07", nom: "Ensemble clavier et souris gamer rétroéclairés RGB (SOREX)", categorie: "Accessoires",
    prix: 15000, marque: "SOREX", photo: "A07_ENSEMBLE_CLAVIER_ET_SOURIS_GAMER_RETROECLAIRES_RGB.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A08", nom: "Clavier rétroéclairé RGB à panneau transparent", categorie: "Accessoires",
    prix: 12500, photo: "A08_CLAVIER_RETROECLAIRE_RGB_A_PANNEAU_TRANSPARENT.jpeg", prixAchatPrevisionnel: true,
  },
  {
    ref: "A09", nom: "Ensemble clavier et souris rétroéclairés RGB, touches colorées", categorie: "Accessoires",
    prix: 15000, photo: "A09_ENSEMBLE_CLAVIER_ET_SOURIS_RETROECLAIRES_RGB_TOUCH.jpeg", prixAchatPrevisionnel: true,
  },
];

const PRODUITS = [...LOT_1, ...LOT_2];

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

  // Vendeur = fiche fournisseur (table vendeurs) : upsert idempotent par nom.
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
        contact_telephone: null, // pas communiqué dans le classeur négocié — à obtenir
        grille_remise: REMISE_PAR_CATEGORIE,
        grille_majoration: null, // pas de majoration : le prix de vente = prix public fournisseur (§1)
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

    const slugSousCat = p.sousCategorieSlug ?? SOUS_CATEGORIE_PAR_CATEGORIE[p.categorie];
    const sousCategorieId = idSousCat[slugSousCat] ?? null;
    if (!sousCategorieId) throw new Error(`Sous-catégorie inconnue : ${slugSousCat} (${p.nom})`);

    const remise = REMISE_PAR_CATEGORIE[p.categorie];
    if (remise === undefined) throw new Error(`Catégorie de remise inconnue : ${p.categorie} (${p.nom})`);
    const prixAchat = Math.round(p.prix * (1 - remise));

    console.log(`… photo : ${p.nom}`);
    const photoUrl = await uploaderPhoto(p.photo);

    const payload = {
      nom: p.nom,
      categorie_id: categorie.id,
      sous_categorie_id: sousCategorieId,
      prix: p.prix,
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
      processeur: p.processeur ?? null,
      ram_go: p.ramGo ?? null,
      stockage_go: p.stockageGo ?? null,
      type_stockage: p.typeStockage ?? null,
      taille_ecran: p.tailleEcran ?? null,
      ecran_tactile: p.ecranTactile ?? null,
      etat: p.etat ?? null,
      garantie_mois: p.garantieMois ?? null,
      marque: p.marque ?? null,
      prix_a_verifier: p.prixAVerifier ?? false,
      prix_achat_previsionnel: p.prixAchatPrevisionnel ?? false,
    };

    const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
    if (error || !inserted) throw new Error(`Insertion échouée (${p.nom}) : ${error?.message}`);
    console.log(`✓ créé #${inserted.id} (réf ${p.ref}) : ${p.nom} — achat ${prixAchat}, vente ${p.prix}`);
    crees++;
  }

  console.log(`\n${crees} produits créés, ${ignores} déjà présents (ignorés).`);
  console.log(`Tous en statut_publication = 'en_attente' (masqués) : à republier depuis /admin/produits après vérification.`);
  console.log(`\nAvant publication :`);
  console.log(`  - confirmer par écrit le ThinkPad X1 Carbon Gen 12 (réf 41) et le HP ProBook flou (réf 36) ;`);
  console.log(`  - publier d'abord les accessoires et les machines 100 000-250 000 FCFA (§7 du document).`);
  console.log(`  - iPad : non importé, faute de prix confirmé (décision 2026-09-15). À ajouter quand le fournisseur donne le tarif (catégorie de remise : MacBook et iMac, 20 %).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
