// PROMPT_FINAL_CATALOGUE_KITS.md — Lot 6 : produits de integration_produits.xlsx
// (44 lignes : créations, mises à jour photo/prix, Kaladi Business Company).
// La ligne E01 (sac Eastpak) est traitée à part dans lot5-sacs-eastpak.mjs —
// ignorée ici.
//
// Dry-run par défaut ; --apply pour écrire. Sauvegarde les produits mis à
// jour avant toute écriture. Images envoyées telles quelles (déjà optimisées
// par le fondateur), sans recompression.
//
// Usage : node scripts/lot6-integration-produits.mjs [--apply]
import { readFileSync, writeFileSync, readFileSync as readFileSyncBin } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import xlsx from "xlsx";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const IMAGES_DIR = "C:/Users/WORLD INFORMATIQUE/Downloads/extracted_46/sacado_catalogue_kits/images/";
const VENDEUR_LPD_ID = "bcb4028f-ddf4-4ac2-990a-e399bb7086db";
const VENDEUR_PAPEX_ID = "ab82c306-5519-4664-b66b-c9e6cdbffb8d";
const VENDEUR_SACADO_ID = "00000000-0000-0000-0000-000000000001";

const CATEGORIE_IDS = {
  "Mobilier": 10,
  "Cartables & sacs": 5,
  "Cahiers & papeterie": 2,
  "Livres et annales": 6,
  "Art & dessin": 9,
  "Hygiène & cantine": 13,
};
const SOUS_CATEGORIE_IDS = {
  "Tables et bureaux": 127,
  "Sacs à dos": 27,
  "Cahiers spéciaux": 110,
  "Cahiers de travaux pratiques": 4,
  "Cahiers 140 pages": 108,
  "Cahiers 100 pages": 1,
  "Cahiers 200 pages": 3,
  "Blocs-notes et post-it": 107,
  "Élémentaire": 117,
  "Dictionnaires": 116,
  "Œuvres littéraires": 118,
  "Peinture & gouache": 54,
  "Coloriage": 58,
  "Boîtes à goûter": 78,
  // "Chaises de bureau" : créée au besoin, voir assurerChaisesDeBureau().
};

// Descriptions courtes et factuelles écrites à partir de chaque photo
// (PROMPT_FINAL_CATALOGUE_KITS.md lot 6, bullet "Créer").
const DESCRIPTIONS = {
  N01: "Chaise de bureau ergonomique DC156 : dossier maille respirante, appui-tête et soutien lombaire réglables, vérin à gaz, rotation à 360°, hauteur d'assise réglable de 110,5 à 120,5 cm, base à roulettes 61 × 59 cm.",
  N02: "Bureau rectangulaire finition bois bicolore (brun/beige), avec caisson latéral intégré (un tiroir à clé et une porte de rangement) et passe-câble rond.",
  N03: "Chaise de formation pliante avec dossier filet respirant, assise rembourrée et tablette écritoire rabattable intégrée. Hauteur 85 cm, piètement métallique pliant.",
  N05: "Cahier Prestige grand format, couverture rigide illustrée, 288 pages 70 g, réglure Futura (seyès).",
  P01: "Cahier de travaux pratiques Calligraphe, 96 pages 90 g/m², couverture polypro, réglure mixte lignes et quadrillage.",
  P03: "Cahier Calligraphe 140 pages, 70 g/m², couverture polypro couleur unie, étiquette Nom/Matière/Classe/Année.",
  P07: "Lot de 10 cahiers petit format 100 pages, couvertures illustrées colorées variées, étiquette Nom/Classe/Matière.",
  P08: "Lot de 5 cahiers petit format 200 pages, couverture plastifiée couleur unie.",
  P09: "Carnet à couverture pailletée brillante, motif cheval.",
  P10: "Nouveau syllabaire de Mamadou et Bineta, A. Davesne, éditions EDICEF, à l'usage des écoles africaines.",
  P11: "J'apprends vite à lire, F. Macaire et F. André, collection Les Classiques africains.",
  P12: "Le Nouveau Bescherelle 1 : L'art de conjuguer, dictionnaire de 12 000 verbes.",
  P13: "La tragédie du roi Christophe, Aimé Césaire, théâtre, éditions Présence Africaine.",
  P14: "Palette aquarelle Bertand Water Color, 16 couleurs lavables en pastilles solides, livrée avec palette et pinceau.",
  P15: "Crayons de cire BIC Kids Plastidecor, 12 couleurs, formule mains propres, dès 2 ans.",
  P16: "Feutres Colour Pens, 12 couleurs, pointe fine, blister cartonné.",
  P17: "Boîte de 6 crayons de couleur format mini, motif fillette.",
  P18: "Boîte à goûter compartimentée avec gourde isotherme assortie, fermeture à clips.",
  S01: "Sac à dos toile unie, rabat à pressions, poche frontale zippée.",
  S02: "Sac à dos bicolore rose et lilas, multi-poches, poches latérales filet, dos renforcé.",
  S03: "Sac à dos tricolore beige/marron/bleu marine, rabat à clips, breloque décorative.",
  S04: "Sac à dos « Copybara » quadrillé, motif capybara brodé, livré avec petite pochette assortie.",
  S05: "Cartable rigide Hello Kitty, motif matelassé gaufré, bandes réfléchissantes, base renforcée.",
  S06: "Sac à dos toile unie, écusson brodé, multi-poches, poches latérales.",
  S07: "Sac à dos tricolore bleu/orange/bleu ciel, rabat à clips, breloque décorative.",
  S08: "Sac à dos façon cuir noir, rabat à boucles, zip et clous dorés.",
  S09: "Sac à dos Barbie, motif cygnes et plumes, bande réfléchissante latérale.",
  S10: "Sac à dos bicolore noir et rouge style sport, multi-poches zippées, bandes réfléchissantes.",
  S11: "Sac à dos façon cuir marron cognac style vintage, rabat à boucles métalliques, poche porte-ordinateur arrière.",
  S12: "Sac à dos bleu clair, motif nuages/fleurs sur rabat et base, sangle à boucle avant.",
};

