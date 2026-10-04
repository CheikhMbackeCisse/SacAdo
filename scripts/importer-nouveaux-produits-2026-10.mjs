// Import du lot "nouveaux_produits" (Karbi, MedWorld, Seye Dynamique
// Technologie) + classement secondaire du matériel géométrique.
// Usage : node scripts/importer-nouveaux-produits-2026-10.mjs [--dry-run]
// Prérequis : migration 0111 déjà exécutée en base. Lit .env.local. Idempotent
// par nom de produit (relancer après une coupure réessaie seulement ce qui manque).
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const IMAGES_DIR = path.join(
  "C:/Users/WORLDI~1/AppData/Local/Temp/claude/C--Users-WORLD-INFORMATIQUE-Downloads-SacAdo/0a795f73-f929-44b1-80da-31e8a1e5c4e4/scratchpad",
  "np_extract/nouveaux_produits/images",
);

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

// Copie minimale de lib/images/sniff.ts (AUDIT_SECURITE_3 F1), comme les
// scripts d'import précédents (importer-seye-dynamique.mjs).
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

const cacheUrls = new Map();
// Images déjà au format carré 1000px webp optimisé (fournies telles quelles,
// comme pour le lot papiers) : pas de retraitement sharp, upload direct.
async function uploaderPhoto(filename) {
  if (cacheUrls.has(filename)) return cacheUrls.get(filename);
  const buf = await readFile(path.join(IMAGES_DIR, filename));
  if (!snifferImage(buf.subarray(0, 12))) throw new Error(`Fichier non reconnu comme image : ${filename}`);
  if (DRY_RUN) {
    const url = `[dry-run] ${filename}`;
    cacheUrls.set(filename, url);
    return url;
  }
  const chemin = `import-nouveaux-produits-2026-10/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, buf, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${filename}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  cacheUrls.set(filename, data.publicUrl);
  return data.publicUrl;
}

async function trouverOuCreerVendeur(nom, telephone = null) {
  const { data: existant } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", nom)
    .maybeSingle();
  if (existant) return existant.id;
  if (DRY_RUN) {
    console.log(`[dry-run] créerait le vendeur : ${nom}`);
    return `dry-run-${nom}`;
  }
  const { data: cree, error } = await supabase
    .from("vendeurs")
    .insert({ nom_boutique: nom, user_id: null, contact_telephone: telephone, actif: true })
    .select("id")
    .single();
  if (error || !cree) throw new Error(`Création du vendeur échouée (${nom}) : ${error?.message}`);
  console.log(`✓ vendeur créé : ${nom} (#${cree.id})`);
  return cree.id;
}

async function idSousCategorie(categorieSlug, sousCategorieSlug) {
  const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorieSlug).single();
  if (!cat) throw new Error(`Catégorie introuvable : ${categorieSlug}`);
  const { data: sc } = await supabase
    .from("sous_categories")
    .select("id")
    .eq("categorie_id", cat.id)
    .eq("slug", sousCategorieSlug)
    .single();
  if (!sc) throw new Error(`Sous-catégorie introuvable : ${categorieSlug}/${sousCategorieSlug}`);
  return { categorieId: cat.id, sousCategorieId: sc.id };
}

async function creerProduitSimple(p) {
  const { data: existant } = await supabase.from("produits").select("id").eq("nom", p.nom).maybeSingle();
  if (existant) {
    console.log(`= déjà présent, ignoré : ${p.nom} (#${existant.id})`);
    return existant.id;
  }
  const photos = await Promise.all(p.images.map(uploaderPhoto));
  const payload = {
    nom: p.nom,
    description: p.description,
    categorie_id: p.categorieId,
    sous_categorie_id: p.sousCategorieId,
    prix: p.prixVente,
    prix_achat: p.prixAchat,
    delai: "6j",
    photo: photos[0] ?? null,
    photos,
    stock: 1,
    seuil_alerte: 1,
    statut: "dispo",
    vendeur_id: p.vendeurId,
    publie_par: "admin",
    statut_publication: "en_attente",
    guide_tailles: p.guideTailles ?? false,
  };
  if (DRY_RUN) {
    console.log(`[dry-run] créerait : ${p.nom} — achat ${p.prixAchat}, vente ${p.prixVente}, ${photos.length} photo(s)`);
    return null;
  }
  const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
  if (error || !inserted) throw new Error(`Insertion échouée (${p.nom}) : ${error?.message}`);
  console.log(`✓ créé #${inserted.id} : ${p.nom} — achat ${p.prixAchat}, vente ${p.prixVente}`);
  return inserted.id;
}

