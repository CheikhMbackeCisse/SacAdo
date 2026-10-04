// PROMPT_ADMIN_KITS_PRODUITS.md, lot 1, point 3 : les 10 sacs "Forever
// Cultivate" sont la marque "Karbi" côté fournisseur, mais ni l'un ni
// l'autre mot n'apparaît dans leur nom/description/mots_cles — aucune
// recherche texte ne peut donc les trouver. Ajoute les deux mots-clés.
// Usage : node scripts/maj-mots-cles-karbi.mjs
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
const MOTS_CLES = "Karbi, Forever Cultivate";

async function main() {
  const { data: produits, error } = await supabase
    .from("produits")
    .select("id, nom, mots_cles")
    .ilike("nom", "%Forever Cultivate%");
  if (error) {
    console.error("Erreur lecture:", error.message);
    process.exit(1);
  }
  if (!produits || produits.length === 0) {
    console.log("Aucun sac Forever Cultivate trouvé.");
    return;
  }

  console.log(`${produits.length} sac(s) trouvé(s), mise à jour des mots-clés...`);
  for (const p of produits) {
    // Déclenche le trigger maj_index_recherche() (recalcule recherche_texte).
    const { error: errUpdate } = await supabase.from("produits").update({ mots_cles: MOTS_CLES }).eq("id", p.id);
    if (errUpdate) {
      console.error(`#${p.id} "${p.nom}" — erreur:`, errUpdate.message);
      continue;
    }
    console.log(`#${p.id} "${p.nom}" — mots_cles = "${MOTS_CLES}"`);
  }
}

main();
