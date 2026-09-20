// Import du catalogue LPD (PROMPT_integration_LPD.md) : papeterie
// d'entrée de gamme + livres/manuels sourcés via LPD.
// Usage : node scripts/importer-lpd.mjs
// Prérequis : migration 0083 déjà exécutée en base. Lit .env.local. Idempotent
// par (vendeur_id, reference_fournisseur) — relancer après une coupure ne
// recrée jamais un article déjà importé (index unique posé par 0083).
//
// Sources : manifest_lpd.json, produit par scratchpad/build_manifest.py à
// partir des 3 classeurs fournis (LPD_grille_complete.xlsx, SacAdo_livres_LPD.xlsx,
// SacAdo_livres_prix.xlsx). Aucune photo importée : les vignettes intégrées aux
// deux fichiers (grille ET livres) ne font que 95 px de large réellement (la
// colonne "Largeur photo" du fichier livres se réfère à une source externe non
// fournie, pas à la vignette Excel) — sous le plancher de 400 px, donc écartées
// pour ne pas répéter l'erreur des vignettes étirées (§ Règles d'import n°6).
// Tous les articles entrent donc `en_attente`, sans photo : la garde de
// publication (lib/admin/produits-actions.ts) bloque déjà leur mise en ligne
// tant qu'une vraie photo n'a pas été ajoutée à la main.
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MANIFEST = process.env.MANIFEST ?? "C:\\Users\\WORLD INFORMATIQUE\\Downloads\\integration_lpd_extracted\\manifest_lpd.json";
const RAPPORT = "rapport_import_lpd.md";

const VENDEUR_NOM = "LPD";
const DELAI = "6j"; // sourcé à la demande, comme les autres imports fournisseur récents.

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

async function assurerVendeurLPD() {
  const { data: existant, error } = await supabase
    .from("vendeurs")
    .select("id")
    .ilike("nom_boutique", VENDEUR_NOM)
    .maybeSingle();
  if (error) throw new Error(`Lecture vendeur échouée : ${error.message}`);
  if (existant) return existant.id;

  const { data: cree, error: errCreation } = await supabase
    .from("vendeurs")
    .insert({ nom_boutique: VENDEUR_NOM, user_id: null, actif: true })
    .select("id")
    .single();
  if (errCreation || !cree) throw new Error(`Création du vendeur LPD échouée : ${errCreation?.message}`);
  console.log(`✓ fournisseur créé : ${VENDEUR_NOM} (#${cree.id})`);
  return cree.id;
}

// Construit la ligne `produits` commune aux trois sources du manifest.
function construireLigne(item, vendeurId) {
  return {
    nom: item.nom,
    categorie_id: item.categorie_id,
    sous_categorie_id: item.sous_categorie_id ?? null,
    prix: item.prix,
    prix_achat: item.prix_achat ?? null,
    prix_achat_previsionnel: item.prix_achat_previsionnel ?? false,
    prix_a_verifier: item.prix_a_verifier ?? false,
    delai: DELAI,
    photo: null,
    stock: 0,
    statut: "dispo",
    statut_publication: "en_attente",
    publie_par: "admin",
    vendeur_id: vendeurId,
    reference_fournisseur: item.reference_fournisseur,
    gamme: "essentiel",
    unite_vente: "inconnu",
    mots_cles: item.mots_cles ?? null,
    auteur: item.auteur ?? null,
    editeur: item.editeur ?? null,
    type_ouvrage: item.type_ouvrage ?? null,
    niveau: item.niveau ?? null,
  };
}

// Livres = unité de vente sans ambiguïté possible (jamais vendus au paquet).
// Papeterie = conditionnement non confirmé dans ce lot -> reste "inconnu"
// (§ Le piège du conditionnement : ne jamais déduire d'un prix).
function uniteVente(source) {
  return source === "grille" ? "inconnu" : "unite";
}

