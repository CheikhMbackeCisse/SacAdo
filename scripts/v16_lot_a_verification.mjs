// CORRECTIONS_V16 Lot A : sauvegarde + vérifications en lecture seule.
// N'écrit rien en base (sauf les fichiers de sauvegarde JSON sur disque).
// Usage : node scripts/v16_lot_a_verification.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const FICHIER = "data/kits/SacAdo_nouveaux_kits_V2.xlsx";
const BACKUP_DIR = "backups/2026-09-30_kits_avant_V16";

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

const GROUPES_ACCEPTES = new Set([
  "Cahiers", "Écriture", "Petit matériel", "Géométrie", "Art & dessin", "Ardoise",
  "Protège-cahiers", "Papier", "Rangement", "Accessoires", "Manuels au programme",
  "Manuels scolaires", "Œuvres au programme", "Parascolaire",
  "Cahiers d'activités et compléments", "Option",
]);

async function fetchAllPages(table, select) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Lecture ${table} échouée : ${error.message}`);
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log("=== CORRECTIONS_V16 — Lot A : sauvegarde et vérifications ===\n");

  // ------------------------------------------------------------------
  // 1. Sauvegarde kits + kit_items
  // ------------------------------------------------------------------
  mkdirSync(BACKUP_DIR, { recursive: true });
  const kitsActuels = await fetchAllPages("kits", "*");
  const kitItemsActuels = await fetchAllPages("kit_items", "*");
  writeFileSync(`${BACKUP_DIR}/kits.json`, JSON.stringify(kitsActuels, null, 2));
  writeFileSync(`${BACKUP_DIR}/kit_items.json`, JSON.stringify(kitItemsActuels, null, 2));
  console.log(`1. Sauvegarde : ${kitsActuels.length} kits, ${kitItemsActuels.length} kit_items -> ${BACKUP_DIR}/`);

  // ------------------------------------------------------------------
  // 2. Trace des kits dans les commandes
  // ------------------------------------------------------------------
  // commande_items.kit_id est une colonne bigint dénormalisée (migration 0100),
  // sans contrainte de clé étrangère vers kits ni vers kit_items. Aucune table
  // ne référence kit_items par FK (seule commande_items -> kits (id) existait,
  // via kit_id, et ce n'est qu'une valeur informative, pas une FK déclarée).
  console.log(
    "\n2. Référence commandes -> kits : commande_items.kit_id est une colonne bigint " +
    "dénormalisée (migration 0100_panier_kit_groupe.sql), SANS contrainte de clé " +
    "étrangère. Aucune table ne référence kit_items par FK (seule kit_items.kit_id " +
    "référence kits.id, on delete cascade). Remplacer les kit_items d'un kit " +
    "(delete + insert, comme le fait déjà scripts/importer-kits-final.mjs) ne casse " +
    "aucune commande existante : les commandes passées gardent leur propre copie " +
    "(kit_nom, kit_classe, kit_gamme, produit_id, prix_unitaire) sur commande_items.",
  );

  // ------------------------------------------------------------------
  // Lecture du fichier Excel
  // ------------------------------------------------------------------
  const wb = XLSX.read(readFileSync(FICHIER), { type: "buffer" });
  const recap = XLSX.utils.sheet_to_json(wb.Sheets["Récap par kit"], { header: 1, defval: null });
  const contenu = XLSX.utils.sheet_to_json(wb.Sheets["Contenu des kits"], { defval: null });

  // Lignes de "Récap par kit" : en-têtes ligne 4 (index 3), données à partir de l'index 4.
  const recapLignes = recap
    .slice(4)
    .filter((r) => r[0] !== null && r[3] !== null)
    .map((r) => ({
      cycle: r[0],
      classe: r[1],
      gamme: r[2],
      kitId: r[3],
      nouveauPrix: r[5],
    }));

  const kitsParId = new Map(kitsActuels.map((k) => [k.id, k]));

  // ------------------------------------------------------------------
  // 3. Les 69 couples (Classe, Gamme) existent dans kits avec l'ID indiqué
  // ------------------------------------------------------------------
  const kitsIntrouvables = [];
  const kitsIdMismatch = [];
  for (const l of recapLignes) {
    const kit = kitsParId.get(l.kitId);
    if (!kit) {
      kitsIntrouvables.push(l);
      continue;
    }
    if (kit.niveau !== l.classe || kit.gamme !== normaliserGamme(l.gamme)) {
      kitsIdMismatch.push({ ...l, enBase: { niveau: kit.niveau, gamme: kit.gamme } });
    }
  }
  console.log(`\n3. Couples (Classe, Gamme) du Récap : ${recapLignes.length} lignes.`);
  console.log(`   - IDs introuvables en base : ${kitsIntrouvables.length}`);
  if (kitsIntrouvables.length) kitsIntrouvables.forEach((k) => console.log(`     · ${k.classe} ${k.gamme} (id attendu ${k.kitId})`));
  console.log(`   - IDs trouvés mais classe/gamme différente : ${kitsIdMismatch.length}`);
  if (kitsIdMismatch.length) kitsIdMismatch.forEach((k) => console.log(`     · id ${k.kitId} : Excel="${k.classe} ${k.gamme}" vs base="${k.enBase.niveau} ${k.enBase.gamme}"`));

  // ------------------------------------------------------------------
  // 4. Vérification des produits de l'onglet "Contenu des kits"
  // ------------------------------------------------------------------
  const produits = await fetchAllPages("produits", "id, nom, prix, statut_publication");
  const produitsParId = new Map(produits.map((p) => [p.id, p]));

  const lignesAvecProduit = contenu.filter((l) => l["Statut"] !== "MANQUE" && l["ID produit"] !== null && l["ID produit"] !== undefined);
  const lignesManque = contenu.filter((l) => l["Statut"] === "MANQUE" || l["ID produit"] === null || l["ID produit"] === undefined);

  const CODES_PROVISOIRES = new Set(["CRAIE-U", "ANGLAIS-JMD", "LAROUSSE-60"]);

  const produitsIntrouvables = [];
  const produitsNonPublies = [];
  const prixDifferents = [];
  const vus = new Set();

  for (const l of lignesAvecProduit) {
    const idBrut = l["ID produit"];
    if (CODES_PROVISOIRES.has(String(idBrut))) continue; // remplacés au lot B
    const id = Number(idBrut);
    const cle = `${id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);

    if (!Number.isFinite(id) || !produitsParId.has(id)) {
      produitsIntrouvables.push({ id: idBrut, libelle: l["Produit au catalogue"] });
      continue;
    }
    const p = produitsParId.get(id);
    if (p.statut_publication && p.statut_publication !== "publie") {
      produitsNonPublies.push({ id, nom: p.nom, statut: p.statut_publication });
    }
    const prixExcel = l["Prix unitaire"];
    if (id !== 1287 && typeof prixExcel === "number" && p.prix !== prixExcel) {
      prixDifferents.push({ id, nom: p.nom, prixBase: p.prix, prixExcel });
    }
  }

  console.log(`\n4. Produits de l'onglet Contenu des kits : ${lignesAvecProduit.length} lignes avec ID, ${lignesManque.length} lignes MANQUE (ignorées à l'import).`);
  console.log(`   - Produits introuvables en base : ${produitsIntrouvables.length}`);
  produitsIntrouvables.forEach((p) => console.log(`     · id ${p.id} — ${p.libelle}`));
  console.log(`   - Produits non publiés (hors 1509, connu) : ${produitsNonPublies.filter((p) => p.id !== 1509).length}`);
  produitsNonPublies.filter((p) => p.id !== 1509).forEach((p) => console.log(`     · ${p.id} — ${p.nom} (statut ${p.statut})`));
  console.log(`   - Produits avec prix différent (hors 1287, connu) : ${prixDifferents.length}`);
  prixDifferents.forEach((p) => console.log(`     · ${p.id} — ${p.nom} : base=${p.prixBase} excel=${p.prixExcel}`));

  // ------------------------------------------------------------------
  // 5. Groupes d'affichage
  // ------------------------------------------------------------------
  const groupesExcel = new Set(contenu.map((l) => l["Groupe d'affichage"]).filter(Boolean));
  const groupesManquants = [...groupesExcel].filter((g) => !GROUPES_ACCEPTES.has(g));
  console.log(`\n5. Groupes d'affichage rencontrés dans l'Excel : ${groupesExcel.size}.`);
  console.log(`   - Hors liste fermée fournie : ${groupesManquants.length}`);
  groupesManquants.forEach((g) => console.log(`     · "${g}"`));

  console.log("\n=== Fin Lot A (lecture seule, rien écrit en base) ===");
}

function normaliserGamme(g) {
  return String(g).toLowerCase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