// Variantes à créer (attribut 1 = Couleur, attribut 12 = Modèle), un prix
// par image quand indiqué dans la colonne Variantes du fichier.
const VARIANTES = {
  N05: { attributId: 12, options: [{ valeur: "Bleu « Keep in Touch »", imageIndex: 0 }, { valeur: "Rouge et bleu « Keep Touch »", imageIndex: 1 }] },
  P03: { attributId: 1, options: [{ valeur: "Turquoise", imageIndex: 0 }, { valeur: "Jaune", imageIndex: 1 }, { valeur: "Bleu", imageIndex: 1 }, { valeur: "Rouge", imageIndex: 1 }] },
  P09: { attributId: 1, options: [{ valeur: "Violet", imageIndex: 0 }, { valeur: "Bleu", imageIndex: 1 }] },
  P14: { attributId: 12, options: [{ valeur: "Flamant rose", imageIndex: 0 }, { valeur: "Paon", imageIndex: 1 }, { valeur: "Papillon", imageIndex: 2 }] },
  S04: { attributId: 1, options: [{ valeur: "Rose", imageIndex: 0 }, { valeur: "Marron", imageIndex: 1 }] },
};

const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const rapport = [];
const log = (s) => {
  console.log(s);
  rapport.push(s);
};

function sniffWebp(buf) {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  );
}