async function importerLot(items, source, vendeurId, journal) {
  let crees = 0;
  let ignores = 0;
  for (const item of items) {
    const { data: existant, error: errLecture } = await supabase
      .from("produits")
      .select("id")
      .eq("vendeur_id", vendeurId)
      .eq("reference_fournisseur", item.reference_fournisseur)
      .maybeSingle();
    if (errLecture) throw new Error(`Lecture échouée (${item.reference_fournisseur}) : ${errLecture.message}`);

    if (existant) {
      console.log(`= déjà présent, ignoré : ${item.reference_fournisseur} — ${item.nom}`);
      ignores++;
      continue;
    }

    const ligne = construireLigne(item, vendeurId);
    ligne.unite_vente = uniteVente(source);

    const { data: cree, error } = await supabase.from("produits").insert(ligne).select("id").single();
    if (error || !cree) {
      throw new Error(`Création échouée (${item.reference_fournisseur} — ${item.nom}) : ${error?.message}`);
    }
    console.log(`✓ créé #${cree.id} : ${item.reference_fournisseur} — ${item.nom}`);
    crees++;

    journal.push({
      ref: item.reference_fournisseur,
      produit_id: cree.id,
      nom: item.nom,
      source,
      publiable: !item.motif_non_publiable,
      motif_non_publiable: item.motif_non_publiable ?? null,
    });
  }
  return { crees, ignores };
}

function construireRapport(journal, resultats) {
  const parMotif = new Map();
  for (const j of journal) {
    if (!j.motif_non_publiable) continue;
    if (!parMotif.has(j.motif_non_publiable)) parMotif.set(j.motif_non_publiable, []);
    parMotif.get(j.motif_non_publiable).push(j);
  }

  const lignes = [];
  lignes.push("# Rapport d'import LPD");
  lignes.push("");
  lignes.push(`Généré le ${new Date().toISOString().slice(0, 10)} par scripts/importer-lpd.mjs.`);
  lignes.push("");
  lignes.push("## Résumé");
  lignes.push("");
  for (const [source, r] of Object.entries(resultats)) {
    lignes.push(`- **${source}** : ${r.crees} créés, ${r.ignores} déjà présents (idempotent).`);
  }
  lignes.push("");
  lignes.push(
    "Tous les articles sont importés **masqués** (`statut_publication = en_attente`), " +
    "sans photo, `unite_vente = inconnu` pour la papeterie (aucun conditionnement " +
    "confirmé dans ce lot). Publication bloquée tant que photo, prix et unité de " +
    "vente ne sont pas confirmés (voir lib/admin/produits-actions.ts).",
  );
  lignes.push("");
  lignes.push("## Articles non publiables, par motif");
  lignes.push("");
  for (const [motif, items] of parMotif) {
    lignes.push(`### ${motif} (${items.length})`);
    lignes.push("");
    for (const it of items) {
      lignes.push(`- \`${it.ref}\` #${it.produit_id} — ${it.nom} (${it.source})`);
    }
    lignes.push("");
  }
  return lignes.join("\n");
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const vendeurId = await assurerVendeurLPD();

  const journal = [];
  const resultats = {};
  resultats.grille = await importerLot(manifest.grille, "grille", vendeurId, journal);
  resultats.livres_lpd = await importerLot(manifest.livres_lpd, "livres_lpd", vendeurId, journal);
  resultats.catalogue_livres = await importerLot(manifest.catalogue_livres, "catalogue_livres", vendeurId, journal);

  const totalCrees = Object.values(resultats).reduce((s, r) => s + r.crees, 0);
  const totalIgnores = Object.values(resultats).reduce((s, r) => s + r.ignores, 0);
  console.log(`\nTerminé : ${totalCrees} créés, ${totalIgnores} déjà présents.`);

  const rapport = construireRapport(journal, resultats);
  await writeFile(RAPPORT, rapport, "utf8");
  console.log(`Rapport écrit : ${RAPPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
