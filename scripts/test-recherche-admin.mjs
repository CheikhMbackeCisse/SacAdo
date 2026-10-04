// PROMPT_ADMIN_KITS_PRODUITS.md, lot 1, point 4 : test obligatoire — tous les
// produits visibles côté client doivent être trouvés par la recherche admin
// avec leur nom exact. Reproduit exactement la requête de
// rechercherProduitsAdmin()/getProduitsAdminPage() (lib/admin/produits-actions.ts) :
// id exact si numérique, sinon mot par mot sur recherche_texte OU marque.
// Usage : node scripts/test-recherche-admin.mjs
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

async function rechercher(terme, limite = 300) {
  const base = () => supabase.from("produits").select("id, nom").order("nom", { ascending: true }).limit(limite);
  if (/^\d+$/.test(terme)) {
    const { data, error } = await base().eq("id", Number(terme));
    if (error) throw error;
    return data ?? [];
  }
  const { data: normalise } = await supabase.rpc("normaliser_recherche", { texte: terme });
  const mots = (normalise ?? terme.toLowerCase()).split(/\s+/).filter(Boolean);
  const appliquer = async (colonne) => {
    let q = base();
    for (const mot of mots) q = q.ilike(colonne, `%${mot}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  };
  const [parTexte, parMarque] = await Promise.all([appliquer("recherche_texte"), appliquer("marque")]);
  const fusion = new Map();
  for (const p of [...parTexte, ...parMarque]) fusion.set(p.id, p);
  return [...fusion.values()];
}

async function toutesLesLignes(construireRequete) {
  const taille = 1000;
  let offset = 0;
  let toutes = [];
  for (;;) {
    const { data, error } = await construireRequete().range(offset, offset + taille - 1);
    if (error) throw error;
    toutes = toutes.concat(data ?? []);
    if (!data || data.length < taille) break;
    offset += taille;
  }
  return toutes;
}

async function main() {
  const visibles = await toutesLesLignes(() =>
    supabase.from("produits").select("id, nom").eq("statut_publication", "publie").order("id", { ascending: true }),
  );

  console.log(`${visibles.length} produit(s) visible(s) côté client (statut_publication = publie).\n`);

  const echecs = [];
  const erreurs = [];
  const CONCURRENCE = 25;
  for (let i = 0; i < visibles.length; i += CONCURRENCE) {
    const lot = visibles.slice(i, i + CONCURRENCE);
    await Promise.all(
      lot.map(async (p) => {
        try {
          const resultats = await rechercher(p.nom);
          const trouve = resultats.some((r) => r.id === p.id);
          if (!trouve) echecs.push(p);
        } catch (e) {
          erreurs.push({ ...p, message: e.message });
        }
      }),
    );
    if ((i / CONCURRENCE) % 10 === 0) console.log(`  ... ${Math.min(i + CONCURRENCE, visibles.length)}/${visibles.length}`);
  }

  const trouves = visibles.length - echecs.length - erreurs.length;
  const taux = ((trouves / visibles.length) * 100).toFixed(2);
  console.log(`Résultat : ${trouves} / ${visibles.length} trouvés (${taux} %).\n`);

  if (erreurs.length > 0) {
    console.log(`${erreurs.length} erreur(s) de requête :`);
    erreurs.forEach((p) => console.log(`   #${p.id} "${p.nom}" — ${p.message}`));
  }
  if (echecs.length > 0) {
    console.log(`${echecs.length} échec(s) :`);
    echecs.forEach((p) => console.log(`   #${p.id} "${p.nom}"`));
  }
  if (echecs.length === 0 && erreurs.length === 0) {
    console.log("100 % — tous les produits visibles sont trouvés par leur nom exact.");
  }

  console.log("\n--- Tests manuels demandés ---");
  for (const terme of ["livre parlant", "forever cultivate", "karbi", "si longue lettre", "robert", "1726"]) {
    const resultats = await rechercher(terme, 10);
    console.log(`\n"${terme}" -> ${resultats.length} résultat(s)`);
    resultats.slice(0, 6).forEach((r) => console.log(`   #${r.id} ${r.nom}`));
  }
}

main();
