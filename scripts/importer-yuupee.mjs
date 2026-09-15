// SacAdo — import des 640 produits Yuupee informatique + impression
// (TACHE_yuupee_integration_complete.md). Lit produits_a_importer.json,
// généré par preparer_import.py (photos déjà hébergées sur le Storage
// Supabase, prix déjà calculés avec la grille de majoration).
// Usage : node scripts/importer-yuupee.mjs
// Prérequis : migration 0072 exécutée, fournisseur + catégories déjà créés
// (creer-fournisseur-yuupee.mjs, creer-categories-yuupee.mjs). Idempotent
// par nom de produit.
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
  "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/produits_a_importer.json";

async function main() {
  const produits = JSON.parse(readFileSync(SOURCE_JSON, "utf8"));

  const { data: vendeur, error: errVendeur } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", "Yuupee")
    .single();
  if (errVendeur || !vendeur) throw new Error("Fournisseur Yuupee introuvable (creer-fournisseur-yuupee.mjs a-t-il tourné ?)");

  const { data: sousCats, error: errSous } = await supabase
    .from("sous_categories")
    .select("id, slug, categorie_id");
  if (errSous) throw new Error(`Sous-catégories introuvables : ${errSous.message}`);
  const parSlug = Object.fromEntries((sousCats ?? []).map((s) => [s.slug, s]));

  let crees = 0;
  let ignores = 0;
  let aVerifier = 0;

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

    const payload = {
      nom: p.nom,
      categorie_id: cible.categorie_id,
      sous_categorie_id: cible.id,
      prix: p.prix_vente,
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
      technologie: p.technologie,
      couleur_impression: p.couleur_impression,
      compatibilite: p.compatibilite,
      marque: p.marque,
      prix_a_verifier: p.prix_a_verifier,
      ...(p.coefficient_visibilite != null ? { coefficient_visibilite: p.coefficient_visibilite } : {}),
    };

    const { error } = await supabase.from("produits").insert(payload);
    if (error) throw new Error(`Insertion échouée (${p.nom}) : ${error.message}`);
    crees++;
    if (p.prix_a_verifier) aVerifier++;
    if (crees % 100 === 0) console.log(`  ${crees} créés...`);
  }

  console.log(`\n${crees} produits créés, ${ignores} déjà présents (ignorés).`);
  console.log(`${aVerifier} en "prix à vérifier" (importés, non publiables tant que non corrigés).`);
  console.log(`Tous en statut_publication = 'en_attente' : à publier par lots depuis /admin/produits (§7 : stockage/mémoire, claviers/souris, câbles/adaptateurs en premier).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
