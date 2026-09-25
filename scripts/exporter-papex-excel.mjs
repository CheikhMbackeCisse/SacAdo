// Export ponctuel : tableau Excel des produits Papex avec prix fournisseur
// (Papex) et prix de vente (SacAdo). Usage : node scripts/exporter-papex-excel.mjs
// Nécessite `npm install xlsx --no-save` au préalable (pas une dépendance de
// l'app, uniquement pour ce script jetable).
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

async function main() {
  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "Papex").single();
  const { data: categories } = await supabase.from("categories").select("id, nom");
  const nomCategorie = Object.fromEntries(categories.map((c) => [c.id, c.nom]));

  const { data: produits, error } = await supabase
    .from("produits")
    .select("reference_fournisseur, nom, categorie_id, prix_achat, prix, prix_a_verifier, statut_publication, motif_refus")
    .eq("vendeur_id", vendeur.id)
    .order("reference_fournisseur", { ascending: true });
  if (error) throw error;

  const lignes = produits.map((p) => ({
    "ID SacAdo": p.reference_fournisseur,
    "Désignation": p.nom,
    "Catégorie": nomCategorie[p.categorie_id] ?? "",
    "Prix Papex (achat)": p.prix_achat ?? "",
    "Prix SacAdo (vente)": p.prix_a_verifier ? "" : p.prix,
    "Marge": p.prix_achat != null && !p.prix_a_verifier ? p.prix - p.prix_achat : "",
    "Statut": p.statut_publication === "publie" ? "Publié" : "Non publié",
    "Motif (si non publié)": p.motif_refus ?? (p.prix_a_verifier ? "Prix de vente à vérifier" : ""),
  }));

  const feuille = XLSX.utils.json_to_sheet(lignes);
  feuille["!cols"] = [
    { wch: 10 }, { wch: 55 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 35 },
  ];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Catalogue Papex");

  const chemin = "catalogue_papex_prix.xlsx";
  XLSX.writeFile(classeur, chemin);
  console.log(`✓ ${lignes.length} lignes écrites dans ${chemin}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
