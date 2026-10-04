// PROMPT_ADMIN_COMPTA_LOCALITES.md — Lot 1, étape 2 : sauvegarde complète
// avant remise à zéro de la comptabilité (toutes les commandes sauf #28).
// Usage : node scripts/sauvegarder-avant-remise-a-zero.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  const { data: commandes, error: errC } = await supabase.from("commandes").select("*").order("id");
  if (errC) {
    console.error("Erreur lecture commandes:", errC.message);
    process.exit(1);
  }

  const ids = commandes.map((c) => c.id);
  const { data: items } = await supabase.from("commande_items").select("*").in("commande_id", ids);
  const { data: depenses } = await supabase.from("depenses").select("*");
  const { data: waveEvenements } = await supabase.from("wave_evenements").select("*").in("commande_id", ids);

  const sauvegarde = {
    date_sauvegarde: new Date().toISOString(),
    commande_gardee: 28,
    commandes,
    commande_items: items ?? [],
    depenses: depenses ?? [],
    wave_evenements: waveEvenements ?? [],
  };

  mkdirSync("backups", { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const chemin = `backups/compta_avant_remise_a_zero_${date}.json`;
  writeFileSync(chemin, JSON.stringify(sauvegarde, null, 2), "utf8");

  console.log(`Sauvegarde écrite : ${chemin}`);
  console.log(`  commandes: ${commandes.length}`);
  console.log(`  commande_items: ${items?.length ?? 0}`);
  console.log(`  depenses: ${depenses?.length ?? 0}`);
  console.log(`  wave_evenements: ${waveEvenements?.length ?? 0}`);
}

main();