// ---------------------------------------------------------------------------
// Karbi — 10 sacs à dos, aucune variante, images 1..4 dans l'ordre.
// ---------------------------------------------------------------------------
const NOMS_KARBI = [
  "graffiti-noir", "marin-bleu", "etoiles-bleu", "noir-fleuri", "bleu-marine-uni",
  "fleurs-roses", "noir-uni", "planetes", "couleurs-noir", "noir-planetes",
];
const LIBELLES_KARBI = {
  "graffiti-noir": "Graffiti noir",
  "marin-bleu": "Marin bleu",
  "etoiles-bleu": "Étoiles bleu",
  "noir-fleuri": "Noir fleuri",
  "bleu-marine-uni": "Bleu marine uni",
  "fleurs-roses": "Fleurs roses",
  "noir-uni": "Noir uni",
  planetes: "Planètes",
  "couleurs-noir": "Couleurs sur noir",
  "noir-planetes": "Noir et planètes",
};
const DESCRIPTION_KARBI =
  "Sac à dos scolaire 43 × 33 cm. Grand compartiment avec rangements intérieurs pour cahiers, trousse et téléphone, poche avant zippée, poche latérale, bretelles réglables.";

async function importerKarbi() {
  // "Karbi" est le vendeur (fournisseur) ; la marque des sacs eux-mêmes est
  // "Forever Cultivate" — c'est elle qui doit apparaître dans le nom produit.
  const vendeurId = await trouverOuCreerVendeur("Karbi");
  const { categorieId, sousCategorieId } = await idSousCategorie("cartables-sacs", "sacs-a-dos");
  for (const slug of NOMS_KARBI) {
    await creerProduitSimple({
      nom: `Sac à dos Forever Cultivate · ${LIBELLES_KARBI[slug]}`,
      description: DESCRIPTION_KARBI,
      categorieId,
      sousCategorieId,
      prixAchat: 10500,
      prixVente: 13000,
      vendeurId,
      images: [1, 2, 3, 4].map((n) => `prod-sac-karbi-${slug}-${n}.webp`),
    });
  }
}

