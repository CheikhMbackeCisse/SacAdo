// CORRECTIONS_V16 (cahiers préscolaire / éponges) — Lot 1.
// Dry-run par défaut, --apply pour écrire. Sauvegarde kit_items avant d'écrire.
//
// A. Préscolaire (9 kits) : retire les lignes produit 1618 (cahier 96p) et 1286
//    (cahier de dessin TPG), pose/maj 1575 (cahier 48p, groupe Cahiers) et 1572
//    (cahier de dessin 32p, groupe Art & dessin) avec les quantités par classe.
//    Garde tout le reste du kit tel quel (TP 100/200p, ardoise, crayons...).
// B. Éponges : remplace le produit 1224 par 1202 dans tous les kits préscolaire
//    + élémentaire. État constaté au 2026-09-30 : 1224 n'est déjà utilisé dans
//    AUCUN des 27 kits (l'élémentaire utilise déjà 1202 "Éponge pour ardoise").
//    Ce lot n'a donc rien à écrire pour B — juste une vérification, loggée.
//
// Usage : node scripts/corriger-kits-v16.mjs [--apply]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

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

const PRODUIT_1618 = 1618; // Cahier 96 pages petit format — à retirer du préscolaire
const PRODUIT_1286 = 1286; // Cahier de dessin TPG — à retirer du préscolaire
const PRODUIT_1575 = 1575; // Cahier L'écolier 48 pages
const PRODUIT_1572 = 1572; // Cahier de dessin L'écolier 32 pages
const PRODUIT_1224 = 1224; // Eponge Expanding Sponge (à remplacer par 1202 s'il apparaît)
const PRODUIT_1202 = 1202; // Boîte à éponge

const QUANTITES = {
  "Petite section": { 1575: 1, 1572: 1 },
  "Moyenne section": { 1575: 2, 1572: 1 },
  "Grande section": { 1575: 3, 1572: 2 },
};

