// CORRECTIONS_KITS Lot 2 : prix de vente + 2 nouveaux produits (cahiers TP MyFriend).
// Usage : node scripts/lot2-prix-et-nouveaux-produits.mjs --dry-run
//         node scripts/lot2-prix-et-nouveaux-produits.mjs
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

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

// #1286 : prix_achat corrigé à 450 (validé par le fondateur, l'ancien 750 était
// incohérent avec le nouveau prix de vente 550).
const PRIX = [
  { id: 1286, prix: 550, prix_achat: 450 },
  { id: 1578, prix: 1500 },
  { id: 1595, prix: 2000 },
  { id: 1187, prix: 2800 },
];

const CATEGORIE_CAHIERS = 2;
const SOUS_CATEGORIE_TP = 4; // "Cahiers de travaux pratiques"

const NOUVEAUX_PRODUITS = [
  {
    cle: "TP100",
    nom: "Cahier de travaux pratiques MyFriend 100 pages",
    prix: 900,
    photoFichier: "prod-cahier-tp-myfriend-100.jpg",
  },
  {
    cle: "TP200",
    nom: "Cahier de travaux pratiques MyFriend 200 pages",
    prix: 1300,
    photoFichier: "prod-cahier-tp-myfriend-200.jpg",
  },
];

async function appliquerPrix() {
  for (const p of PRIX) {
    const { data: avant, error: errLecture } = await supabase
      .from("produits")
      .select("id, nom, prix, prix_achat")
      .eq("id", p.id)
      .single();
    if (errLecture || !avant) throw new Error(`Lecture échouée #${p.id} : ${errLecture?.message}`);

    const patch = { prix: p.prix };
    if (p.prix_achat !== undefined) patch.prix_achat = p.prix_achat;

    const achatFinal = p.prix_achat !== undefined ? p.prix_achat : avant.prix_achat;
    if (achatFinal !== null && achatFinal > p.prix) {
      throw new Error(
        `#${p.id} ${avant.nom} : prix d'achat (${achatFinal}) > nouveau prix (${p.prix}) — arrêt.`,
      );
    }

    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}#${p.id} ${avant.nom} : prix ${avant.prix} -> ${p.prix}` +
        (p.prix_achat !== undefined ? `, prix_achat ${avant.prix_achat} -> ${p.prix_achat}` : ""),
    );

    if (!DRY_RUN) {
      const { error } = await supabase.from("produits").update(patch).eq("id", p.id);
      if (error) throw new Error(`Mise à jour échouée #${p.id} : ${error.message}`);
    }
  }
}

async function uploaderPhoto(fichier) {
  const buf = await readFile(`public/images/${fichier}`);
  const chemin = `import-kits-final/${fichier}`;
  if (DRY_RUN) return `[dry-run:${chemin}]`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, buf, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload échoué (${fichier}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

async function creerNouveauxProduits() {
  const idsCrees = {};
  for (const np of NOUVEAUX_PRODUITS) {
    const { data: existant, error: errLecture } = await supabase
      .from("produits")
      .select("id")
      .is("vendeur_id", null)
      .eq("nom", np.nom)
      .maybeSingle();
    if (errLecture) throw new Error(`Lecture échouée (${np.nom}) : ${errLecture.message}`);

    if (existant) {
      console.log(`= déjà existant : #${existant.id} — ${np.nom}`);
      idsCrees[np.cle] = existant.id;
      continue;
    }

    const url = await uploaderPhoto(np.photoFichier);
    const ligne = {
      nom: np.nom,
      categorie_id: CATEGORIE_CAHIERS,
      sous_categorie_id: SOUS_CATEGORIE_TP,
      prix: np.prix,
      delai: "24h",
      photo: url,
      photos: [url],
      stock: 0,
      statut: "dispo",
      statut_publication: "publie",
      publie_par: "admin",
      vendeur_id: null,
    };

    if (DRY_RUN) {
      console.log(`[dry-run] créerait : ${np.nom} (${JSON.stringify(ligne)})`);
      idsCrees[np.cle] = `[dry-run:${np.cle}]`;
      continue;
    }

    const { data: cree, error } = await supabase.from("produits").insert(ligne).select("id").single();
    if (error || !cree) throw new Error(`Création échouée (${np.nom}) : ${error?.message}`);
    console.log(`✓ créé #${cree.id} : ${np.nom}`);
    idsCrees[np.cle] = cree.id;
  }
  return idsCrees;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== EXÉCUTION RÉELLE ===");
  await appliquerPrix();
  console.log("");
  const ids = await creerNouveauxProduits();
  console.log("\nIDs (TP100/TP200) à reporter dans l'import des kits :", ids);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
