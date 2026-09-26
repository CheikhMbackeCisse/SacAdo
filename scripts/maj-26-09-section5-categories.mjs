// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 5 (catégories).
// Fusionne Matériel géométrique (id 4, calculatrices incluses) dans
// Fournitures d'école (id 11, seule catégorie "fournitures" existante — pas
// de doublon "Fournitures scolaires" à fusionner), déplace bâtonnets/craies
// et le cahier égaré d'Art & dessin, renumérote l'ordre d'affichage.
// Idempotent : relit l'état avant d'écrire.
// Usage : node scripts/maj-26-09-section5-categories.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ajouterEntree } from "./lib/journal-maj-26-09.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CAT_GEOMETRIE = 4;
const CAT_FOURNITURES = 11;
const CAT_CAHIERS = 2;
const SOUS_CAT_CALCULATRICES = 25;
const SOUS_CAT_CAHIERS_DESSIN = 5;

// Classement des produits cat=4 sans sous-catégorie (imports Papex récents).
const SOUS_CAT_PAR_MOTIF = [
  { re: /calculatric/i, id: SOUS_CAT_CALCULATRICES },
  { re: /\bcompas\b/i, id: 20 },
  { re: /\brapporteur/i, id: 23 },
  { re: /\bequerre/i, id: 22 },
  { re: /\bregle\b/i, id: 21 },
]; // sinon (kits géométrie, kit de traçage, trace-cercles, boîte instruments) -> 24 "Kits de traçage"

function normaliser(s) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

async function main() {
  // 1. sous_categories de Géométrie -> rattachées à Fournitures d'école.
  const { error: errSC } = await supabase
    .from("sous_categories")
    .update({ categorie_id: CAT_FOURNITURES })
    .eq("categorie_id", CAT_GEOMETRIE);
  if (errSC) throw new Error(`sous_categories : ${errSC.message}`);
  console.log("✓ sous_categories de Matériel géométrique -> Fournitures d'école");

  // 2. Produits cat=4 : classer ceux sans sous-catégorie, puis déplacer tous vers Fournitures.
  const { data: produitsGeo } = await supabase
    .from("produits")
    .select("id, nom, sous_categorie_id, mots_cles")
    .eq("categorie_id", CAT_GEOMETRIE);

  for (const p of produitsGeo) {
    let sousCategorieId = p.sous_categorie_id;
    if (!sousCategorieId) {
      const regle = SOUS_CAT_PAR_MOTIF.find((r) => r.re.test(p.nom));
      sousCategorieId = regle ? regle.id : 24; // défaut : Kits de traçage
    }
    const estCalculatrice = sousCategorieId === SOUS_CAT_CALCULATRICES;
    const motsCles = normaliser(p.mots_cles).includes("geometrie") || estCalculatrice
      ? p.mots_cles
      : `${p.mots_cles ?? ""} géométrie`.trim();

    const { error } = await supabase
      .from("produits")
      .update({ categorie_id: CAT_FOURNITURES, sous_categorie_id: sousCategorieId, mots_cles: motsCles })
      .eq("id", p.id);
    if (error) { console.error(`✗ #${p.id} —`, error.message); continue; }
    console.log(`✓ #${p.id} ${p.nom} -> Fournitures d'école (sous_cat ${sousCategorieId}${estCalculatrice ? "" : ", tag géométrie"})`);
  }

  // 3. Catégorie Matériel géométrique désactivée (disparaît des listes), plus d'ordre.
  await supabase.from("categories").update({ actif: false, ordre: null }).eq("id", CAT_GEOMETRIE);
  console.log("✓ Matériel géométrique désactivée");
  ajouterEntree({
    section: "5",
    cible: "Matériel géométrique -> Fournitures d'école",
    action: "fusion catégorie",
    statut: "fait",
    detail: `${produitsGeo.length} produits déplacés (dont calculatrices, non taguées « géométrie »). Catégorie 4 désactivée, jamais supprimée (garde l'historique).`,
  });
  ajouterEntree({
    section: "5",
    cible: "Fusion « Fournitures scolaires »/« Fournitures d'école »",
    action: "verification",
    statut: "fait",
    detail: "Une seule catégorie 'fournitures' existe en base : « Fournitures d'école » (id 11). Aucun doublon 'Fournitures scolaires' à fusionner — nom conservé : « Fournitures d'école ».",
  });

  // 4. Bâtonnets et craies : Art & dessin -> Fournitures d'école.
  const idsBatonnetsCraies = [1218, 1230, 1259, 1299, 1300];
  const { error: errBC } = await supabase.from("produits").update({ categorie_id: CAT_FOURNITURES }).in("id", idsBatonnetsCraies);
  if (errBC) console.error("✗ bâtonnets/craies —", errBC.message);
  else console.log(`✓ ${idsBatonnetsCraies.length} bâtonnets/craies déplacés vers Fournitures d'école`);
  ajouterEntree({
    section: "5",
    cible: "Bâtonnets et craies -> Fournitures d'école",
    action: "deplacement",
    statut: "cas_douteux",
    detail: "#1230 'Craies grasses Giotto Cera 24' et #1259 'Craies de cire 12 couleurs' sont des craies grasses/de cire (pastels à l'huile, medium de coloriage proche des crayons de couleur), pas de la craie de tableau — déplacées à la lettre de la consigne, mais à confirmer : elles pourraient rester en Art & dessin. #1299/#1300 (Robercolor, boîte de 100) sont bien de la vraie craie de tableau, déplacement non ambigu.",
  });

  // 5. Cahier égaré dans Art & dessin.
  const { error: errCahier } = await supabase
    .from("produits")
    .update({ categorie_id: CAT_CAHIERS, sous_categorie_id: SOUS_CAT_CAHIERS_DESSIN })
    .eq("id", 1572);
  if (errCahier) console.error("✗ #1572 —", errCahier.message);
  else console.log("✓ #1572 Cahier de dessin L'écolier -> Cahiers & papeterie");

  // 6. Renumérotation de l'ordre d'affichage : Fournitures d'école prend la
  // place laissée par Matériel géométrique (rang 7), le reste se resserre.
  const NOUVEL_ORDRE = [
    { slug: "kits", ordre: 1 },
    { slug: "cahiers-papeterie", ordre: 2 },
    { slug: "impression-consommables", ordre: 3 },
    { slug: "livres-manuels", ordre: 4 },
    { slug: "ordinateurs", ordre: 5 },
    { slug: "electronique-arduino", ordre: 6 },
    { slug: "fournitures-ecole", ordre: 7 },
    { slug: "mobilier", ordre: 8 },
    { slug: "hygiene-cantine", ordre: 9 },
    { slug: "sport-eps", ordre: 10 },
    { slug: "art-dessin", ordre: 11 },
    { slug: "cartables-sacs", ordre: 12 },
    { slug: "ebooks", ordre: 13 },
    { slug: "ecriture", ordre: 14 },
  ];
  for (const { slug, ordre } of NOUVEL_ORDRE) {
    const { error } = await supabase.from("categories").update({ ordre }).eq("slug", slug);
    if (error) console.error(`✗ ordre ${slug} —`, error.message);
  }
  console.log("✓ Ordre des catégories renumeroté (Fournitures d'école au rang 7)");
  ajouterEntree({
    section: "5",
    cible: "Ordre d'affichage des catégories",
    action: "renumerotation",
    statut: "fait",
    detail: "Fournitures d'école prend le rang 7 (celui de Matériel géométrique) ; les catégories suivantes se resserrent.",
  });

  console.log("\nSection 5 terminée.");
}

main().catch((e) => { console.error(e); process.exit(1); });