// ---------------------------------------------------------------------------
// Seye Dynamique Technologie — table de lit (variantes couleur), refroidisseur
// simple, mise à jour du produit #91, sacoche, iPad.
// ---------------------------------------------------------------------------
async function importerSeye() {
  const { data: vendeur } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", "Seye Dynamique Technologie")
    .single();
  if (!vendeur) throw new Error("Vendeur 'Seye Dynamique Technologie' introuvable (devrait déjà exister).");
  const vendeurId = vendeur.id;
  const { categorieId, sousCategorieId: accessoiresId } = await idSousCategorie("ordinateurs", "accessoires-info");
  const { sousCategorieId: tablettesId } = await idSousCategorie("ordinateurs", "tablettes");

  // -- Table de lit pliable (6 couleurs, 1 photo représentative chacune) --
  const nomTable = "Table de lit pliable pour ordinateur portable";
  const { data: tableExistante } = await supabase.from("produits").select("id").eq("nom", nomTable).maybeSingle();
  let tableId = tableExistante?.id ?? null;
  const imagesTable = [1, 2, 3, 4, 5, 6, 7].map((n) => `prod-table-de-lit-pliable-${n}.webp`);
  if (!tableId) {
    const photos = await Promise.all(imagesTable.map(uploaderPhoto));
    const payload = {
      nom: nomTable,
      description:
        "Petite table pliante pour travailler au lit, sur le canapé ou au sol. Encoche pour tablette ou téléphone, pieds pliables avec embouts antidérapants. Se range à plat.",
      categorie_id: categorieId,
      sous_categorie_id: accessoiresId,
      prix: 5000,
      prix_achat: 3750,
      delai: "6j",
      photo: photos[0],
      photos,
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      vendeur_id: vendeurId,
      publie_par: "admin",
      statut_publication: "en_attente",
    };
    if (DRY_RUN) {
      console.log(`[dry-run] créerait : ${nomTable}`);
    } else {
      const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
      if (error || !inserted) throw new Error(`Insertion échouée (${nomTable}) : ${error?.message}`);
      tableId = inserted.id;
      console.log(`✓ créé #${tableId} : ${nomTable}`);
    }
  } else {
    console.log(`= déjà présent, ignoré : ${nomTable} (#${tableId})`);
  }

  if (tableId && !DRY_RUN) {
    const { data: varExistantes } = await supabase.from("produit_variantes").select("id").eq("produit_id", tableId);
    if ((varExistantes ?? []).length === 0) {
      const { data: attrCouleur } = await supabase.from("attributs").select("id").ilike("nom", "Couleur").single();
      const COULEURS = [
        { valeur: "Bois naturel", image: "prod-table-de-lit-pliable-1.webp" },
        { valeur: "Bois clair", image: "prod-table-de-lit-pliable-3.webp" },
        { valeur: "Bleu", image: "prod-table-de-lit-pliable-4.webp" },
        { valeur: "Rose", image: "prod-table-de-lit-pliable-5.webp" },
        { valeur: "Vert", image: "prod-table-de-lit-pliable-6.webp" },
        { valeur: "Noir", image: "prod-table-de-lit-pliable-7.webp" },
      ];
      for (const c of COULEURS) {
        const photo = await uploaderPhoto(c.image);
        const { data: variante, error: errVar } = await supabase
          .from("produit_variantes")
          .insert({ produit_id: tableId, stock: 1, statut: "dispo", photo })
          .select("id")
          .single();
        if (errVar || !variante) throw new Error(`Variante échouée (${nomTable}, ${c.valeur}) : ${errVar?.message}`);
        const { error: errAttr } = await supabase
          .from("variante_attributs")
          .insert({ variante_id: variante.id, attribut_id: attrCouleur.id, valeur: c.valeur });
        if (errAttr) throw new Error(`Attribut de variante échoué (${nomTable}, ${c.valeur}) : ${errAttr.message}`);
      }
      console.log(`  ✓ ${COULEURS.length} variantes couleur créées pour ${nomTable}`);
    } else {
      console.log(`  = variantes déjà présentes pour ${nomTable}, ignorées.`);
    }
  } else if (DRY_RUN) {
    console.log(`[dry-run] créerait 6 variantes couleur pour ${nomTable}`);
  }

  // -- Refroidisseur à ventilateur (simple) --
  await creerProduitSimple({
    nom: "Refroidisseur pour ordinateur portable avec ventilateur",
    description:
      "Support incliné réglable avec grand ventilateur intégré, pour garder l'ordinateur au frais et travailler à bonne hauteur.",
    categorieId,
    sousCategorieId: accessoiresId,
    prixAchat: 4500,
    prixVente: 5000,
    vendeurId,
    images: ["prod-refroidisseur-ventilateur-noir-1.webp"],
  });

  // -- Mise à jour du produit #91 existant (jamais de doublon) --
  const ID_SUPPORT_91 = 91;
  const { data: p91 } = await supabase.from("produits").select("id, nom").eq("id", ID_SUPPORT_91).maybeSingle();
  if (!p91) {
    console.warn(`! produit #${ID_SUPPORT_91} introuvable, mise à jour ignorée.`);
  } else if (DRY_RUN) {
    console.log(`[dry-run] mettrait à jour #${ID_SUPPORT_91} (${p91.nom}) : achat 17000, vente 19000, nouvelle photo.`);
  } else {
    const photo = await uploaderPhoto("prod-support-refroidisseur-argent-1.webp");
    const { error } = await supabase
      .from("produits")
      .update({ prix: 19000, prix_achat: 17000, photo, photos: [photo] })
      .eq("id", ID_SUPPORT_91);
    if (error) throw new Error(`Mise à jour #${ID_SUPPORT_91} échouée : ${error.message}`);
    console.log(`✓ mis à jour #${ID_SUPPORT_91} : ${p91.nom} — achat 17000, vente 19000, photo remplacée`);
  }

  // -- Sacoche pour ordinateur (renommée "15 pouces" par le lot papiers) --
  await creerProduitSimple({
    nom: "Sacoche pour ordinateur portable",
    description:
      "Sacoche gris chiné avec poignées, bandoulière amovible et réglable, compartiment principal zippé et poche avant zippée.",
    categorieId,
    sousCategorieId: accessoiresId,
    prixAchat: 5000,
    prixVente: 6000,
    vendeurId,
    images: ["prod-sacoche-ordinateur-1.webp"],
  });

  // -- iPad 10e génération --
  await creerProduitSimple({
    nom: "Apple iPad 10e génération, 10,9 pouces, 128 Go, Wi-Fi",
    description:
      "Tablette Apple iPad 10e génération, écran Liquid Retina 10,9 pouces, 128 Go de stockage, Wi-Fi, neuve sous emballage.",
    categorieId,
    sousCategorieId: tablettesId,
    prixAchat: 260000,
    prixVente: 270000,
    vendeurId,
    images: ["prod-ipad-10-1.webp"],
  });
}

