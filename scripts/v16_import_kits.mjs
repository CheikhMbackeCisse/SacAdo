// CORRECTIONS_V16 Lot C : import du contenu des 69 kits depuis l'onglet
// "Contenu des kits" de SacAdo_nouveaux_kits_V2.xlsx. Dry-run par défaut,
// --apply pour écrire. Remplace kit_items par kit (delete + insert) via la
// fonction Postgres remplacer_kit_items (migration 0101, transaction par kit).
//
// Contrôle bloquant avant toute écriture : pour chaque kit, la somme des
// lignes "principal" cochées (prix produit en base × quantité) doit être
// égale au "Nouveau prix" de l'onglet Récap par kit. Le moindre écart arrête
// l'import complet (rien n'est écrit) — cohérent avec CORRECTIONS_V16.md §C4.
//
// Usage : node scripts/v16_import_kits.mjs [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;
const FICHIER = "data/kits/SacAdo_nouveaux_kits_V2.xlsx";
const CORRESPONDANCE = "data/kits/v16_nouveaux_produits.json";

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

const SECTION_PAR_LIBELLE = {
  Principal: "principal",
  "Livres proposés": "livres_proposes",
  Option: "option",
};

const PRODUIT_GEOMETRIE_V16 = 1229; // "Boite instruments Marshal Mathematical Instruments"

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
  console.log(`=== CORRECTIONS_V16 — Lot C : import des kits ${DRY_RUN ? "(dry-run)" : "(APPLY)"} ===\n`);

  const correspondance = JSON.parse(readFileSync(CORRESPONDANCE, "utf8"));
  const wb = XLSX.read(readFileSync(FICHIER), { type: "buffer" });
  const recapRows = XLSX.utils.sheet_to_json(wb.Sheets["Récap par kit"], { header: 1, defval: null });
  const contenu = XLSX.utils.sheet_to_json(wb.Sheets["Contenu des kits"], { defval: null });

  const recapLignes = recapRows
    .slice(4)
    .filter((r) => r[0] !== null && r[3] !== null)
    .map((r) => ({
      cycle: r[0],
      classe: r[1],
      gamme: r[2],
      kitId: r[3],
      prixActuel: r[4],
      nouveauPrix: r[5],
      articlesCochesNouveau: r[7],
      articlesCochesActuel: r[8],
      articlesManquants: r[9],
    }));

  const produits = await fetchAllPages("produits", "id, nom, prix, photo");
  const produitsParId = new Map(produits.map((p) => [p.id, p]));

  const kitsActuels = await fetchAllPages("kits", "id, niveau, gamme, ordre_gamme, images_mosaique");
  const kitsParId = new Map(kitsActuels.map((k) => [k.id, k]));

  const kitItemsActuels = await fetchAllPages("kit_items", "id, kit_id, produit_id, groupe_affichage");
  const anciensItemsParKit = new Map();
  for (const it of kitItemsActuels) {
    if (!anciensItemsParKit.has(it.kit_id)) anciensItemsParKit.set(it.kit_id, []);
    anciensItemsParKit.get(it.kit_id).push(it);
  }

  function resoudreProduitId(valeur) {
    if (correspondance[valeur] !== undefined) return correspondance[valeur];
    const n = Number(valeur);
    return Number.isFinite(n) ? n : null;
  }

  // ------------------------------------------------------------------
  // Groupement des lignes de contenu par (cycle, classe, gamme)
  // ------------------------------------------------------------------
  const contenuParCle = new Map();
  for (const ligne of contenu) {
    const cle = `${ligne["Cycle"]}||${ligne["Classe"]}||${ligne["Gamme"]}`;
    if (!contenuParCle.has(cle)) contenuParCle.set(cle, []);
    contenuParCle.get(cle).push(ligne);
  }

  const rapportParKit = [];
  const erreursBloquantes = [];

  for (const recapLigne of recapLignes) {
    const cle = `${recapLigne.cycle}||${recapLigne.classe}||${recapLigne.gamme}`;
    const lignesSource = contenuParCle.get(cle) ?? [];
    const kit = kitsParId.get(recapLigne.kitId);
    if (!kit) {
      erreursBloquantes.push(`Kit #${recapLigne.kitId} (${recapLigne.classe} ${recapLigne.gamme}) introuvable en base.`);
      continue;
    }

    const itemsAInserer = [];
    let lignesManqueIgnorees = 0;
    const erreursKit = [];

    for (const ligne of lignesSource) {
      const idBrut = ligne["ID produit"];
      const statut = ligne["Statut"];
      if (statut === "MANQUE" || idBrut === null || idBrut === undefined) {
        lignesManqueIgnorees++;
        continue;
      }
      const produitId = resoudreProduitId(idBrut);
      if (produitId === null || !produitsParId.has(produitId)) {
        erreursKit.push(`produit introuvable "${idBrut}" (${ligne["Produit au catalogue"]})`);
        continue;
      }
      const section = SECTION_PAR_LIBELLE[ligne["Section"]];
      if (!section) {
        erreursKit.push(`section inconnue "${ligne["Section"]}" pour ${ligne["Produit au catalogue"]}`);
        continue;
      }
      itemsAInserer.push({
        produit_id: produitId,
        quantite_defaut: ligne["Quantité"],
        libelle_besoin: ligne["Libellé (vu par le client)"],
        groupe_affichage: ligne["Groupe d'affichage"],
        section,
        coche_defaut: ligne["Coché"] === "Oui",
        ordre: ligne["Ordre"],
      });
    }

    // Contrôle §C4 : total des lignes principal cochées (prix DB × quantité)
    // doit égaler la colonne F (Nouveau prix) du Récap.
    const totalPrincipalCoche = itemsAInserer
      .filter((it) => it.section === "principal" && it.coche_defaut)
      .reduce((somme, it) => somme + (produitsParId.get(it.produit_id)?.prix ?? 0) * it.quantite_defaut, 0);

    const ecartPrix = totalPrincipalCoche - recapLigne.nouveauPrix;
    if (ecartPrix !== 0) {
      erreursKit.push(
        `écart de prix : recalcul=${totalPrincipalCoche} F vs Récap="Nouveau prix"=${recapLigne.nouveauPrix} F (écart ${ecartPrix > 0 ? "+" : ""}${ecartPrix} F)`,
      );
    }

    if (erreursKit.length > 0) {
      erreursBloquantes.push(`Kit #${recapLigne.kitId} — ${recapLigne.classe} ${recapLigne.gamme} :\n   - ${erreursKit.join("\n   - ")}`);
    }

    // §C6 : mosaïque d'images — remplace l'ancien produit "Géométrie" par 1229.
    const ancienGeo = (anciensItemsParKit.get(recapLigne.kitId) ?? []).find(
      (it) => it.groupe_affichage === "Géométrie",
    );
    let nouvelleMosaique = null;
    let noteMosaique = "inchangée (pas de ligne Géométrie dans l'ancien contenu)";
    if (ancienGeo) {
      const geoAToujoursPhoto = produitsParId.get(PRODUIT_GEOMETRIE_V16)?.photo;
      const ancienneMosaique = kit.images_mosaique ?? [];
      if (ancienneMosaique.includes(ancienGeo.produit_id)) {
        if (geoAToujoursPhoto) {
          nouvelleMosaique = ancienneMosaique.map((id) => (id === ancienGeo.produit_id ? PRODUIT_GEOMETRIE_V16 : id));
          // dédup en conservant l'ordre
          nouvelleMosaique = [...new Set(nouvelleMosaique)];
          noteMosaique = `${ancienGeo.produit_id} -> ${PRODUIT_GEOMETRIE_V16} (${ancienneMosaique.join(",")} -> ${nouvelleMosaique.join(",")})`;
        } else {
          noteMosaique = `1229 SANS PHOTO : mosaïque laissée telle quelle (${ancienneMosaique.join(",")})`;
        }
      } else {
        noteMosaique = `ancien produit géométrie (${ancienGeo.produit_id}) absent de la mosaïque actuelle (${ancienneMosaique.join(",")}) : rien à remplacer`;
      }
    }

    rapportParKit.push({
      kitId: recapLigne.kitId,
      classe: recapLigne.classe,
      gamme: recapLigne.gamme,
      lignesAvant: (anciensItemsParKit.get(recapLigne.kitId) ?? []).length,
      lignesApres: itemsAInserer.length,
      prixAvant: recapLigne.prixActuel,
      prixApres: totalPrincipalCoche,
      nouveauPrixAttendu: recapLigne.nouveauPrix,
      ecartPrix,
      lignesManqueIgnorees,
      items: itemsAInserer,
      nouvelleMosaique,
      noteMosaique,
      erreurs: erreursKit,
    });
  }

  // ------------------------------------------------------------------
  // Ordre des gammes (Essentiel < Complet < Confort) dans chaque classe
  // ------------------------------------------------------------------
  const ordreAttendu = { essentiel: 1, complet: 2, confort: 3 };
  const ordreKo = [];
  const parNiveau = new Map();
  for (const l of recapLignes) {
    if (!parNiveau.has(l.classe)) parNiveau.set(l.classe, []);
    const k = kitsParId.get(l.kitId);
    if (k) parNiveau.get(l.classe).push({ gamme: k.gamme, ordre: k.ordre_gamme });
  }
  for (const [classe, gammes] of parNiveau) {
    for (const g of gammes) {
      if (g.ordre !== ordreAttendu[g.gamme]) {
        ordreKo.push(`${classe} — gamme ${g.gamme} : ordre_gamme=${g.ordre} (attendu ${ordreAttendu[g.gamme]})`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Rapport
  // ------------------------------------------------------------------
  console.log(`${rapportParKit.length}/${recapLignes.length} kits traités.\n`);
  for (const r of rapportParKit) {
    const statutPrix = r.ecartPrix === 0 ? "OK" : `ÉCART ${r.ecartPrix > 0 ? "+" : ""}${r.ecartPrix} F`;
    console.log(
      `#${r.kitId} ${r.classe} ${r.gamme} : lignes ${r.lignesAvant} -> ${r.lignesApres} (${r.lignesManqueIgnorees} MANQUE ignorées), ` +
      `prix ${r.prixAvant} F -> ${r.prixApres} F [${statutPrix}] — mosaïque : ${r.noteMosaique}`,
    );
    if (r.erreurs.length) r.erreurs.forEach((e) => console.log(`   ! ${e}`));
  }

  console.log(`\nOrdre des gammes (Essentiel < Complet < Confort) : ${ordreKo.length === 0 ? "OK sur les 69 kits" : `${ordreKo.length} écarts`}`);
  ordreKo.forEach((e) => console.log(`   ! ${e}`));

  console.log(`\nKits en erreur bloquante : ${erreursBloquantes.length}`);
  erreursBloquantes.forEach((e) => console.log(`- ${e}`));

  if (erreursBloquantes.length > 0) {
    console.log("\n=== Import arrêté : au moins un écart de prix ou une erreur de résolution. Rien n'est écrit. ===");
    if (APPLY) process.exit(1);
    console.log("(dry-run — ceci n'aurait rien écrit de toute façon)");
    return;
  }

  if (DRY_RUN) {
    console.log("\n=== Fin Lot C dry-run — tous les kits passent le contrôle de prix. Rien n'a été écrit en base. ===");
    return;
  }

  // ------------------------------------------------------------------
  // Écriture
  // ------------------------------------------------------------------
  let kitsEcrits = 0;
  let lignesInserees = 0;
  const erreursEcriture = [];
  for (const r of rapportParKit) {
    const { error } = await supabase.rpc("remplacer_kit_items", {
      p_kit_id: r.kitId,
      p_items: r.items,
    });
    if (error) {
      erreursEcriture.push(`#${r.kitId} ${r.classe} ${r.gamme} : ${error.message}`);
      continue;
    }
    if (r.nouvelleMosaique) {
      const { error: errMosaique } = await supabase
        .from("kits")
        .update({ images_mosaique: r.nouvelleMosaique })
        .eq("id", r.kitId);
      if (errMosaique) erreursEcriture.push(`#${r.kitId} mosaïque : ${errMosaique.message}`);
    }
    kitsEcrits++;
    lignesInserees += r.items.length;
    console.log(`✓ #${r.kitId} ${r.classe} ${r.gamme} : ${r.items.length} lignes écrites`);
  }

  console.log(`\n${kitsEcrits}/${rapportParKit.length} kits écrits, ${lignesInserees} lignes kit_items insérées.`);
  if (erreursEcriture.length) {
    console.log(`\nErreurs d'écriture (${erreursEcriture.length}) :`);
    erreursEcriture.forEach((e) => console.log(`- ${e}`));
  }

  writeFileSync(
    "rapport-import-kits-v16.json",
    JSON.stringify(rapportParKit.map(({ items, ...rest }) => rest), null, 2),
  );
  console.log("\nRapport écrit : rapport-import-kits-v16.json");

  console.log("\n=== Fin Lot C ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
