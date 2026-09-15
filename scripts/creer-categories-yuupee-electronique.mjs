// SacAdo — sous-catégories Électronique nécessaires à l'import Yuupee
// (TACHE_yuupee_integration_complete.md §3, bloc Électronique).
// "Arduino" réutilise la sous-catégorie existante "Cartes Arduino" (id 48,
// renommée) puisqu'elle correspond déjà au même concept fusionné (Cartes +
// Kits Arduino). Les 5 autres sont nouvelles. "Kits SacAdo" reste vide pour
// l'instant : elle accueillera les 6 kits assemblés du Chantier A.
// Usage : node scripts/creer-categories-yuupee-electronique.mjs. Idempotent.
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

const CATEGORIE_ID = 8; // Électronique

const NOUVELLES = [
  { slug: "raspberry-pi", nom: "Raspberry Pi" },
  { slug: "modules-capteurs", nom: "Modules et capteurs" },
  { slug: "objets-connectes", nom: "Objets connectés" },
  { slug: "drones", nom: "Drones" },
  { slug: "kits-sacado", nom: "Kits SacAdo" },
];

async function main() {
  // Renommer "Cartes Arduino" -> "Arduino" (id 48), même slug, même produits.
  const { error: errRenomme } = await supabase
    .from("sous_categories")
    .update({ nom: "Arduino" })
    .eq("id", 48);
  if (errRenomme) throw new Error(`Renommage Arduino échoué : ${errRenomme.message}`);
  console.log("✓ sous-catégorie renommée : Cartes Arduino -> Arduino (#48)");

  const { data: maxOrdre } = await supabase
    .from("sous_categories")
    .select("ordre")
    .eq("categorie_id", CATEGORIE_ID)
    .order("ordre", { ascending: false })
    .limit(1);
  let ordre = (maxOrdre?.[0]?.ordre ?? 0) + 1;

  for (const sc of NOUVELLES) {
    const { data: existant } = await supabase
      .from("sous_categories")
      .select("id")
      .eq("categorie_id", CATEGORIE_ID)
      .eq("slug", sc.slug)
      .maybeSingle();
    if (existant) {
      console.log(`= sous-catégorie déjà présente : ${sc.nom} (#${existant.id})`);
      continue;
    }
    const { data: cree, error } = await supabase
      .from("sous_categories")
      .insert({ categorie_id: CATEGORIE_ID, slug: sc.slug, nom: sc.nom, ordre: ordre++ })
      .select("id")
      .single();
    if (error || !cree) throw new Error(`Sous-catégorie '${sc.nom}' échouée : ${error?.message}`);
    console.log(`✓ sous-catégorie créée : ${sc.nom} (#${cree.id})`);
  }

  console.log("\nTerminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
