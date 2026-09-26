// maj-26-09/PROMPT-maj-catalogue-26-09.md — §11.2 : assemble
// maj-26-09/rapports/modifications.md à partir du journal accumulé par les
// scripts maj-26-09-section*.mjs.
// Usage : node scripts/maj-26-09-generer-rapports.mjs
import { readFileSync, writeFileSync } from "node:fs";

const journal = JSON.parse(readFileSync("maj-26-09/rapports/journal-corrections.json", "utf8"));

function parSection(section) {
  return journal.filter((e) => e.section === section);
}

function ligne(e) {
  const detail = e.detail ? ` — ${e.detail}` : "";
  return `- **${e.cible}** (${e.action}) → \`${e.statut}\`${detail}`;
}

const lignes = [
  "# Modifications — chantier maj-26-09",
  "",
  `Généré le ${new Date().toISOString()}.`,
  "",
  "## En attente (bloqué techniquement, pas de choix éditorial)",
  "",
  "- **Migration `supabase/migrations/0088_marques_collections.sql`** (colonne `produits.collection`) : à exécuter dans le SQL Editor Supabase — écriture DDL impossible sans accès direct à la base, uniquement via service_role (lecture/écriture de lignes).",
  "- **`scripts/maj-26-09-section4-collections.mjs`** : prêt, écrit mais non exécuté (dépend de la migration ci-dessus). Tague 18 livres sur 5 collections identifiées avec confiance (La Clé des Cracks, Collection Kandia, Bled, Excellence, VISA Annales).",
  "- **Pages marques + logos (code)** : faites (`/marques`, `/marques/[slug]`, logo sur carte/fiche produit, priorité dans la recherche) — indépendantes de la migration, déjà actives.",
  "- **Pipeline images** : la chaîne WebP/redimensionnement/qualité existe déjà (upload vendeur/admin) et le service des vignettes 400/800px aussi (loader next/image). Le rattrapage de TOUTES les photos déjà en base (des milliers, tailles/formats hétérogènes) n'a pas été relancé dans ce chantier — gros job batch distinct, à faire à part.",
  "",
  "## Section 1 — Corrections produit par produit",
  "",
  ...parSection("1").map(ligne),
  "",
  "## Section 2 — Stylos à l'unité (Staedtler, Bic)",
  "",
  ...parSection("2").map(ligne),
  "",
  "## Section 3 — Nommage catalogue entier",
  "",
  ...parSection("3").map(ligne),
  "",
  "## Section 4 — Marques et collections",
  "",
  ...parSection("4").map(ligne),
  "",
  "### Livres « La Clé des Cracks » (Korka Diallo) masqués",
  "",
  "Aucun. Les 25 livres de Korka Diallo en base sont tous publiés, avec photo et prix.",
  "",
  "## Section 5 — Catégories",
  "",
  ...parSection("5").map(ligne),
  "",
  "## Section 6 — Recherche, filtres, synonymes",
  "",
  ...parSection("6").map(ligne),
  "",
  "## Cas douteux et ambigus (récapitulatif transverse)",
  "",
  ...journal
    .filter((e) => e.statut === "cas_douteux" || e.statut === "ambigu")
    .map((e) => `- [§${e.section}] **${e.cible}** : ${e.detail ?? ""}`),
  "",
  "## Suppressions",
  "",
  ...journal
    .filter((e) => e.statut === "supprime_reel" || e.statut === "supprime_logique")
    .map((e) => `- [§${e.section}] **${e.cible}** — ${e.statut === "supprime_reel" ? "suppression réelle" : "suppression logique (référencé dans une commande/un kit)"}`),
  "",
  "## Créations",
  "",
  ...journal
    .filter((e) => e.section === "2" && e.action === "creation" && e.statut === "fait")
    .map((e) => `- [§${e.section}] **${e.cible}**`),
  "",
];

writeFileSync("maj-26-09/rapports/modifications.md", lignes.join("\n"), "utf8");
console.log(`✓ maj-26-09/rapports/modifications.md généré (${journal.length} entrées journalisées).`);
