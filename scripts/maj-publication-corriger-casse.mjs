// Correction ciblée : quelques mots courts (<=4 lettres) restés en
// MAJUSCULES après le nettoyage de casse (scripts/maj-publication-publier-en-attente.mjs)
// parce que la règle générale les traite comme des sigles (HP, USB...). Ce ne
// sont pas des sigles : à corriger explicitement. Idempotent.
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

const CORRECTIONS = { NOIR: "Noir", BLEU: "Bleu", POUR: "pour", DUR: "dur", CARD: "Card", JEU: "Jeu" };

const IDS = [200, 212, 236, 251, 276, 331, 360, 384, 386, 411, 445, 449, 465, 509, 510, 550, 613, 615, 618, 621, 622, 623, 625, 626, 627, 628, 645, 657, 671, 686, 758, 1001];

async function main() {
  const { data: produits, error } = await supabase.from("produits").select("id, nom").in("id", IDS);
  if (error) throw error;

  for (const p of produits) {
    const corrige = p.nom
      .split(" ")
      .map((mot) => CORRECTIONS[mot] ?? mot)
      .join(" ");
    if (corrige !== p.nom) {
      await supabase.from("produits").update({ nom: corrige }).eq("id", p.id);
      console.log(`  ✎ [${p.id}] "${p.nom}" -> "${corrige}"`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
