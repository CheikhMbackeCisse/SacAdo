// CORRECTIONS_KITS Lot 3 : import de kits_sacado_final.xlsx (117 kits, 2143
// lignes). Onglet "Kits" pilote l'action par kit (Créer / Remplacer le
// contenu / Masquer), onglet "Contenu des kits" fournit les kit_items.
// Usage : node scripts/importer-kits-final.mjs --dry-run
//         node scripts/importer-kits-final.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const DRY_RUN = process.argv.includes("--dry-run");
const FICHIER = "kits_sacado_final.xlsx";

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

// IDs créés au Lot 2 (scripts/lot2-prix-et-nouveaux-produits.mjs).
const PRODUIT_ID_PAR_CLE = { TP100: 1728, TP200: 1729 };

const SECTION_PAR_LIBELLE = {
  Principal: "principal",
  Option: "option",
  "Livres proposés": "livres_proposes",
};

function slugifier(nom) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resoudreProduitId(valeur) {
  if (PRODUIT_ID_PAR_CLE[valeur] !== undefined) return PRODUIT_ID_PAR_CLE[valeur];
  const n = Number(valeur);
  if (Number.isFinite(n)) return n;
  return null;
}

function statutDb(statutCible) {
  return statutCible === "Publié" ? "publie" : "masque";
}

