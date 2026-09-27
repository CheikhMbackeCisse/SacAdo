// CORRECTIONS_KITS Lot 6 : vérifie chaque kit publié contre l'onglet
// "Récap par kit" de kits_sacado_final.xlsx (lignes, cahiers cochés, total
// coché). Usage : node scripts/lot6-verification-kits.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

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

const wb = XLSX.read(readFileSync("kits_sacado_final.xlsx"), { type: "buffer" });
const recap = XLSX.utils.sheet_to_json(wb.Sheets["Récap par kit"], { defval: null });

async function main() {
  const { data: kits, error: errKits } = await supabase
    .from("kits")
    .select("id, nom, statut, images_mosaique");
  if (errKits) throw new Error(errKits.message);
  const kitParNom = new Map(kits.map((k) => [k.nom, k]));

  let ok = 0;
  const problemes = [];

  for (const r of recap) {
    const kit = kitParNom.get(r.Kit);
    if (!kit) {
      problemes.push(`${r.Kit} : kit introuvable en base`);
      continue;
    }
    if (kit.statut !== "publie") {
      problemes.push(`${r.Kit} : statut = ${kit.statut} (attendu publie)`);
      continue;
    }

    const { data: items, error: errItems } = await supabase
      .from("kit_items")
      .select("quantite_defaut, coche_defaut, groupe_affichage, produit:produits(prix)")
      .eq("kit_id", kit.id);
    if (errItems) throw new Error(errItems.message);

    const lignesTotal = items.length;
    const cahiersCoches = items
      .filter((it) => it.groupe_affichage === "Cahiers" && it.coche_defaut)
      .reduce((s, it) => s + it.quantite_defaut, 0);
    const totalCoche = items
      .filter((it) => it.coche_defaut)
      .reduce((s, it) => s + it.quantite_defaut * (it.produit?.prix ?? 0), 0);

    const erreursKit = [];
    if (lignesTotal !== r.Lignes) erreursKit.push(`lignes ${lignesTotal} != ${r.Lignes}`);
    if (cahiersCoches !== r["Cahiers (quantité)"]) {
      erreursKit.push(`cahiers ${cahiersCoches} != ${r["Cahiers (quantité)"]}`);
    }
    if (totalCoche !== r["Total coché (FCFA)"]) {
      erreursKit.push(`total ${totalCoche} != ${r["Total coché (FCFA)"]}`);
    }
    if (!kit.images_mosaique || kit.images_mosaique.length === 0) {
      erreursKit.push("images_mosaique vide");
    }

    if (erreursKit.length > 0) {
      problemes.push(`${r.Kit} : ${erreursKit.join(", ")}`);
    } else {
      ok++;
    }
  }

  console.log(`${ok}/${recap.length} kits conformes au récap.`);
  if (problemes.length > 0) {
    console.log("\n--- Problèmes ---");
    problemes.forEach((p) => console.log("- " + p));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