const cacheUploads = new Map();
async function uploaderImageLocale(nomFichier, dossier) {
  if (cacheUploads.has(nomFichier)) return cacheUploads.get(nomFichier);
  const buf = readFileSyncBin(IMAGES_DIR + nomFichier);
  if (!sniffWebp(buf)) throw new Error(`Pas un WebP reconnu : ${nomFichier}`);
  const chemin = `${dossier}/${nomFichier.replace(/\.webp$/, "")}-${randomUUID()}.webp`;
  const { error } = await sb.storage.from("produits").upload(chemin, buf, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${nomFichier}) : ${error.message}`);
  const { data } = sb.storage.from("produits").getPublicUrl(chemin);
  cacheUploads.set(nomFichier, data.publicUrl);
  return data.publicUrl;
}

async function assurerChaisesDeBureau() {
  const { data: existant } = await sb.from("sous_categories").select("id").eq("categorie_id", 10).ilike("nom", "Chaises de bureau").maybeSingle();
  if (existant) return existant.id;
  if (!APPLY) return -1; // id factice en dry-run
  const { data: maxOrdreRows } = await sb.from("sous_categories").select("ordre").eq("categorie_id", 10).order("ordre", { ascending: false }).limit(1);
  const { data, error } = await sb
    .from("sous_categories")
    .insert({ nom: "Chaises de bureau", categorie_id: 10, slug: "chaises-de-bureau", ordre: (maxOrdreRows?.[0]?.ordre ?? 0) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(`Création sous-catégorie Chaises de bureau échouée : ${error.message}`);
  log(`✓ sous-catégorie créée : Chaises de bureau (#${data.id})`);
  return data.id;
}

async function assurerVendeurKaladi() {
  const { data: existant } = await sb.from("vendeurs").select("id").ilike("nom_boutique", "Kaladi Business Company").maybeSingle();
  if (existant) return existant.id;
  if (!APPLY) return "dry-run-kaladi";
  const { data, error } = await sb.from("vendeurs").insert({ nom_boutique: "Kaladi Business Company", user_id: null, actif: true }).select("id").single();
  if (error) throw new Error(`Création fournisseur Kaladi échouée : ${error.message}`);
  log(`✓ fournisseur créé : Kaladi Business Company (#${data.id})`);
  return data.id;
}

function resoudreFournisseur(nomFournisseur, kaladiId, flags) {
  if (nomFournisseur === "LPD") return VENDEUR_LPD_ID;
  if (nomFournisseur === "Papex") return VENDEUR_PAPEX_ID;
  if (nomFournisseur === "Kaladi Business Company") return kaladiId;
  if (!nomFournisseur) {
    flags.push("fournisseur non renseigné → SacAdo");
    return VENDEUR_SACADO_ID;
  }
  flags.push(`fournisseur inconnu "${nomFournisseur}" → SacAdo`);
  return VENDEUR_SACADO_ID;
}

async function main() {
  const wb = xlsx.readFile("C:/Users/WORLD INFORMATIQUE/Downloads/extracted_46/sacado_catalogue_kits/integration_produits.xlsx");
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }).slice(1);

  log(`# Rapport Lot 6 — integration_produits.xlsx (${APPLY ? "APPLIQUÉ" : "DRY-RUN"}) — ${horodatage}\n`);

  const aCreer = rows.filter((r) => r[1] === "Créer");
  const aMettreAJour = rows.filter((r) => String(r[1]).startsWith("Mettre à jour"));
  const eastpak = rows.filter((r) => String(r[1]).startsWith("Photo pour"));
  log(`${aCreer.length} à créer, ${aMettreAJour.length} à mettre à jour, ${eastpak.length} ligne(s) Eastpak ignorée(s) ici (traitées lot 5).\n`);

  if (APPLY) {
    const ids = aMettreAJour.map((r) => Number(String(r[1]).match(/produit (\d+)/)?.[1])).filter(Boolean);
    const { data: avant } = await sb.from("produits").select("*").in("id", ids);
    writeFileSync(`scripts/_backup_produits_lot6_${horodatage}.json`, JSON.stringify(avant, null, 1));
    log(`Sauvegarde : scripts/_backup_produits_lot6_${horodatage}.json (${avant.length} produits)\n`);
  }

  const chaisesDeBureauId = await assurerChaisesDeBureau();
  SOUS_CATEGORIE_IDS["Chaises de bureau"] = chaisesDeBureauId;
  const kaladiId = await assurerVendeurKaladi();

  // --------------------------------------------------------------------------
  // Créations
  // --------------------------------------------------------------------------
  log("## Créations\n");
  for (const r of aCreer) {
    const [code, , nom, fournisseurTexte, categorieTexte, sousCategorieTexte, prixAchat, prixVente, , imagesTexte] = r;
    const flags = [];
    const fournisseurId = resoudreFournisseur(fournisseurTexte, kaladiId, flags);
    const categorieId = CATEGORIE_IDS[categorieTexte];
    const sousCategorieId = SOUS_CATEGORIE_IDS[sousCategorieTexte];
    if (!categorieId || sousCategorieId === undefined) {
      log(`  ERREUR ${code} (${nom}) : catégorie/sous-catégorie inconnue "${categorieTexte}" / "${sousCategorieTexte}".`);
      continue;
    }
    const images = String(imagesTexte).split(",").map((s) => s.trim()).filter(Boolean);
    log(`- ${code} ${nom} — ${categorieTexte} > ${sousCategorieTexte} — achat ${prixAchat || "—"} / vente ${prixVente} — ${images.length} image(s)${flags.length ? " — ⚠ " + flags.join(", ") : ""}`);

    if (!APPLY) continue;

    const urls = [];
    for (const img of images) urls.push(await uploaderImageLocale(img, "nouveaux-produits-lot6"));

    const { data: produitCree, error } = await sb
      .from("produits")
      .insert({
        nom,
        categorie_id: categorieId,
        sous_categorie_id: sousCategorieId,
        prix: prixVente,
        prix_achat: prixAchat || null,
        prix_achat_previsionnel: false,
        delai: "6j",
        stock: 0,
        statut: "dispo",
        statut_publication: "publie",
        publie_par: "admin",
        vendeur_id: fournisseurId,
        gamme: "essentiel",
        unite_vente: "unite",
        description: DESCRIPTIONS[code] ?? null,
        photo: urls[0] ?? null,
        photos: urls,
      })
      .select("id")
      .single();
    if (error) {
      log(`  ERREUR création ${code} : ${error.message}`);
      continue;
    }
    log(`  ✓ créé #${produitCree.id}`);

    const variantesSpec = VARIANTES[code];
    if (variantesSpec) {
      for (const opt of variantesSpec.options) {
        const { data: variante, error: errVariante } = await sb
          .from("produit_variantes")
          .insert({ produit_id: produitCree.id, prix: null, stock: 0, statut: "dispo", photo: urls[opt.imageIndex] ?? null })
          .select("id")
          .single();
        if (errVariante) {
          log(`    ERREUR variante "${opt.valeur}" : ${errVariante.message}`);
          continue;
        }
        const { error: errAttr } = await sb
          .from("variante_attributs")
          .insert({ variante_id: variante.id, attribut_id: variantesSpec.attributId, valeur: opt.valeur });
        if (errAttr) log(`    ERREUR attribut variante "${opt.valeur}" : ${errAttr.message}`);
      }
      log(`  ✓ ${variantesSpec.options.length} variante(s) créée(s)`);
    }
  }
  log("");

  // --------------------------------------------------------------------------
  // Mises à jour (photo, et prix+fournisseur+nom si fournis)
  // --------------------------------------------------------------------------
  log("## Mises à jour\n");
  for (const r of aMettreAJour) {
    const [code, action, nom, fournisseurTexte, , , prixAchat, prixVente, variantesTexte, imagesTexte, remarque] = r;
    const id = Number(String(action).match(/produit (\d+)/)?.[1]);
    const photoSeulement = /photo seulement/i.test(action);
    const images = String(imagesTexte).split(",").map((s) => s.trim()).filter(Boolean);

    const { data: produitActuel } = await sb.from("produits").select("id, nom").eq("id", id).maybeSingle();
    if (!produitActuel) {
      log(`  ERREUR ${code} : produit #${id} introuvable.`);
      continue;
    }

    const extra = photoSeulement ? "" : ` — achat ${prixAchat} / vente ${prixVente} / fournisseur ${fournisseurTexte} / nom "${nom}"`;
    const noteVariante = variantesTexte && images.length > 1 ? ` — ⚠ ${images.length} images/variantes fournies, produit non converti en variantes (mise à jour simple) : les ${images.length} photos sont ajoutées à la galerie.` : "";
    log(`- ${code} produit #${id} (actuellement "${produitActuel.nom}") : ${images.length} photo(s)${extra}${noteVariante}${remarque ? " — " + remarque : ""}`);

    if (!APPLY) continue;

    const urls = [];
    for (const img of images) urls.push(await uploaderImageLocale(img, "maj-produits-lot6"));

    const update = { photo: urls[0] ?? null, photos: urls };
    if (!photoSeulement) {
      update.nom = nom;
      update.prix = prixVente;
      update.prix_achat = prixAchat;
      update.prix_achat_previsionnel = false;
      update.vendeur_id = resoudreFournisseur(fournisseurTexte, kaladiId, []);
    }
    const { error } = await sb.from("produits").update(update).eq("id", id);
    if (error) log(`  ERREUR maj #${id} : ${error.message}`);
    else log(`  ✓ mis à jour`);
  }
  log("");

  writeFileSync(`rapport-lot6-integration-produits-${horodatage}.md`, rapport.join("\n"));
  console.log(`\nRapport écrit : rapport-lot6-integration-produits-${horodatage}.md`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
