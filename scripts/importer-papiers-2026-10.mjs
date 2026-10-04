// Import du lot "papiers" (PROMPT_PAPIERS.md) : ramettes, papier couleur,
// papier millimétré, + renommage de la sacoche "15 pouces".
// Usage : node scripts/importer-papiers-2026-10.mjs [--dry-run]
// Prérequis : migration 0111 exécutée ET scripts/importer-nouveaux-produits-
// 2026-10.mjs déjà passé (crée la sacoche que ce script renomme). Idempotent.
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const IMAGES_DIR = path.join(
  "C:/Users/WORLDI~1/AppData/Local/Temp/claude/C--Users-WORLD-INFORMATIQUE-Downloads-SacAdo/0a795f73-f929-44b1-80da-31e8a1e5c4e4/scratchpad",
  "pap_extract/papiers/images",
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
  const buf = await readFile(path.join(IMAGES_DIR, filename));
  if (!snifferImage(buf.subarray(0, 12))) throw new Error(`Fichier non reconnu comme image : ${filename}`);
  if (DRY_RUN) return `[dry-run] ${filename}`;
  const chemin = `import-papiers-2026-10/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, buf, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${filename}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

async function idCategorie(slug) {
  const { data } = await supabase.from("categories").select("id").eq("slug", slug).single();
  if (!data) throw new Error(`Catégorie introuvable : ${slug}`);
  return data.id;
}

async function idSousCategorie(categorieId, slug) {
  const { data } = await supabase
    .from("sous_categories")
    .select("id")
    .eq("categorie_id", categorieId)
    .eq("slug", slug)
    .single();
  if (!data) throw new Error(`Sous-catégorie introuvable (catégorie ${categorieId}) : ${slug}`);
  return data.id;
}

async function ajouterClassementSecondaire(produitId, categorieId, sousCategorieId) {
  if (DRY_RUN) {
    console.log(`  [dry-run] classerait aussi #${produitId} dans catégorie ${categorieId}${sousCategorieId ? `/${sousCategorieId}` : ""}`);
    return;
  }
  const { data: existant } = await supabase
    .from("produit_classements_secondaires")
    .select("id")
    .eq("produit_id", produitId)
    .eq("categorie_id", categorieId)
    .eq("sous_categorie_id", sousCategorieId ?? null)
    .maybeSingle();
  if (existant) return;
  const { error } = await supabase
    .from("produit_classements_secondaires")
    .insert({ produit_id: produitId, categorie_id: categorieId, sous_categorie_id: sousCategorieId ?? null });
  if (error) throw new Error(`Classement secondaire échoué (#${produitId}) : ${error.message}`);
}

