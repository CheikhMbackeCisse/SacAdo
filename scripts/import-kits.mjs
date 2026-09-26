// Import des kits scolaires depuis import-kits/kits.json (voir
// import-kits/PROMPT-claude-code-kits.md). Usage : node scripts/import-kits.mjs
// Lit .env.local. Idempotent : upsert sur (cycle, niveau, gamme) — la même clé
// que la contrainte d'unicité posée en 0001/0007 ; les lignes d'un kit sont
// entièrement remplacées à chaque lancement (delete + insert), donc relancer
// ne crée jamais de doublon.
//
// Un kit ne stocke jamais de prix : voir lib/kits.ts (calculerPrixKit), seule
// fonction de calcul, utilisée aussi côté app.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const kitsJson = JSON.parse(readFileSync("import-kits/kits.json", "utf8"));

// --- Résolution des références (Étape 1 du prompt) --------------------------
// Alias décidés manuellement après lecture des consignes "recherche" — voir
// import-kits/rapport-resolution.md pour le détail de chaque cas.
const ALIAS_REFERENCE_FOURNISSEUR = {
  S065: "S065-UNITE", // variante à l'unité, pas le pack de 12
  "CIS-ardoise": "ardoise-quadrillee",
  "A-CREER-01": "S066", // cahier Calligraphe 200p grand format (vert, #1237) — couleur par défaut
};
const ALIAS_NOM_EXACT = {
  "CDC-1M": "MATHS 1S2 - LA CLE DES CRACKS",
  "CDC-2M": "KAAMILE DE MATHS - SECONDE S",
  "CDC-2PC": "PHYSIQUE CHIMIE SECONDE S",
  "CDC-TM": "MATHS TS2 - LA CLE DU BAC",
  "KANDIA-3PC": "Collection Kandia - Physique Chimie 3ème",
  "LACLE-3SVT": "SVT TROISIEME COLLEGE",
};

async function fetchAllProduits() {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, prix, statut, statut_publication, reference_fournisseur")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function resoudre(ref, byRef, byNom) {
  const aliasRef = ALIAS_REFERENCE_FOURNISSEUR[ref];
  if (aliasRef && byRef.has(aliasRef)) return byRef.get(aliasRef);

  const aliasNom = ALIAS_NOM_EXACT[ref];
  if (aliasNom && byNom.has(aliasNom)) return byNom.get(aliasNom);

  if (byRef.has(ref)) return byRef.get(ref);

  return null;
}

async function main() {
  const produits = await fetchAllProduits();
  const byRef = new Map(produits.filter((p) => p.reference_fournisseur).map((p) => [p.reference_fournisseur, p]));
  const byNom = new Map(produits.map((p) => [p.nom, p]));

  const lignesIgnorees = [];
  let kitsCreesOuMaj = 0;
  let lignesInserees = 0;

  for (const kit of kitsJson.kits) {
    const payloadKit = {
      cycle: kit.cycle,
      niveau: kit.classe,
      gamme: kit.gamme,
      nom: kit.titre,
      slug: kit.slug,
      serie: kit.serie ?? null,
      ordre_gamme: kit.ordre_gamme ?? null,
      description: kit.description ?? null,
      description_si_aucune_cle_des_cracks: kit.description_si_aucune_cle_des_cracks ?? null,
      ebook_offert: kit.ebook_offert ?? true,
      type_source: kit.type_source ?? null,
      statut: "masque", // Toujours réimporté masqué : publication = action manuelle.
      source_interne: kit.source_interne ?? null,
      manquants_connus: kit.manquants_connus ?? [],
    };

    const { data: kitRow, error: errKit } = await supabase
      .from("kits")
      .upsert(payloadKit, { onConflict: "cycle,niveau,gamme" })
      .select("id")
      .single();
    if (errKit) {
      console.error(`Kit ${kit.slug} : échec upsert —`, errKit.message);
      continue;
    }
    kitsCreesOuMaj++;

    const { error: errDelete } = await supabase.from("kit_items").delete().eq("kit_id", kitRow.id);
    if (errDelete) {
      console.error(`Kit ${kit.slug} : échec suppression des anciennes lignes —`, errDelete.message);
      continue;
    }

    const lignesAInserer = [];
    for (const ligne of kit.lignes) {
      const produit = resoudre(ligne.ref, byRef, byNom);
      if (!produit) {
        lignesIgnorees.push({ kit: kit.slug, ref: ligne.ref, libelle: ligne.libelle_besoin });
        continue;
      }
      lignesAInserer.push({
        kit_id: kitRow.id,
        produit_id: produit.id,
        quantite_defaut: ligne.quantite,
        libelle_besoin: ligne.libelle_besoin,
        groupe_affichage: ligne.groupe_affichage,
        section: ligne.section,
        coche_defaut: ligne.coche_defaut,
        ordre: ligne.ordre,
      });
    }

    if (lignesAInserer.length > 0) {
      const { error: errInsert } = await supabase.from("kit_items").insert(lignesAInserer);
      if (errInsert) {
        console.error(`Kit ${kit.slug} : échec insertion des lignes —`, errInsert.message);
        continue;
      }
      lignesInserees += lignesAInserer.length;
    }
  }

  const rapport = [
    "# Rapport d'import des kits scolaires",
    "",
    `Lancé le ${new Date().toISOString()}.`,
    "",
    `- Kits créés ou mis à jour : ${kitsCreesOuMaj} / ${kitsJson.kits.length}`,
    `- Lignes insérées : ${lignesInserees}`,
    `- Lignes ignorées (référence introuvable) : ${lignesIgnorees.length}`,
    "",
    "## Lignes ignorées",
    ...(lignesIgnorees.length
      ? lignesIgnorees.map((l) => `- ${l.kit} — ${l.ref} (${l.libelle})`)
      : ["(aucune)"]),
  ].join("\n");

  writeFileSync("import-kits/rapport-import.md", rapport, "utf8");
  console.log(`Kits créés/mis à jour : ${kitsCreesOuMaj}/${kitsJson.kits.length}`);
  console.log(`Lignes insérées : ${lignesInserees}, ignorées : ${lignesIgnorees.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
