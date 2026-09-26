// SacAdo — maj-publication/PROMPT-publication-korka.md §3
// Compare les 41 lignes de maj-publication/korka/SacAdo_Livres_Korka_Diallo.xlsx
// avec le catalogue, corrige les écarts trouvés (prix, masquage, publication),
// et écrit maj-publication/rapports/verif-korka.md. Idempotent, relançable.
//
// Rattachement à trois niveaux : (1) titre exact (produits.nom joue le rôle de
// "titre_fournisseur" : les livres Korka sont stockés avec le titre du
// tableur, en majuscules, tel quel) ; (2) titre normalisé (sans accents/
// ponctuation) ; (3) niveau + matière + auteur + édition. Recherche limitée à
// la catégorie « Livres et annales » (id stable, tous les Korka y sont).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

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

const XLSX_PATH = "maj-publication/korka/SacAdo_Livres_Korka_Diallo.xlsx";
const RAPPORT_PATH = "maj-publication/rapports/verif-korka.md";
const CATEGORIE_LIVRES_SLUG = "livres-manuels";

function normaliser(s) {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "1ere S1" -> {niveau:"1ere", serie:"S1"} ; "Maternelle / CI" -> {niveau:"Maternelle", serie:null}
function parserNiveau(niveauRaw) {
  const base = (niveauRaw ?? "").split("/")[0].trim();
  const m = /^(.+?)\s+(S1|S2|S|L)$/i.exec(base);
  if (m) return { niveau: m[1].trim(), serie: m[2].toUpperCase() };
  return { niveau: base, serie: null };
}

function deduireTypeOuvrage(titre) {
  const t = titre.toUpperCase();
  if (t.includes("CONCOURS")) return "concours";
  if (t.includes("RECUEIL DE DEVOIRS")) return "recueil de devoirs";
  if (t.includes("GUIDE DE L'ELEVE") || t.includes("GUIDE DE L ELEVE")) return "guide de l eleve";
  if (t.includes("ANNALE")) return "annales";
  if (t.includes("CAHIER")) return "cahier d activites";
  return "cours";
}

function lireXlsx() {
  const wb = XLSX.readFile(XLSX_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  return rows
    .filter((r) => r.Titre && r.Titre !== "TOTAL")
    .map((r) => {
      const { niveau, serie } = parserNiveau(r.Niveau);
      return {
        titre: String(r.Titre).trim(),
        niveau,
        serie,
        matiere: r.Matiere ? String(r.Matiere).trim() : null,
        auteur: r.Auteur ? String(r.Auteur).trim() : null,
        editeur: r["Editeur / collection"] ? String(r["Editeur / collection"]).trim() : null,
        edition: r.Edition ? String(r.Edition).trim() : null,
        prixPublic: Number(r["Prix public"]),
        prixAchatAttendu: Math.round(Number(r["Prix public"]) * 0.8),
        aPhoto2: Boolean(r["Photo 2"]),
        typeOuvrage: deduireTypeOuvrage(String(r.Titre)),
        isMobama: /mobama/i.test(String(r.Titre)),
      };
    });
}

async function main() {
  const lignes = lireXlsx();
  console.log(`${lignes.length} lignes lues dans le tableur.\n`);

  const { data: cats } = await supabase.from("categories").select("id, slug");
  const categorieLivresId = cats.find((c) => c.slug === CATEGORIE_LIVRES_SLUG)?.id;

  const { data: candidatsBrut, error } = await supabase
    .from("produits")
    .select("id, nom, prix, prix_achat, statut_publication, niveau, serie, matiere, auteur, edition, photo, photos, vendeur_id")
    .eq("categorie_id", categorieLivresId);
  if (error) throw error;

  const parNomExact = new Map();
  for (const p of candidatsBrut) {
    const k = p.nom.trim().toLowerCase();
    if (!parNomExact.has(k)) parNomExact.set(k, []);
    parNomExact.get(k).push(p);
  }
  const parNomNormalise = new Map();
  for (const p of candidatsBrut) {
    const k = normaliser(p.nom);
    if (!parNomNormalise.has(k)) parNomNormalise.set(k, []);
    parNomNormalise.get(k).push(p);
  }

  const resultats = [];
  for (const ligne of lignes) {
    let candidats = parNomExact.get(ligne.titre.trim().toLowerCase()) ?? [];
    let niveauMatch = "titre exact";
    if (candidats.length === 0) {
      candidats = parNomNormalise.get(normaliser(ligne.titre)) ?? [];
      niveauMatch = "titre normalisé";
    }
    if (candidats.length === 0) {
      candidats = candidatsBrut.filter(
        (p) =>
          p.niveau === ligne.niveau &&
          p.matiere === ligne.matiere &&
          (!ligne.auteur || p.auteur === ligne.auteur) &&
          (!ligne.edition || p.edition === ligne.edition),
      );
      niveauMatch = "niveau+matière+auteur+édition";
    }

    if (candidats.length === 0) {
      resultats.push({ ligne, statut: "introuvable", candidats: [] });
    } else if (candidats.length > 1) {
      resultats.push({ ligne, statut: "en double", candidats, niveauMatch });
    } else {
      const p = candidats[0];
      const ecarts = [];
      if (p.prix !== ligne.prixPublic) ecarts.push(`prix ${p.prix} F ≠ ${ligne.prixPublic} F`);
      if (p.prix_achat !== ligne.prixAchatAttendu) ecarts.push(`prix d'achat ${p.prix_achat} F ≠ ${ligne.prixAchatAttendu} F`);
      const aUneImage = Boolean(p.photo) || (Array.isArray(p.photos) && p.photos.length > 0);
      if (!aUneImage) ecarts.push("image principale manquante");
      const aDeuxImages = Array.isArray(p.photos) && p.photos.length >= 2;
      if (ligne.aPhoto2 && !aDeuxImages) ecarts.push("deuxième photo manquante");
      const statutAttendu = ligne.isMobama ? "masqué" : "publié";
      const statutOk = ligne.isMobama ? p.statut_publication !== "publie" : p.statut_publication === "publie";
      if (!statutOk) ecarts.push(`statut ${p.statut_publication} (attendu : ${statutAttendu})`);
      if (!p.niveau) ecarts.push("niveau vide");
      if (!p.matiere) ecarts.push("matière vide");

      resultats.push({
        ligne,
        statut: ecarts.length === 0 ? "présent et conforme" : "présent avec écarts",
        candidat: p,
        ecarts,
        niveauMatch,
      });
    }
  }

  // ==========================================================================
  // Corrections idempotentes
  // ==========================================================================
  let corrigesPrix = 0;
  let publies = 0;
  let masques = 0;
  for (const r of resultats) {
    if (r.statut !== "présent avec écarts") continue;
    const p = r.candidat;
    const patch = {};
    if (p.prix !== r.ligne.prixPublic) patch.prix = r.ligne.prixPublic;
    if (p.prix_achat !== r.ligne.prixAchatAttendu) patch.prix_achat = r.ligne.prixAchatAttendu;
    if (Object.keys(patch).length > 0) corrigesPrix++;

    const aUneImage = Boolean(p.photo) || (Array.isArray(p.photos) && p.photos.length > 0);
    if (r.ligne.isMobama) {
      // Les 4 Mobama restent masqués tant que le fournisseur n'a pas confirmé.
      if (p.statut_publication === "publie") {
        patch.statut_publication = "en_attente";
        masques++;
      }
    } else if (p.statut_publication !== "publie" && aUneImage) {
      patch.statut_publication = "publie";
      publies++;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await supabase.from("produits").update(patch).eq("id", p.id);
      if (updErr) console.error(`  ! [${p.id}] échec correction : ${updErr.message}`);
    }
  }
  console.log(`Corrections : ${corrigesPrix} prix alignés, ${publies} publiés, ${masques} masqués (Mobama).\n`);

  // ==========================================================================
  // Rapport
  // ==========================================================================
  const parStatut = {};
  for (const r of resultats) parStatut[r.statut] = (parStatut[r.statut] ?? 0) + 1;
  console.log("Résumé :", parStatut);

  const mobamaMasques = resultats.filter(
    (r) => r.ligne.isMobama && r.candidat && r.candidat.statut_publication !== "publie",
  ).length;
  const presents = resultats.filter((r) => r.statut === "présent et conforme" || r.statut === "présent avec écarts").length;
  console.log(`${presents}/${lignes.length} lignes présentes, dont ${mobamaMasques} Mobama masquées.`);

  mkdirSync("maj-publication/rapports", { recursive: true });
  const lignesRapport = [
    "# Vérification du catalogue Korka Diallo",
    "",
    `Généré le ${new Date().toISOString().slice(0, 10)}. ${lignes.length} lignes dans le tableur, ${presents} présentes.`,
    "",
    "## Résumé",
    "",
    ...Object.entries(parStatut).map(([k, v]) => `- **${k}** : ${v}`),
    "",
    "## Détail",
    "",
  ];
  for (const r of resultats) {
    if (r.statut === "présent et conforme") {
      lignesRapport.push(`- ✅ **${r.ligne.titre}** — conforme (id ${r.candidat.id}, rattaché par ${r.niveauMatch}).`);
    } else if (r.statut === "présent avec écarts") {
      lignesRapport.push(`- ⚠️ **${r.ligne.titre}** (id ${r.candidat.id}) — ${r.ecarts.join(", ")}.`);
    } else if (r.statut === "introuvable") {
      lignesRapport.push(`- ❌ **${r.ligne.titre}** — introuvable au catalogue.`);
    } else if (r.statut === "en double") {
      lignesRapport.push(`- 🔁 **${r.ligne.titre}** — en double : ids ${r.candidats.map((c) => c.id).join(", ")}.`);
    }
  }
  writeFileSync(RAPPORT_PATH, lignesRapport.join("\n") + "\n");
  console.log(`\nRapport écrit dans ${RAPPORT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
