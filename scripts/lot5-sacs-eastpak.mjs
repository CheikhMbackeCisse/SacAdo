// PROMPT_FINAL_CATALOGUE_KITS.md — Lot 5 : sacs Eastpak (1172, 1251, 1261,
// 1262, 1278). Dry-run par défaut ; --apply pour écrire. Sauvegarde avant
// toute écriture.
//
// Ne touche PAS à la photo E01 (prod-sac-eastpak-bleu-1.webp) : son motif
// (patchwork géométrique bleu/gris) ne correspond à AUCUN des 5 produits
// (1172 et 1278 portent déjà le même motif feuillage, distinct de E01) —
// signalé au fondateur, décision à prendre séparément.
//
// Usage : node scripts/lot5-sacs-eastpak.mjs [--apply]
import { readFileSync, writeFileSync } from "node:fs";
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const rapport = [];
const log = (s) => {
  console.log(s);
  rapport.push(s);
};

// Motif/couleur déterminé visuellement à partir de la photo actuelle de
// chaque produit (voir commentaire d'en-tête pour la photo E01).
const PRODUITS = [
  { id: 1172, motif: "motif feuillage bleu" },
  { id: 1251, motif: "gris anthracite" },
  { id: 1261, motif: "motif camouflage kaki" },
  { id: 1262, motif: "motif éclaboussures noir et rouge" },
  { id: 1278, motif: "motif feuillage bleu" },
];

async function main() {
  log(`# Rapport Lot 5 — sacs Eastpak (${APPLY ? "APPLIQUÉ" : "DRY-RUN"}) — ${horodatage}\n`);

  log(
    "⚠ Photo E01 (prod-sac-eastpak-bleu-1.webp, motif patchwork géométrique bleu/gris) : ne correspond à AUCUN des 5 sacs. " +
      "1172 et 1278 portent déjà, chacun, un motif « feuillage bleu » différent de celui de la photo E01. Rien touché sur les photos existantes — décision à prendre avec le fondateur.\n",
  );

  const ids = PRODUITS.map((p) => p.id);
  const { data: avant } = await sb.from("produits").select("*").in("id", ids);
  if (avant.length !== 5) {
    log(`ERREUR : ${avant.length}/5 produits trouvés en base, arrêt.`);
    return;
  }

  if (APPLY) {
    writeFileSync(`scripts/_backup_produits_lot5_${horodatage}.json`, JSON.stringify(avant, null, 1));
    log(`Sauvegarde : scripts/_backup_produits_lot5_${horodatage}.json\n`);
  }

  for (const p of PRODUITS) {
    const actuel = avant.find((a) => a.id === p.id);
    const nouveauNom = `Sac à dos Eastpak · ${p.motif}`;
    const motsCles = actuel.mots_cles && actuel.mots_cles.includes("Eastpak")
      ? actuel.mots_cles
      : [actuel.mots_cles, "Eastpak"].filter(Boolean).join(", ");
    log(`#${p.id} : "${actuel.nom}" → "${nouveauNom}" | achat ${actuel.prix_achat} → 10000 | vente ${actuel.prix} → 15000 | mots-clés → "${motsCles}"`);
    if (APPLY) {
      const { error } = await sb
        .from("produits")
        .update({
          nom: nouveauNom,
          marque: "Eastpak",
          prix_achat: 10000,
          prix: 15000,
          mots_cles: motsCles,
        })
        .eq("id", p.id);
      if (error) log(`  ERREUR #${p.id} : ${error.message}`);
    }
  }

  writeFileSync(`rapport-lot5-eastpak-${horodatage}.md`, rapport.join("\n"));
  console.log(`\nRapport écrit : rapport-lot5-eastpak-${horodatage}.md`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