// ---------------------------------------------------------------------------
// MedWorld — blouse de laboratoire : 3 modèles × 5 tailles, personnalisation
// payante (migration 0111).
// ---------------------------------------------------------------------------
const MODELES_BLOUSE = [
  { valeur: "Blanche col tailleur", image: "prod-blouse-laboratoire-1.webp" },
  { valeur: "Blanche liseré vert", image: "prod-blouse-laboratoire-2.webp" },
  { valeur: "Verte liseré blanc", image: "prod-blouse-laboratoire-3.webp" },
];
const TAILLES_BLOUSE = ["S", "M", "L", "XL", "XXL"];

async function importerMedworld() {
  const vendeurId = await trouverOuCreerVendeur("MedWorld");
  const { categorieId, sousCategorieId } = await idSousCategorie("fournitures-ecole", "blouses-laboratoire");

  const nom = "Blouse de laboratoire";
  const { data: existante } = await supabase.from("produits").select("id").eq("nom", nom).maybeSingle();
  let produitId = existante?.id ?? null;
  const images = MODELES_BLOUSE.map((m) => m.image);

  if (!produitId) {
    const photos = await Promise.all(images.map(uploaderPhoto));
    const payload = {
      nom,
      description:
        "Blouse pour les travaux pratiques, le laboratoire, la pharmacie et les études de santé. Tailles S à XXL. Personnalisation possible : nom et spécialité brodés sur la poche (+2 500 FCFA).",
      categorie_id: categorieId,
      sous_categorie_id: sousCategorieId,
      prix: 11000,
      prix_achat: 10000,
      delai: "6j",
      photo: photos[0],
      photos,
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      vendeur_id: vendeurId,
      publie_par: "admin",
      statut_publication: "en_attente",
      guide_tailles: true,
      personnalisable: true,
      prix_personnalisation: 2500,
      achat_personnalisation: 2000,
    };
    if (DRY_RUN) {
      console.log(`[dry-run] créerait : ${nom} (personnalisable, +2500 FCFA, achat option 2000)`);
    } else {
      const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
      if (error || !inserted) throw new Error(`Insertion échouée (${nom}) : ${error?.message}`);
      produitId = inserted.id;
      console.log(`✓ créé #${produitId} : ${nom}`);
    }
  } else {
    console.log(`= déjà présent, ignoré : ${nom} (#${produitId})`);
  }

  if (produitId && !DRY_RUN) {
    const { data: varExistantes } = await supabase.from("produit_variantes").select("id").eq("produit_id", produitId);
    if ((varExistantes ?? []).length === 0) {
      const { data: attrs } = await supabase.from("attributs").select("id, nom").in("nom", ["Modèle", "Taille"]);
      const idAttr = Object.fromEntries((attrs ?? []).map((a) => [a.nom, a.id]));
      if (!idAttr["Modèle"] || !idAttr["Taille"]) throw new Error("Attributs 'Modèle' / 'Taille' introuvables.");

      let creees = 0;
      for (const modele of MODELES_BLOUSE) {
        const photo = await uploaderPhoto(modele.image);
        for (const taille of TAILLES_BLOUSE) {
          const { data: variante, error: errVar } = await supabase
            .from("produit_variantes")
            .insert({ produit_id: produitId, stock: 1, statut: "dispo", photo })
            .select("id")
            .single();
          if (errVar || !variante) {
            throw new Error(`Variante échouée (${nom}, ${modele.valeur}/${taille}) : ${errVar?.message}`);
          }
          const { error: errAttr } = await supabase.from("variante_attributs").insert([
            { variante_id: variante.id, attribut_id: idAttr["Modèle"], valeur: modele.valeur },
            { variante_id: variante.id, attribut_id: idAttr["Taille"], valeur: taille },
          ]);
          if (errAttr) throw new Error(`Attributs de variante échoués (${nom}) : ${errAttr.message}`);
          creees++;
        }
      }
      console.log(`  ✓ ${creees} variantes (modèle × taille) créées pour ${nom}`);
    } else {
      console.log(`  = variantes déjà présentes pour ${nom}, ignorées.`);
    }
  } else if (DRY_RUN) {
    console.log(`[dry-run] créerait ${MODELES_BLOUSE.length * TAILLES_BLOUSE.length} variantes (modèle × taille) pour ${nom}`);
  }
}

