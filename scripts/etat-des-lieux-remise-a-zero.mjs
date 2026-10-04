// PROMPT_ADMIN_COMPTA_LOCALITES.md — Lot 1, étape 1 : état des lieux (LECTURE SEULE).
// Liste toutes les commandes et tout ce qui alimente la comptabilité et les
// statistiques, pour décider ce qui sera marqué "test" avant toute écriture.
// Usage : node scripts/etat-des-lieux-remise-a-zero.mjs
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

function fcfa(n) {
  return `${Math.round(n ?? 0).toLocaleString("fr-FR")} FCFA`;
}

async function main() {
  console.log("=== ÉTAT DES LIEUX — remise à zéro comptabilité (sauf commande #28) ===\n");

  // ---------------------------------------------------------------- commandes
  const { data: commandes, error: errC } = await supabase
    .from("commandes")
    .select("id, client_id, statut, statut_paiement, mode_paiement, total, date, zone_id, localite_id, lieu_special_id")
    .order("id", { ascending: true });
  if (errC) {
    console.error("Erreur lecture commandes:", errC.message);
    process.exit(1);
  }

  const aGarder = commandes.filter((c) => c.id === COMMANDE_A_GARDER);
  const aMarquerTest = commandes.filter((c) => c.id !== COMMANDE_A_GARDER);

  console.log(`Total commandes en base : ${commandes.length}`);
  console.log(`  - à garder (hors remise à zéro) : ${aGarder.length} -> #${aGarder.map((c) => c.id).join(", ")}`);
  console.log(`  - à marquer "test" : ${aMarquerTest.length}`);
  console.log(
    `    somme totale de leurs champs "total" (indicatif, inclut non-encaissées) : ${fcfa(
      aMarquerTest.reduce((s, c) => s + c.total, 0),
    )}`,
  );
  const parStatut = new Map();
  for (const c of aMarquerTest) parStatut.set(c.statut, (parStatut.get(c.statut) ?? 0) + 1);
  console.log("    par statut :", Object.fromEntries(parStatut));
  const parPaiement = new Map();
  for (const c of aMarquerTest) {
    const cle = `${c.mode_paiement}/${c.statut_paiement ?? "null"}`;
    parPaiement.set(cle, (parPaiement.get(cle) ?? 0) + 1);
  }
  console.log("    par mode_paiement/statut_paiement :", Object.fromEntries(parPaiement));

  if (aGarder.length > 0) {
    const c28 = aGarder[0];
    console.log(
      `\nCommande #28 (à garder) : statut=${c28.statut} statut_paiement=${c28.statut_paiement} mode_paiement=${c28.mode_paiement} total=${fcfa(c28.total)} date=${c28.date}`,
    );
  } else {
    console.log("\n⚠ Commande #28 introuvable en base !");
  }

  // ------------------------------------------------------------ commande_items
  const idsTest = aMarquerTest.map((c) => c.id);
  const { count: nbItemsTest } = idsTest.length
    ? await supabase.from("commande_items").select("id", { count: "exact", head: true }).in("commande_id", idsTest)
    : { count: 0 };
  const { count: nbItemsTotal } = await supabase
    .from("commande_items")
    .select("id", { count: "exact", head: true });
  console.log(`\ncommande_items : ${nbItemsTotal} au total, dont ${nbItemsTest} liés à une commande de test.`);

  const { data: itemsReverses } = idsTest.length
    ? await supabase
        .from("commande_items")
        .select("id, commande_id, produit_id, reverse_le")
        .in("commande_id", idsTest)
        .not("reverse_le", "is", null)
    : { data: [] };
  console.log(
    `  dont ${itemsReverses?.length ?? 0} ligne(s) déjà marquée(s) "reverse_le" (reversement vendeur) sur des commandes de test.`,
  );

  // ------------------------------------------------------------------ stocks
  // Impact potentiel sur le stock : on ne détecte pas ici de mouvement de
  // stock dédié (il n'y a pas de table de mouvements de stock ; le stock est
  // décrémenté directement dans produits.stock / produit_variantes.stock au
  // moment de creer_commande(), et jamais recrédité automatiquement).
  const commandesAyantReserveStock = aMarquerTest.filter((c) => c.statut !== "annulee");
  console.log(
    `\nStock : ${commandesAyantReserveStock.length} commande(s) de test sur ${aMarquerTest.length} ont décrémenté du stock à la création`,
    "(aucune table de mouvements de stock séparée ; pas touché sans accord explicite — voir rapport).",
  );

  // -------------------------------------------------------------- dépenses
  const { data: depenses, error: errD } = await supabase.from("depenses").select("id, categorie, montant, date, note");
  if (errD) console.error("Erreur lecture dépenses:", errD.message);
  console.log(
    `\ndepenses (saisies manuelles pendant les tests) : ${depenses?.length ?? 0} ligne(s), total ${fcfa(
      (depenses ?? []).reduce((s, d) => s + d.montant, 0),
    )}`,
  );

  // ------------------------------------------------------------- wave_evenements
  const { count: nbWaveEvt } = await supabase
    .from("wave_evenements")
    .select("event_id", { count: "exact", head: true });
  const { data: waveEvtTest } = idsTest.length
    ? await supabase.from("wave_evenements").select("event_id, commande_id").in("commande_id", idsTest)
    : { data: [] };
  console.log(
    `\nwave_evenements : ${nbWaveEvt} au total, dont ${waveEvtTest?.length ?? 0} liés à une commande de test.`,
  );

  // ------------------------------------------------------- demandes_preparation
  const { count: nbPrepaTotal } = await supabase
    .from("demandes_preparation")
    .select("id", { count: "exact", head: true });
  console.log(`\ndemandes_preparation : ${nbPrepaTotal ?? 0} au total (file de préparation fournisseur).`);

  // ------------------------------------------------------------------ messages
  const { count: nbMessagesTotal } = await supabase.from("messages").select("id", { count: "exact", head: true });
  console.log(
    `messages (boîte de réception client) : ${nbMessagesTotal ?? 0} au total — générés automatiquement à chaque`,
    "changement de statut de commande ; seront masqués avec la commande de test.",
  );

  // --------------------------------------------------------------- commissions
  const { data: vendeursConcernes } = idsTest.length
    ? await supabase
        .from("commande_items")
        .select("produit_id, produits(vendeur_id)")
        .in("commande_id", idsTest)
    : { data: [] };
  const vendeurIds = new Set(
    (vendeursConcernes ?? [])
      .map((r) => r.produits?.vendeur_id)
      .filter((v) => v),
  );
  console.log(`\nVendeurs marketplace référencés par des commandes de test : ${vendeurIds.size}`);

  console.log("\n=== FIN DU RAPPORT — en attente de validation avant toute écriture ===");
}

main();
