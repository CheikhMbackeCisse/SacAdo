// Vérification ponctuelle post-migration 0041+0042 (TACHE_recherche_produits_v2.md §7).
// Usage : node scripts/verifier-migration-recherche.mjs
// Lit .env.local, ne modifie rien, jetable après usage.
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

async function main() {
  console.log("--- 1. Colonnes d'index remplies ---");
  const { count: total } = await supabase.from("produits").select("*", { count: "exact", head: true });
  const { count: remplis } = await supabase
    .from("produits")
    .select("*", { count: "exact", head: true })
    .not("nom_normalise", "is", null);
  console.log(`  ${remplis}/${total} produits ont nom_normalise rempli.`);

  console.log("--- 2. Synonymes ---");
  const { count: nbSynonymes } = await supabase
    .from("synonymes")
    .select("*", { count: "exact", head: true });
  console.log(`  ${nbSynonymes} termes en base.`);

  console.log("--- 3. rechercher_produits : décroissance stricte ---");
  for (const terme of ["ordinateur portable", "hp", "cahier", "bic", "arduno", "flash"]) {
    const { data, error } = await supabase.rpc("rechercher_produits", { terme, limite: 50 });
    if (error) {
      console.log(`  "${terme}" -> ERREUR: ${error.message}`);
      continue;
    }
    console.log(`  "${terme}" -> ${data.length} résultat(s)`);
  }

  console.log("--- 4. recherches_sans_resultat : colonne de suivi ---");
  const { error: erreurSuivi } = await supabase
    .from("recherches_sans_resultat")
    .select("terme, traitement, traite_le")
    .limit(1);
  console.log(erreurSuivi ? `  ERREUR: ${erreurSuivi.message}` : "  colonnes traitement/traite_le lisibles.");

  console.log("--- 5. Journal d'une recherche vide ---");
  const termeTest = `test_migration_${Date.now()}`;
  const { error: erreurInsert } = await supabase
    .from("recherches_sans_resultat")
    .insert({ terme: termeTest });
  console.log(erreurInsert ? `  ERREUR insert: ${erreurInsert.message}` : "  insert OK (via service_role).");
  if (!erreurInsert) {
    await supabase.from("recherches_sans_resultat").delete().eq("terme", termeTest);
  }
}

main().then(() => process.exit(0));
