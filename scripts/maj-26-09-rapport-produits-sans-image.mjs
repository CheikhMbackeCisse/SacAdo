// maj-26-09/PROMPT-maj-catalogue-26-09.md — Rapport §11.1 : produits sans
// image, et ceux dont l'image vient de Yuupee (URL contenant "yuupee") —
// l'équipe leur cherche de nouvelles photos.
// Usage : node scripts/maj-26-09-rapport-produits-sans-image.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAll(table, select) {
  const all = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select(select).order("id").range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  const [produits, vendeurs, categories] = await Promise.all([
    fetchAll(
      "produits",
      "id, nom, prix, statut_publication, photo, photos, mots_cles, reference_fournisseur, categorie_id, vendeur_id",
    ),
    supabase.from("vendeurs").select("id, nom_boutique").then((r) => r.data ?? []),
    supabase.from("categories").select("id, nom").then((r) => r.data ?? []),
  ]);
  const nomVendeur = Object.fromEntries(vendeurs.map((v) => [v.id, v.nom_boutique]));
  const nomCategorie = Object.fromEntries(categories.map((c) => [c.id, c.nom]));

  const lignes = [];
  for (const p of produits) {
    const sansImage = !p.photo && (!p.photos || p.photos.length === 0);
    const imageYuupee = typeof p.photo === "string" && p.photo.includes("yuupee");
    if (!sansImage && !imageYuupee) continue;

    lignes.push({
      "Nom": p.nom,
      "Fournisseur": nomVendeur[p.vendeur_id] ?? "",
      "Référence d'origine": p.reference_fournisseur ?? "",
      "Catégorie": nomCategorie[p.categorie_id] ?? "",
      "Prix de vente": p.prix,
      "Statut": p.statut_publication,
      "Image actuelle": p.photo ?? "",
      "Terme de recherche d'image": p.mots_cles ?? "",
    });
  }

  lignes.sort((a, b) => {
    const f = a["Fournisseur"].localeCompare(b["Fournisseur"], "fr");
    if (f !== 0) return f;
    return a["Catégorie"].localeCompare(b["Catégorie"], "fr");
  });

  const feuille = XLSX.utils.json_to_sheet(lignes);
  feuille["!cols"] = [{ wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 24 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Produits sans image");
  XLSX.writeFile(classeur, "maj-26-09/rapports/produits-sans-image.xlsx");
  console.log(`✓ ${lignes.length} produits listés dans maj-26-09/rapports/produits-sans-image.xlsx`);
}

main().catch((e) => { console.error(e); process.exit(1); });