async function fetchAllPages(table, select, filter) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = supabase.from(table).select(select).order("id", { ascending: true }).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`Lecture ${table} échouée : ${error.message}`);
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log(`=== CORRECTIONS_V16 — Lot 1 ${DRY_RUN ? "(dry-run)" : "(APPLY)"} ===\n`);

  const kits = await fetchAllPages("kits", "id, cycle, niveau, gamme, ordre_gamme, statut");
  const prescoKits = kits.filter((k) => k.cycle === "prescolaire");
  const prescoElemKits = kits.filter((k) => k.cycle === "prescolaire" || k.cycle === "elementaire");

  const produits = await fetchAllPages("produits", "id, nom, statut_publication", (q) =>
    q.in("id", [PRODUIT_1618, PRODUIT_1286, PRODUIT_1575, PRODUIT_1572, PRODUIT_1224, PRODUIT_1202]),
  );
  const produitsParId = new Map(produits.map((p) => [p.id, p]));

  const p1202 = produitsParId.get(PRODUIT_1202);
  console.log(
    `Vérification 1202 « ${p1202?.nom} » : statut_publication=${p1202?.statut_publication} ${
      p1202?.statut_publication === "publie" ? "OK" : "!! PAS PUBLIÉ"
    }\n`,
  );

  // ------------------------------------------------------------------
  // Partie B — éponges (1224 -> 1202) sur préscolaire + élémentaire
  // ------------------------------------------------------------------
  const itemsElemPresco = await fetchAllPages("kit_items", "*", (q) =>
    q.in("kit_id", prescoElemKits.map((k) => k.id)),
  );
  const lignes1224 = itemsElemPresco.filter((it) => it.produit_id === PRODUIT_1224);
  console.log(`Partie B — lignes utilisant le produit 1224 dans les 27 kits préscolaire+élémentaire : ${lignes1224.length}`);
  if (lignes1224.length === 0) {
    console.log("  -> Rien à remplacer : aucun kit n'utilise encore 1224 (l'élémentaire utilise déjà 1202 « Éponge pour ardoise »).\n");
  } else {
    lignes1224.forEach((it) => console.log(`  - kit_item #${it.id} kit_id=${it.kit_id}`));
  }

  const b1224Updates = lignes1224.map((it) => ({
    id: it.id,
    kit_id: it.kit_id,
    avant: { produit_id: it.produit_id, libelle_besoin: it.libelle_besoin },
    apres: { produit_id: PRODUIT_1202, libelle_besoin: "Éponge", quantite_defaut: 1 },
  }));

  // ------------------------------------------------------------------
  // Partie A — cahiers préscolaire (9 kits)
  // ------------------------------------------------------------------
  const itemsPresco = await fetchAllPages("kit_items", "*", (q) => q.in("kit_id", prescoKits.map((k) => k.id)));
  const itemsParKit = new Map();
  for (const it of itemsPresco) {
    if (!itemsParKit.has(it.kit_id)) itemsParKit.set(it.kit_id, []);
    itemsParKit.get(it.kit_id).push(it);
  }

  const rapportA = [];
  for (const kit of prescoKits.sort((a, b) => a.id - b.id)) {
    const quantites = QUANTITES[kit.niveau];
    if (!quantites) {
      console.log(`!! Classe inconnue pour le kit #${kit.id} : "${kit.niveau}" — ignoré`);
      continue;
    }
    const items = itemsParKit.get(kit.id) ?? [];

    const existant1575 = items.find((it) => it.produit_id === PRODUIT_1575);
    const existant1572 = items.find((it) => it.produit_id === PRODUIT_1572);

    // Ordre : on récupère la place du produit retiré du groupe Cahiers (1618) pour 1575,
    // sinon on garde l'ordre existant de 1572/1286, sinon 1 et 3 par défaut.
    const ancien1618 = items.find((it) => it.produit_id === PRODUIT_1618);
    const ancienDessin = items.find((it) => it.produit_id === PRODUIT_1286 || it.produit_id === PRODUIT_1572);
    const ordre1575 = existant1575?.ordre ?? ancien1618?.ordre ?? 1;
    const ordre1572 = existant1572?.ordre ?? ancienDessin?.ordre ?? 2;

    const opDelete = items.filter(
      (it) =>
        it.produit_id === PRODUIT_1618 ||
        it.produit_id === PRODUIT_1286 ||
        it.produit_id === PRODUIT_1575 ||
        it.produit_id === PRODUIT_1572,
    );

    const ligne1575 = {
      produit_id: PRODUIT_1575,
      quantite_defaut: quantites[1575],
      libelle_besoin: "Cahier 48 pages",
      groupe_affichage: "Cahiers",
      section: "principal",
      coche_defaut: true,
      ordre: ordre1575,
    };
    const ligne1572 = {
      produit_id: PRODUIT_1572,
      quantite_defaut: quantites[1572],
      libelle_besoin: "Cahier de dessin 32 pages",
      groupe_affichage: "Art & dessin",
      section: "principal",
      coche_defaut: true,
      ordre: ordre1572,
    };

    rapportA.push({
      kitId: kit.id,
      niveau: kit.niveau,
      gamme: kit.gamme,
      lignesSupprimees: opDelete.map((it) => ({ id: it.id, produit_id: it.produit_id, libelle: it.libelle_besoin, qte: it.quantite_defaut })),
      lignesAjoutees: [ligne1575, ligne1572],
    });
  }

  console.log("=== Partie A — préscolaire : rapport avant / après (9 kits) ===\n");
  for (const r of rapportA) {
    console.log(`Kit #${r.kitId} — ${r.niveau} ${r.gamme}`);
    console.log(`  Supprime : ${r.lignesSupprimees.map((l) => `produit ${l.produit_id} (${l.libelle}, qte ${l.qte})`).join(", ") || "(rien)"}`);
    console.log(`  Ajoute   : ${r.lignesAjoutees.map((l) => `produit ${l.produit_id} "${l.libelle_besoin}" qte ${l.quantite_defaut}`).join(", ")}`);
  }

  if (DRY_RUN) {
    console.log("\n=== Dry-run — rien n'a été écrit en base. Relance avec --apply pour écrire. ===");
    return;
  }

  // ------------------------------------------------------------------
  // Écriture
  // ------------------------------------------------------------------
  mkdirSync("backups", { recursive: true });
  const horodatage = new Date().toISOString().slice(0, 10);
  writeFileSync(
    `backups/kit_items_avant_v16_${horodatage}.json`,
    JSON.stringify({ prescoElem: itemsElemPresco }, null, 2),
  );
  console.log(`\nSauvegarde écrite : backups/kit_items_avant_v16_${horodatage}.json`);

  let erreurs = 0;

  // B. remplacement 1224 -> 1202
  for (const u of b1224Updates) {
    const { error } = await supabase
      .from("kit_items")
      .update({ produit_id: u.apres.produit_id, libelle_besoin: u.apres.libelle_besoin, quantite_defaut: u.apres.quantite_defaut })
      .eq("id", u.id);
    if (error) {
      console.log(`!! Échec MAJ éponge kit_item #${u.id} : ${error.message}`);
      erreurs++;
    } else {
      console.log(`✓ Éponge remplacée sur kit #${u.kit_id} (kit_item #${u.id})`);
    }
  }

  // A. cahiers préscolaire
  for (const r of rapportA) {
    for (const l of r.lignesSupprimees) {
      const { error } = await supabase.from("kit_items").delete().eq("id", l.id);
      if (error) {
        console.log(`!! Échec suppression kit_item #${l.id} (kit #${r.kitId}) : ${error.message}`);
        erreurs++;
      }
    }
    for (const l of r.lignesAjoutees) {
      const { error } = await supabase.from("kit_items").insert({ kit_id: r.kitId, ...l });
      if (error) {
        console.log(`!! Échec insertion produit ${l.produit_id} sur kit #${r.kitId} : ${error.message}`);
        erreurs++;
      }
    }
    console.log(`✓ Kit #${r.kitId} (${r.niveau} ${r.gamme}) mis à jour`);
  }

  console.log(`\n=== Fin Lot 1 — ${erreurs === 0 ? "aucune erreur" : `${erreurs} erreur(s)`} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