async function main() {
  if (DRY_RUN) console.log("=== DRY RUN — aucune écriture en base ===\n");

  const idImprimerie = await idCategorie("impression-consommables");
  const idPapierRamettesImprimerie = await idSousCategorie(idImprimerie, "papier-ramettes");
  const idCahiersPapeterie = await idCategorie("cahiers-papeterie");
  const idPapierRamettesCahiers = await idSousCategorie(idCahiersPapeterie, "papier-ramettes");
  const idCopiesFeuilles = await idSousCategorie(idCahiersPapeterie, "copies-et-feuilles");
  const idGeometrie = await idCategorie("geometrie");

  const { data: vendeurSacAdo } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", "SacAdo")
    .maybeSingle();
  if (!vendeurSacAdo && !DRY_RUN) {
    throw new Error("Vendeur 'SacAdo' introuvable — nécessaire pour les 3 nouveaux produits papier.");
  }
  const vendeurId = vendeurSacAdo?.id ?? "dry-run-sacado";

  // --- 1. Ramette A4 Smart Copy : MISE À JOUR du produit existant #1280 ---
  // (jamais de doublon visible — voir PROMPT_PAPIERS.md §1).
  const ID_SMART_COPY = 1280;
  const { data: p1280 } = await supabase
    .from("produits")
    .select("id, nom, vendeur_id")
    .eq("id", ID_SMART_COPY)
    .maybeSingle();
  if (!p1280) {
    console.warn(`! produit #${ID_SMART_COPY} introuvable, mise à jour ignorée.`);
  } else if (DRY_RUN) {
    console.log(`[dry-run] mettrait à jour #${ID_SMART_COPY} (${p1280.nom}, fournisseur actuel conservé) :`);
    console.log(`  achat 3250, vente 3500, nouvelle photo/nom/description, unite_vente "ramette"`);
    await ajouterClassementSecondaire(ID_SMART_COPY, idCahiersPapeterie, idPapierRamettesCahiers);
  } else {
    const photo = await uploaderPhoto("prod-ramette-smart-copy-a4-1.webp");
    const { error } = await supabase
      .from("produits")
      .update({
        nom: "Ramette papier A4 Smart Copy 80 g (500 feuilles)",
        description:
          "Papier blanc A4 (21 × 29,7 cm), 80 g/m², 500 feuilles, pour imprimante laser, jet d'encre et photocopieur.",
        prix: 3500,
        prix_achat: 3250,
        photo,
        photos: [photo],
        unite_vente: "ramette",
      })
      .eq("id", ID_SMART_COPY);
    if (error) throw new Error(`Mise à jour #${ID_SMART_COPY} échouée : ${error.message}`);
    console.log(`✓ mis à jour #${ID_SMART_COPY} : Ramette A4 Smart Copy — achat 3250, vente 3500 (fournisseur inchangé)`);
    await ajouterClassementSecondaire(ID_SMART_COPY, idCahiersPapeterie, idPapierRamettesCahiers);
  }

  // --- 2-4. Les 3 autres produits papier : création, publiés directement ---
  const AUTRES_PAPIERS = [
    {
      nom: "Ramette papier A4 Double A Premium 80 g (500 feuilles)",
      description: "Papier blanc A4 Double A Premium, 80 g/m², 500 feuilles, pour imprimante et photocopieur.",
      prixAchat: 3500,
      prixVente: 3800,
      uniteVente: "ramette",
      quantiteConditionnement: null,
      image: "prod-ramette-double-a-a4-1.webp",
      categorieId: idImprimerie,
      sousCategorieId: idPapierRamettesImprimerie,
      secondaire: { categorieId: idCahiersPapeterie, sousCategorieId: idPapierRamettesCahiers },
    },
    {
      nom: "Papier couleur A4 Double A, jaune, 80 g (100 feuilles)",
      description:
        "Papier de couleur jaune A4, 80 g/m², paquet de 100 feuilles, pour exposés, affiches et travaux manuels.",
      prixAchat: 4500,
      prixVente: 5000,
      uniteVente: "paquet",
      quantiteConditionnement: 100,
      image: "prod-papier-couleur-double-a-jaune-1.webp",
      categorieId: idImprimerie,
      sousCategorieId: idPapierRamettesImprimerie,
      secondaire: { categorieId: idCahiersPapeterie, sousCategorieId: idPapierRamettesCahiers },
    },
    {
      nom: "Papier millimétré A4, lot de 10 feuilles",
      description: "Lot de 10 feuilles de papier millimétré A4 pour les graphiques en maths, physique et SVT.",
      prixAchat: 1000,
      prixVente: 1250,
      uniteVente: "lot",
      quantiteConditionnement: 10,
      image: "prod-papier-millimetre-a4-lot-10-1.webp",
      categorieId: idCahiersPapeterie,
      sousCategorieId: idCopiesFeuilles,
      // Catégorie entière "Matériel géométrique", sans sous-catégorie précise.
      secondaire: { categorieId: idGeometrie, sousCategorieId: null },
    },
  ];

  for (const p of AUTRES_PAPIERS) {
    const { data: existant } = await supabase.from("produits").select("id").eq("nom", p.nom).maybeSingle();
    let produitId = existant?.id ?? null;
    if (existant) {
      console.log(`= déjà présent, ignoré : ${p.nom} (#${existant.id})`);
    } else if (DRY_RUN) {
      console.log(`[dry-run] créerait : ${p.nom} — achat ${p.prixAchat}, vente ${p.prixVente}, "${p.uniteVente}"`);
    } else {
      const photo = await uploaderPhoto(p.image);
      const { data: inserted, error } = await supabase
        .from("produits")
        .insert({
          nom: p.nom,
          description: p.description,
          categorie_id: p.categorieId,
          sous_categorie_id: p.sousCategorieId,
          prix: p.prixVente,
          prix_achat: p.prixAchat,
          delai: "6j",
          photo,
          photos: [photo],
          stock: 1,
          seuil_alerte: 1,
          statut: "dispo",
          vendeur_id: vendeurId,
          publie_par: "admin",
          statut_publication: "publie",
          unite_vente: p.uniteVente,
          quantite_conditionnement: p.quantiteConditionnement,
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error(`Insertion échouée (${p.nom}) : ${error?.message}`);
      produitId = inserted.id;
      console.log(`✓ créé #${produitId} (publié) : ${p.nom} — achat ${p.prixAchat}, vente ${p.prixVente}`);
    }
    if (produitId || DRY_RUN) {
      await ajouterClassementSecondaire(produitId ?? 0, p.secondaire.categorieId, p.secondaire.sousCategorieId);
    }
  }

  // --- 5. Sacoche -> "15 pouces" (produit créé par le lot nouveaux_produits) ---
  const nomSacocheActuel = "Sacoche pour ordinateur portable";
  const { data: sacoche } = await supabase.from("produits").select("id, nom, description").eq("nom", nomSacocheActuel).maybeSingle();
  if (!sacoche) {
    console.warn(`! "${nomSacocheActuel}" introuvable — lancer d'abord importer-nouveaux-produits-2026-10.mjs.`);
  } else if (DRY_RUN) {
    console.log(`[dry-run] renommerait #${sacoche.id} en "Sacoche pour ordinateur portable 15 pouces"`);
  } else {
    const description = `Pour ordinateur jusqu'à 15 pouces. ${sacoche.description ?? ""}`.trim();
    const { error } = await supabase
      .from("produits")
      .update({ nom: "Sacoche pour ordinateur portable 15 pouces", description })
      .eq("id", sacoche.id);
    if (error) throw new Error(`Renommage de la sacoche échoué : ${error.message}`);
    console.log(`✓ renommé #${sacoche.id} : Sacoche pour ordinateur portable 15 pouces`);
  }

  console.log("\nTerminé. Les 4 produits papier sont publiés directement ; le 1280 a gardé son fournisseur d'origine.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
