// PROMPT_CLIENT lot 1 — "À découvrir" (accueil) : exclut 1577, épingle les
// places 1 à 10 puis 13 à 16 (11/12/17+ restent au classement automatique).
// Dry-run par défaut, --apply pour écrire dans classement_manuel.
//
// Usage : node scripts/corriger-classement-pc.mjs [--apply]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
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

const EXCLUSIONS = [1577];
const EPINGLAGES = [
  { position: 1, id: 1727 },
  { position: 2, id: 1715 },
  { position: 3, id: 1726 },
  { position: 4, id: 1636 },
  { position: 5, id: 1301 },
  { position: 6, id: 1682 },
  { position: 7, id: 1290 },
  { position: 8, id: 1303 },
  { position: 9, id: 1307 },
  { position: 10, id: 1199 },
  { position: 13, id: 90 },
  { position: 14, id: 95 },
  { position: 15, id: 435 },
  { position: 16, id: 654 },
];

async function main() {
  console.log(`=== PROMPT_CLIENT lot 1 — classement ${APPLY ? "(APPLY)" : "(dry-run)"} ===\n`);

  const ids = [...EXCLUSIONS, ...EPINGLAGES.map((e) => e.id)];
  const { data: produits, error: errP } = await supabase
    .from("produits")
    .select("id, nom, statut_publication, statut, stock, photo, photos")
    .in("id", ids);
  if (errP) throw errP;
  const parId = new Map(produits.map((p) => [p.id, p]));

  console.log("Exclusion de l'accueil :");
  for (const id of EXCLUSIONS) {
    const p = parId.get(id);
    console.log(`  #${id} ${p?.nom ?? "INTROUVABLE"}`);
  }

  console.log("\nÉpinglages :");
  for (const e of EPINGLAGES) {
    const p = parId.get(e.id);
    if (!p) {
      console.log(`  ! place ${e.position} : produit #${e.id} INTROUVABLE`);
      continue;
    }
    const aPhoto = p.photo || (Array.isArray(p.photos) && p.photos.length > 0);
    const pubOk = p.statut_publication === "publie";
    const statutOk = p.statut !== "epuise";
    const alerte = !pubOk || !aPhoto || !statutOk ? "  !! " + [!pubOk && "non publié", !aPhoto && "sans photo", !statutOk && "épuisé"].filter(Boolean).join(", ") : "";
    console.log(`  place ${String(e.position).padStart(2)} — #${e.id} ${p.nom} (stock=${p.stock}, statut=${p.statut})${alerte}`);
  }

  if (!APPLY) {
    console.log("\n=== Dry-run — rien n'a été écrit. Relance avec --apply pour écrire. ===");
    return;
  }

  let erreurs = 0;
  for (const id of EXCLUSIONS) {
    const { error } = await supabase
      .from("classement_manuel")
      .upsert({ produit_id: id, position: null, exclu: true }, { onConflict: "produit_id" });
    if (error) {
      console.log(`!! Échec exclusion #${id} : ${error.message}`);
      erreurs++;
    } else {
      console.log(`✓ #${id} exclu de l'accueil`);
    }
  }

  for (const e of EPINGLAGES) {
    const { error } = await supabase
      .from("classement_manuel")
      .upsert({ produit_id: e.id, position: e.position, exclu: false }, { onConflict: "produit_id" });
    if (error) {
      console.log(`!! Échec épinglage #${e.id} (place ${e.position}) : ${error.message}`);
      erreurs++;
    } else {
      console.log(`✓ #${e.id} épinglé en place ${e.position}`);
    }
  }

  console.log(`\n=== Fin — ${erreurs === 0 ? "aucune erreur" : `${erreurs} erreur(s)`} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
