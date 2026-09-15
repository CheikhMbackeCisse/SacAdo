// SacAdo — catégories/sous-catégories nécessaires à l'import Yuupee.
// TACHE_yuupee_integration_complete.md §3 (Informatique) +
// TACHE_kits_impression_classement.md Chantier B (racine Impression et
// consommables, confirmée en 4 sous-catégories + attributs par le fondateur).
// Usage : node scripts/creer-categories-yuupee.mjs. Idempotent (par slug).
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

// Nouvelles sous-catégories sous Informatique (id 7) — les 3 autres
// (Ordinateurs portables, Claviers et souris, Stockage et mémoire) existent
// déjà (ids 42, 44, 45) et sont réutilisées telles quelles.
const SOUS_CATS_INFORMATIQUE = [
  { slug: "ordinateurs-de-bureau", nom: "Ordinateurs de bureau" },
  { slug: "ecrans", nom: "Écrans" },
  { slug: "cables-adaptateurs", nom: "Câbles et adaptateurs" },
];

const CATEGORIE_IMPRESSION = { slug: "impression-consommables", nom: "Impression et consommables" };
const SOUS_CATS_IMPRESSION = [
  { slug: "imprimantes", nom: "Imprimantes" },
  { slug: "photocopieurs", nom: "Photocopieurs" },
  { slug: "cartouches-toners", nom: "Cartouches et toners" },
  { slug: "impression-3d", nom: "Impression 3D" },
];

async function creerSousCategorie(categorieId, { slug, nom }, ordre) {
  const { data: existant } = await supabase
    .from("sous_categories")
    .select("id")
    .eq("categorie_id", categorieId)
    .eq("slug", slug)
    .maybeSingle();
  if (existant) {
    console.log(`= sous-catégorie déjà présente : ${nom} (#${existant.id})`);
    return existant.id;
  }
  const { data: cree, error } = await supabase
    .from("sous_categories")
    .insert({ categorie_id: categorieId, slug, nom, ordre })
    .select("id")
    .single();
  if (error || !cree) throw new Error(`Sous-catégorie '${nom}' échouée : ${error?.message}`);
  console.log(`✓ sous-catégorie créée : ${nom} (#${cree.id})`);
  return cree.id;
}

async function main() {
  // 1. Sous-catégories Informatique (catégorie 7 existante)
  const { data: sousExistantes } = await supabase
    .from("sous_categories")
    .select("ordre")
    .eq("categorie_id", 7)
    .order("ordre", { ascending: false })
    .limit(1);
  let ordre = (sousExistantes?.[0]?.ordre ?? 0) + 1;
  for (const sc of SOUS_CATS_INFORMATIQUE) {
    await creerSousCategorie(7, sc, ordre++);
  }

  // 2. Catégorie racine Impression et consommables
  // Note UX : la fiche de tâche demande une entrée dédiée (bande « Vous êtes
  // un établissement ? ») plutôt que la grille catégories grand public — ce
  // bandeau n'est pas encore construit (lot séparé). La catégorie est créée
  // active dès maintenant pour porter les produits importés ; elle apparaîtra
  // dans la grille standard tant que ce bandeau n'existe pas.
  let { data: catImpression } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", CATEGORIE_IMPRESSION.slug)
    .maybeSingle();
  if (!catImpression) {
    const { data: maxOrdre } = await supabase
      .from("categories")
      .select("ordre")
      .order("ordre", { ascending: false })
      .limit(1);
    const nouvelOrdre = (maxOrdre?.[0]?.ordre ?? 0) + 1;
    const { data: cree, error } = await supabase
      .from("categories")
      .insert({ slug: CATEGORIE_IMPRESSION.slug, nom: CATEGORIE_IMPRESSION.nom, ordre: nouvelOrdre, actif: true })
      .select("id")
      .single();
    if (error || !cree) throw new Error(`Catégorie Impression échouée : ${error?.message}`);
    catImpression = cree;
    console.log(`✓ catégorie créée : ${CATEGORIE_IMPRESSION.nom} (#${catImpression.id})`);
  } else {
    console.log(`= catégorie déjà présente : ${CATEGORIE_IMPRESSION.nom} (#${catImpression.id})`);
  }

  let ordreImp = 1;
  for (const sc of SOUS_CATS_IMPRESSION) {
    await creerSousCategorie(catImpression.id, sc, ordreImp++);
  }

  console.log("\nTerminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