// ---------------------------------------------------------------------------
// Classement secondaire « Matériel géométrique » (migration 0111) : les
// produits de géométrie restent classés "Fournitures d'école" (inchangé) et
// deviennent AUSSI visibles dans "Matériel géométrique", sans doublon.
// ---------------------------------------------------------------------------
const CLASSEMENTS_GEOMETRIE = [
  { id: 12, sousCategorie: "compas" }, { id: 1205, sousCategorie: "compas" },
  { id: 1600, sousCategorie: "compas" }, { id: 1611, sousCategorie: "compas" },
  { id: 1226, sousCategorie: "kits-tracage" }, { id: 1229, sousCategorie: "kits-tracage" },
  { id: 1234, sousCategorie: "kits-tracage" }, { id: 1242, sousCategorie: "kits-tracage" },
  { id: 1260, sousCategorie: "kits-tracage" }, { id: 1264, sousCategorie: "kits-tracage" },
  { id: 1290, sousCategorie: "kits-tracage" }, { id: 1291, sousCategorie: "kits-tracage" },
  { id: 1578, sousCategorie: "kits-tracage" }, { id: 1585, sousCategorie: "kits-tracage" },
  { id: 1595, sousCategorie: "kits-tracage" },
  { id: 14, sousCategorie: "rapporteurs" }, { id: 1272, sousCategorie: "rapporteurs" },
  { id: 15, sousCategorie: "regles" }, { id: 1183, sousCategorie: "regles" }, { id: 1240, sousCategorie: "regles" },
  { id: 13, sousCategorie: "equerres" },
];

async function classerGeometrie() {
  const { data: cat } = await supabase.from("categories").select("id").eq("slug", "geometrie").single();
  if (!cat) throw new Error("Catégorie 'geometrie' (Matériel géométrique) introuvable.");
  const { data: subs } = await supabase.from("sous_categories").select("id, slug").eq("categorie_id", cat.id);
  const idSous = Object.fromEntries((subs ?? []).map((s) => [s.slug, s.id]));

  let ajoutes = 0;
  let ignores = 0;
  let manquants = 0;
  for (const c of CLASSEMENTS_GEOMETRIE) {
    const sousCategorieId = idSous[c.sousCategorie];
    if (!sousCategorieId) throw new Error(`Sous-catégorie geometrie introuvable : ${c.sousCategorie}`);

    const { data: produit } = await supabase.from("produits").select("id, nom").eq("id", c.id).maybeSingle();
    if (!produit) {
      console.warn(`! produit #${c.id} introuvable, classement secondaire ignoré.`);
      manquants++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] classerait #${c.id} (${produit.nom}) aussi dans geometrie/${c.sousCategorie}`);
      continue;
    }
    const { data: existant } = await supabase
      .from("produit_classements_secondaires")
      .select("id")
      .eq("produit_id", c.id)
      .eq("categorie_id", cat.id)
      .eq("sous_categorie_id", sousCategorieId)
      .maybeSingle();
    if (existant) {
      ignores++;
      continue;
    }
    const { error } = await supabase
      .from("produit_classements_secondaires")
      .insert({ produit_id: c.id, categorie_id: cat.id, sous_categorie_id: sousCategorieId });
    if (error) throw new Error(`Classement secondaire échoué (#${c.id}) : ${error.message}`);
    ajoutes++;
  }
  console.log(`\nClassement géométrie : ${ajoutes} ajoutés, ${ignores} déjà présents, ${manquants} produits introuvables.`);
}

async function main() {
  if (DRY_RUN) console.log("=== DRY RUN — aucune écriture en base ===\n");
  console.log("--- Karbi (10 sacs à dos) ---");
  await importerKarbi();
  console.log("\n--- Seye Dynamique Technologie ---");
  await importerSeye();
  console.log("\n--- MedWorld (blouse de laboratoire) ---");
  await importerMedworld();
  console.log("\n--- Classement secondaire Matériel géométrique ---");
  await classerGeometrie();
  console.log("\nTerminé. Tous les nouveaux produits sont en statut_publication='en_attente' (masqués) :");
  console.log("à vérifier (photos, prix, l'image 4 des sacs Karbi) puis republier depuis /admin/produits.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
