// SacAdo — import des 333 produits Yuupee électronique (composants IoT).
// Lit produits_electronique_a_importer.json (preparer_import_electronique.py).
// À exécuter avant toute création de kit (Chantier A : "les composants
// d'abord, les kits ensuite" — un kit ne peut pas référencer un produit
// inexistant).
// Usage : node scripts/importer-yuupee-electronique.mjs
// Prérequis : creer-categories-yuupee-electronique.mjs déjà exécuté.
// Idempotent par nom de produit.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const SOURCE_JSON =
  "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/produits_electronique_a_importer.json";

// Même grille que creer-fournisseur-yuupee.mjs (Chantier D) : prix Yuupee +
// majoration fixe par palier, pas de remise.
const GRILLE_MAJORATION_YUUPEE = [
  { seuil: 5000, valeur: 500 },
  { seuil: 20000, valeur: 1000 },
  { seuil: 50000, valeur: 2500 },
  { seuil: 150000, valeur: 5000 },
  { seuil: 400000, valeur: 10000 },
  { seuil: null, valeur: 20000 },
];
function palier(prix, grille) {
  for (const p of grille) {
    if (p.seuil === null || prix < p.seuil) return p.valeur;
  }
  throw new Error(`Aucun palier pour ${prix}`);
}

async function main() {
  const produits = JSON.parse(readFileSync(SOURCE_JSON, "utf8"));

  const { data: vendeur, error: errVendeur } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", "Yuupee")
    .single();
  if (errVendeur || !vendeur) throw new Error("Fournisseur Yuupee introuvable.");

  const { data: sousCats, error: errSous } = await supabase
    .from("sous_categories")
    .select("id, slug, categorie_id")
    .eq("categorie_id", 8);
  if (errSous) throw new Error(`Sous-catégories introuvables : ${errSous.message}`);
  const parSlug = Object.fromEntries((sousCats ?? []).map((s) => [s.slug, s]));

  let crees = 0;
  let ignores = 0;

  for (const p of produits) {
    const cible = parSlug[p.sous_categorie_slug];
    if (!cible) throw new Error(`Sous-catégorie inconnue : ${p.sous_categorie_slug} (${p.nom})`);

    const { data: existant } = await supabase
      .from("produits")
      .select("id")
      .eq("nom", p.nom)
      .maybeSingle();
    if (existant) {
      ignores++;
      continue;
    }

    const prixVente = p.prix_achat + palier(p.prix_achat, GRILLE_MAJORATION_YUUPEE);

    const payload = {
      nom: p.nom,
      categorie_id: cible.categorie_id,
      sous_categorie_id: cible.id,
      prix: prixVente,
      prix_achat: p.prix_achat,
      delai: "6j",
      photo: p.photos[0] ?? null,
      photos: p.photos,
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      description: null,
      vendeur_id: vendeur.id,
      publie_par: "admin",
      statut_publication: "en_attente",
      prix_a_verifier: p.prix_a_verifier,
    };

    const { error } = await supabase.from("produits").insert(payload);
    if (error) throw new Error(`Insertion échouée (${p.nom}) : ${error.message}`);
    crees++;
    if (crees % 100 === 0) console.log(`  ${crees} créés...`);
  }

  console.log(`\n${crees} produits créés, ${ignores} déjà présents (ignorés).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
