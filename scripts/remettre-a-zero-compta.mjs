// PROMPT_ADMIN_COMPTA_LOCALITES.md — Lot 1, étape 3 : marque toutes les
// commandes comme "test" sauf la n° 28. Ne touche ni au stock, ni aux lignes
// (commande_items), ni aux dépenses — seule la colonne commandes.est_test
// change. À lancer UNIQUEMENT après la sauvegarde.
// Usage : node scripts/remettre-a-zero-compta.mjs
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
const COMMANDE_A_GARDER = 28;

async function main() {
  const { error } = await supabase.from("commandes").update({ est_test: true }).neq("id", COMMANDE_A_GARDER);
  if (error) {
    console.error("Erreur mise à jour:", error.message);
    process.exit(1);
  }

  const { data: verif } = await supabase.from("commandes").select("id, est_test").order("id");
  const test = verif.filter((c) => c.est_test);
  const reel = verif.filter((c) => !c.est_test);
  console.log(`Commandes marquées "test" : ${test.length}`);
  console.log(`Commandes réelles restantes : ${reel.length} -> #${reel.map((c) => c.id).join(", ")}`);
}

main();
