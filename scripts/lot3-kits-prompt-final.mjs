// PROMPT_FINAL_CATALOGUE_KITS.md — Lot 3 : changements dans les kits.
// Dry-run par défaut (aucune écriture) ; --apply pour exécuter réellement.
// Sauvegarde intégrale de kit_items avant toute écriture (--apply uniquement).
//
// Usage : node scripts/lot3-kits-prompt-final.mjs [--apply]
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

async function toutesLesLignes(table, select, filtre) {
  const lignes = [];
  for (let offset = 0; ; offset += 1000) {
    let q = sb.from(table).select(select).range(offset, offset + 999);
    if (filtre) q = filtre(q);
    const { data, error } = await q;
    if (error) throw error;
    lignes.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return lignes;
}

async function main() {
  log(`# Rapport Lot 3 — kits (${APPLY ? "APPLIQUÉ" : "DRY-RUN"}) — ${horodatage}\n`);

  const { data: kits } = await sb.from("kits").select("id, cycle, niveau, gamme, nom");
  const kitById = new Map(kits.map((k) => [k.id, k]));

  // Sauvegarde intégrale de kit_items avant toute écriture.
  if (APPLY) {
    const toutesLignesKitItems = await toutesLesLignes("kit_items", "*");
    writeFileSync(
      `scripts/_backup_kit_items_lot3_${horodatage}.json`,
      JSON.stringify(toutesLignesKitItems, null, 1),
    );
    log(`Sauvegarde : scripts/_backup_kit_items_lot3_${horodatage}.json (${toutesLignesKitItems.length} lignes)\n`);
  }

  // ==========================================================================
  // Règle 1 — remplacer 1594 par 1593 partout, mêmes réglages.
  // ==========================================================================
  log("## Règle 1 — 1594 → 1593 (crayons Nightfall, boîte 12)\n");
  const lignes1594 = await sb.from("kit_items").select("*").eq("produit_id", 1594);
  log(`${lignes1594.data.length} kit(s) concerné(s) : ${lignes1594.data.map((l) => kitById.get(l.kit_id)?.nom).join(", ")}`);
  if (APPLY) {
    for (const ligne of lignes1594.data) {
      const { error } = await sb.from("kit_items").update({ produit_id: 1593 }).eq("id", ligne.id);
      if (error) log(`  ERREUR kit_item ${ligne.id} : ${error.message}`);
    }
  }
  log("");

  // ==========================================================================
  // Règle 2 — ajouter 1269 (protège-documents) dans tous les kits 6e→Terminale,
  // 3 gammes, quantité 1, coché, sans doublon.
  // ==========================================================================
  log("## Règle 2 — ajout de 1269 (protège-documents) 6e → Terminale, 3 gammes\n");
  const scopeRegle2 = kits.filter(
    (k) => (k.cycle === "college" && ["6e", "5e", "4e", "3e"].includes(k.niveau)) || k.cycle === "lycee",
  );
  const lignes1269 = await sb.from("kit_items").select("kit_id").eq("produit_id", 1269);
  const kitsAvec1269 = new Set(lignes1269.data.map((l) => l.kit_id));
  const aAjouter2 = scopeRegle2.filter((k) => !kitsAvec1269.has(k.id));
  log(`${scopeRegle2.length} kits dans le périmètre, ${aAjouter2.length} à compléter (${scopeRegle2.length - aAjouter2.length} l'ont déjà).`);
  if (APPLY) {
    for (const kit of aAjouter2) {
      const { data: maxOrdreRows } = await sb
        .from("kit_items")
        .select("ordre")
        .eq("kit_id", kit.id)
        .order("ordre", { ascending: false })
        .limit(1);
      const ordre = (maxOrdreRows?.[0]?.ordre ?? 0) + 1;
      const { error } = await sb.from("kit_items").insert({
        kit_id: kit.id,
        produit_id: 1269,
        quantite_defaut: 1,
        libelle_besoin: "Porte-vues",
        groupe_affichage: "Rangement",
        section: "principal",
        coche_defaut: true,
        ordre,
      });
      if (error) log(`  ERREUR kit ${kit.id} (${kit.nom}) : ${error.message}`);
    }
  }
  log("");

  // ==========================================================================
  // Règle 3 — 1229 (Marshal) et 1260 (Maped 1930) côte à côte partout où l'un
  // des deux existe ; 1229 coché, 1260 décoché.
  // ==========================================================================
  log("## Règle 3 — 1229 (Marshal, coché) + 1260 (Maped 1930, décoché) côte à côte\n");
  const l1229 = (await sb.from("kit_items").select("*").eq("produit_id", 1229)).data;
  const l1260 = (await sb.from("kit_items").select("*").eq("produit_id", 1260)).data;
  const map1229 = new Map(l1229.map((l) => [l.kit_id, l]));
  const map1260 = new Map(l1260.map((l) => [l.kit_id, l]));
  const kitsRegle3 = new Set([...map1229.keys(), ...map1260.keys()]);
  log(`${kitsRegle3.size} kit(s) concerné(s) (${map1229.size} avec 1229, ${map1260.size} avec 1260, ${
    [...map1229.keys()].filter((k) => map1260.has(k)).length
  } avec les deux déjà).`);
  if (APPLY) {
    for (const kitId of kitsRegle3) {
      let item1229 = map1229.get(kitId);
      let item1260 = map1260.get(kitId);

      if (!item1229) {
        const ordre = (item1260?.ordre ?? 0) + 1;
        const { data, error } = await sb
          .from("kit_items")
          .insert({
            kit_id: kitId,
            produit_id: 1229,
            quantite_defaut: 1,
            libelle_besoin: "Matériel géométrique",
            groupe_affichage: "Géométrie",
            section: "principal",
            coche_defaut: true,
            ordre,
          })
          .select("*")
          .single();
        if (error) log(`  ERREUR ajout 1229 kit ${kitId} : ${error.message}`);
        else item1229 = data;
      } else if (!item1229.coche_defaut) {
        await sb.from("kit_items").update({ coche_defaut: true }).eq("id", item1229.id);
      }

      if (!item1260) {
        const ordre = (item1229?.ordre ?? 0) + 1;
        const { error } = await sb.from("kit_items").insert({
          kit_id: kitId,
          produit_id: 1260,
          quantite_defaut: 1,
          libelle_besoin: "Règle, équerre, rapporteur",
          groupe_affichage: "Géométrie",
          section: "principal",
          coche_defaut: false,
          ordre,
        });
        if (error) log(`  ERREUR ajout 1260 kit ${kitId} : ${error.message}`);
      } else {
        const nouvelOrdre = (item1229?.ordre ?? item1260.ordre) + 1;
        const { error } = await sb
          .from("kit_items")
          .update({ coche_defaut: false, ordre: nouvelOrdre })
          .eq("id", item1260.id);
        if (error) log(`  ERREUR maj 1260 kit ${kitId} : ${error.message}`);
      }
    }
  }
  log("");

  // ==========================================================================
  // Règle 4 — 6e et 5e, 3 gammes : calculatrice 1279 (Sharp) cochée à la place
  // de 1727 (Casio) ; l'ajouter si aucune calculatrice.
  // ==========================================================================
  log("## Règle 4 — calculatrice Sharp 1279 (6e + 5e, 3 gammes)\n");
  log("⚠ Signalé : prix d'achat 3 700 FCFA > prix de vente 3 500 FCFA pour le produit 1279.");
  const scopeRegle4 = kits.filter((k) => k.cycle === "college" && ["6e", "5e"].includes(k.niveau));
  for (const kit of scopeRegle4) {
    const { data: calc } = await sb.from("kit_items").select("*").in("produit_id", [1279, 1727]).eq("kit_id", kit.id);
    const casio = calc.find((c) => c.produit_id === 1727);
    const sharp = calc.find((c) => c.produit_id === 1279);
    if (casio) log(`- ${kit.nom} : remplace Casio 1727 → Sharp 1279`);
    else if (!sharp) log(`- ${kit.nom} : aucune calculatrice → ajoute Sharp 1279`);
    else log(`- ${kit.nom} : Sharp 1279 déjà présente, coché = ${sharp.coche_defaut}`);

    if (APPLY) {
      if (casio) {
        const { error } = await sb
          .from("kit_items")
          .update({ produit_id: 1279, coche_defaut: true })
          .eq("id", casio.id);
        if (error) log(`  ERREUR kit ${kit.id} : ${error.message}`);
      } else if (!sharp) {
        const { data: maxOrdreRows } = await sb
          .from("kit_items")
          .select("ordre")
          .eq("kit_id", kit.id)
          .order("ordre", { ascending: false })
          .limit(1);
        const ordre = (maxOrdreRows?.[0]?.ordre ?? 0) + 1;
        const { error } = await sb.from("kit_items").insert({
          kit_id: kit.id,
          produit_id: 1279,
          quantite_defaut: 1,
          libelle_besoin: "Calculatrice",
          groupe_affichage: "Géométrie",
          section: "principal",
          coche_defaut: true,
          ordre,
        });
        if (error) log(`  ERREUR kit ${kit.id} : ${error.message}`);
      } else if (!sharp.coche_defaut) {
        await sb.from("kit_items").update({ coche_defaut: true }).eq("id", sharp.id);
      }
    }
  }
  log("");

  // ==========================================================================
  // Règle 5 — retirer des kits les 11 Didactikos "édition 2025" marqués Oui.
  // ==========================================================================
  log("## Règle 5 — retrait des Didactikos « édition 2025 » des kits\n");
  const idsDidactikos2025 = [1499, 1465, 1498, 1486, 1492, 1518, 1487, 1493, 1519, 1567, 1446];
  const { data: produitsDidactikos } = await sb.from("produits").select("id, nom").in("id", idsDidactikos2025);
  const nomParId = new Map(produitsDidactikos.map((p) => [p.id, p.nom]));
  const aRetirer = (await sb.from("kit_items").select("*").in("produit_id", idsDidactikos2025)).data;
  for (const id of idsDidactikos2025) {
    const n = aRetirer.filter((l) => l.produit_id === id).length;
    log(`- ${nomParId.get(id) ?? id} (#${id}) : retiré de ${n} kit(s)`);
  }
  log(`Total : ${aRetirer.length} ligne(s) de kit_items à supprimer.`);
  if (APPLY) {
    const { error } = await sb.from("kit_items").delete().in("produit_id", idsDidactikos2025);
    if (error) log(`  ERREUR suppression Didactikos : ${error.message}`);
  }
  log("");

  // ==========================================================================
  // Règle 6 — rapport : ordre des totaux Essentiel < Complet < Confort.
  // ==========================================================================
  log("## Règle 6 — vérification de l'ordre des prix par gamme\n");
  const groupes = new Map();
  for (const kit of kits) {
    const cle = `${kit.cycle}|${kit.niveau}`;
    if (!groupes.has(cle)) groupes.set(cle, {});
    groupes.get(cle)[kit.gamme] = kit.id;
  }
  const items = await toutesLesLignes("kit_items", "kit_id, produit_id, quantite_defaut, coche_defaut");
  const produits = await toutesLesLignes("produits", "id, prix");
  const prixParProduit = new Map(produits.map((p) => [p.id, p.prix]));
  const totalKit = (kitId) =>
    items
      .filter((i) => i.kit_id === kitId && i.coche_defaut)
      .reduce((somme, i) => somme + (prixParProduit.get(i.produit_id) ?? 0) * i.quantite_defaut, 0);

  let nbOk = 0;
  let nbAnomalies = 0;
  for (const [cle, g] of groupes) {
    if (!g.essentiel || !g.complet || !g.confort) continue;
    const tEss = totalKit(g.essentiel);
    const tComp = totalKit(g.complet);
    const tConf = totalKit(g.confort);
    const ok = tEss <= tComp && tComp <= tConf;
    if (ok) nbOk += 1;
    else {
      nbAnomalies += 1;
      log(`- ANOMALIE ${cle} : Essentiel=${tEss} / Complet=${tComp} / Confort=${tConf}`);
    }
  }
  log(`${nbOk} groupe(s) respectent Essentiel ≤ Complet ≤ Confort, ${nbAnomalies} anomalie(s).`);

  writeFileSync(`rapport-lot3-kits-${horodatage}.md`, rapport.join("\n"));
  console.log(`\nRapport écrit : rapport-lot3-kits-${horodatage}.md`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