async function main() {
  const wb = XLSX.read(readFileSync(FICHIER), { type: "buffer" });
  const kitsSheet = XLSX.utils.sheet_to_json(wb.Sheets["Kits"], { defval: null });
  const contenuSheet = XLSX.utils.sheet_to_json(wb.Sheets["Contenu des kits"], { defval: null });

  const contenuParKit = new Map();
  for (const ligne of contenuSheet) {
    const cle = ligne["Kit"];
    if (!contenuParKit.has(cle)) contenuParKit.set(cle, []);
    contenuParKit.get(cle).push(ligne);
  }

  const idsProduitsValides = new Set();
  {
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("produits")
        .select("id")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Lecture produits échouée : ${error.message}`);
      for (const p of data) idsProduitsValides.add(p.id);
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  let crees = 0;
  let remplaces = 0;
  let masques = 0;
  let lignesInserees = 0;
  const erreurs = [];
  const kitIdParNom = new Map(); // pour le rapport (Récap par kit)

  for (const kit of kitsSheet) {
    const nomKit = kit["Nom"];
    const action = kit["Action"];
    const statutCible = statutDb(kit["Statut cible"]);

    if (action.startsWith("Masquer")) {
      const id = kit["Kit ID actuel"];
      console.log(`${DRY_RUN ? "[dry-run] " : ""}masquer #${id} — ${nomKit}`);
      if (!DRY_RUN) {
        const { error } = await supabase.from("kits").update({ statut: "masque" }).eq("id", id);
        if (error) erreurs.push(`Masquer #${id} (${nomKit}) : ${error.message}`);
      }
      masques++;
      continue;
    }

    const lignesSource = contenuParKit.get(nomKit) ?? [];
    const lignesKitItems = [];
    for (const ligne of lignesSource) {
      const produitId = resoudreProduitId(ligne["Produit ID"]);
      if (produitId === null || !idsProduitsValides.has(produitId)) {
        erreurs.push(
          `${nomKit} : produit introuvable pour "${ligne["Produit ID"]}" (${ligne["Produit"]})`,
        );
        continue;
      }
      const section = SECTION_PAR_LIBELLE[ligne["Section"]];
      if (!section) {
        erreurs.push(`${nomKit} : section inconnue "${ligne["Section"]}" pour ${ligne["Produit"]}`);
        continue;
      }
      lignesKitItems.push({
        produit_id: produitId,
        quantite_defaut: ligne["Quantité"],
        libelle_besoin: ligne["Libellé besoin"],
        groupe_affichage: ligne["Groupe"],
        section,
        coche_defaut: ligne["Coché par défaut"] === "Oui",
        ordre: ligne["Ordre"],
      });
    }

    if (action === "Remplacer le contenu") {
      const id = kit["Kit ID actuel"];
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}remplacer #${id} — ${nomKit} (${lignesKitItems.length} lignes, statut ${statutCible})`,
      );
      kitIdParNom.set(nomKit, id);
      if (!DRY_RUN) {
        const { error: errUpdate } = await supabase
          .from("kits")
          .update({
            cycle: kit["Cycle"],
            niveau: kit["Niveau"],
            gamme: kit["Gamme"],
            nom: nomKit,
            description: kit["Description"],
            statut: statutCible,
          })
          .eq("id", id);
        if (errUpdate) {
          erreurs.push(`Remplacer #${id} (${nomKit}) : ${errUpdate.message}`);
          continue;
        }
        const { error: errDelete } = await supabase.from("kit_items").delete().eq("kit_id", id);
        if (errDelete) {
          erreurs.push(`Remplacer #${id} (${nomKit}) — suppression lignes : ${errDelete.message}`);
          continue;
        }
        if (lignesKitItems.length > 0) {
          const { error: errInsert } = await supabase
            .from("kit_items")
            .insert(lignesKitItems.map((l) => ({ ...l, kit_id: id })));
          if (errInsert) {
            erreurs.push(`Remplacer #${id} (${nomKit}) — insertion lignes : ${errInsert.message}`);
            continue;
          }
        }
      }
      remplaces++;
      lignesInserees += lignesKitItems.length;
      continue;
    }

    if (action === "Créer") {
      const slug = slugifier(nomKit);
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}créer — ${nomKit} (slug ${slug}, ${lignesKitItems.length} lignes, statut ${statutCible})`,
      );
      if (!DRY_RUN) {
        const { data: kitCree, error: errInsertKit } = await supabase
          .from("kits")
          .insert({
            cycle: kit["Cycle"],
            niveau: kit["Niveau"],
            gamme: kit["Gamme"],
            nom: nomKit,
            slug,
            description: kit["Description"],
            statut: statutCible,
          })
          .select("id")
          .single();
        if (errInsertKit || !kitCree) {
          erreurs.push(`Créer ${nomKit} : ${errInsertKit?.message}`);
          continue;
        }
        kitIdParNom.set(nomKit, kitCree.id);
        if (lignesKitItems.length > 0) {
          const { error: errInsert } = await supabase
            .from("kit_items")
            .insert(lignesKitItems.map((l) => ({ ...l, kit_id: kitCree.id })));
          if (errInsert) {
            erreurs.push(`Créer ${nomKit} — insertion lignes : ${errInsert.message}`);
            continue;
          }
        }
      }
      crees++;
      lignesInserees += lignesKitItems.length;
      continue;
    }

    erreurs.push(`Action inconnue "${action}" pour ${nomKit}`);
  }

  console.log("");
  console.log(`Créés : ${crees}, remplacés : ${remplaces}, masqués : ${masques}`);
  console.log(`Lignes kit_items : ${lignesInserees}`);
  console.log(`Erreurs : ${erreurs.length}`);
  if (erreurs.length > 0) {
    console.log("\n--- Détail des erreurs ---");
    erreurs.forEach((e) => console.log("- " + e));
  }

  if (!DRY_RUN) {
    const rapport = [
      "# Rapport d'import des kits (CORRECTIONS_KITS Lot 3)",
      "",
      `Lancé le ${new Date().toISOString()}.`,
      "",
      `- Kits créés : ${crees}`,
      `- Kits avec contenu remplacé : ${remplaces}`,
      `- Kits masqués : ${masques}`,
      `- Total kits traités : ${crees + remplaces + masques} / ${kitsSheet.length}`,
      `- Lignes kit_items insérées : ${lignesInserees}`,
      `- Erreurs : ${erreurs.length}`,
      "",
      "## Erreurs",
      ...(erreurs.length ? erreurs.map((e) => `- ${e}`) : ["(aucune)"]),
    ].join("\n");
    writeFileSync("rapport-import-kits-final.md", rapport, "utf8");
    console.log("\nRapport écrit : rapport-import-kits-final.md");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
