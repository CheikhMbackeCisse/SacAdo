// Import des kits scolaires depuis import-kits/kits.json (voir
// import-kits/PROMPT-claude-code-kits.md et la correction v10,
// import-kits/PROMPT-correction-kits-v10.md). Usage : node scripts/import-kits.mjs
// Lit .env.local. Idempotent : upsert sur `slug` (kits_slug_unique, 0086) ; les
// lignes d'un kit sont entièrement remplacées à chaque lancement (delete +
// insert), donc relancer ne crée jamais de doublon. Un kit déjà existant
// garde son `statut` (publication = action manuelle, jamais écrasée par un
// réimport) ; seul un nouveau kit est créé `masque`.
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

// --- Résolution des références (Étape 1 du prompt, correction v10) --------
// Alias décidés manuellement (références qui ne correspondent à aucun champ
// direct du produit) — voir import-kits/rapport-resolution.md pour le détail.
const ALIAS_REFERENCE_FOURNISSEUR = {
  S065: "S065-UNITE", // variante à l'unité, pas le pack de 12
  "CIS-ardoise": "ardoise-quadrillee",
  "A-CREER-01": "S066", // cahier Calligraphe 200p grand format (vert, #1237) — couleur par défaut
};

// Depuis la correction v10, les entrées `references` des livres Korka Diallo
// (CDC-...) donnent le titre exact du catalogue Korka (import « Livres Korka
// Diallo », scripts/importer-livres-korka.mjs, qui range le titre tel quel
// dans `produits.nom`), suivi d'une annotation entre parenthèses ajoutée par
// kits.json (auteur/collection) — ex. "MATHS 1S1 (CRACKS EN MATHS) (Korka
// Diallo)" : le titre réel est "MATHS 1S1 (CRACKS EN MATHS)", le groupe final
// "(Korka Diallo)" n'est qu'une note. On retire uniquement CE dernier groupe
// parenthésé (jamais un parenthésage interne, qui fait partie du titre), puis
// on compare sans tenir compte de la casse ni des accents.
function normaliser(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function retirerAnnotationFinale(nom) {
  const m = nom.match(/^(.*?)\s*\([^()]*\)\s*$/);
  return m ? m[1].trim() : nom;
}

function grouperNomNormalise(produits) {
  const map = new Map();
  for (const p of produits) {
    if (!p.nom) continue;
    const cle = normaliser(p.nom);
    if (!map.has(cle)) map.set(cle, []);
    map.get(cle).push(p);
  }
  return map;
}

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

// Regroupe par clé en conservant chaque doublon : sert à détecter les
// références/noms qui correspondent à plusieurs produits (ambiguïté).
function grouper(produits, cle) {
  const map = new Map();
  for (const p of produits) {
    const valeur = p[cle];
    if (!valeur) continue;
    if (!map.has(valeur)) map.set(valeur, []);
    map.get(valeur).push(p);
  }
  return map;
}

// Résout une référence vers { produit, methode } ou { ambigu: true } ou null
// (introuvable). Ordre : alias référence fournisseur, référence fournisseur
// directe, nom exact direct, nom normalisé (casse/accents), titre avant la
// dernière parenthèse (livres Korka Diallo, correction v10) normalisé.
function resoudre(ref, nomAttendu, byRef, byNom, byNomNormalise) {
  const aliasRef = ALIAS_REFERENCE_FOURNISSEUR[ref];
  if (aliasRef) {
    const trouves = byRef.get(aliasRef);
    if (trouves?.length === 1) return { produit: trouves[0], methode: "alias_reference_fournisseur" };
    if (trouves?.length > 1) return { ambigu: true, methode: "alias_reference_fournisseur" };
  }

  const parRef = byRef.get(ref);
  if (parRef?.length === 1) return { produit: parRef[0], methode: "reference_fournisseur" };
  if (parRef?.length > 1) return { ambigu: true, methode: "reference_fournisseur" };

  if (nomAttendu) {
    const parNom = byNom.get(nomAttendu);
    if (parNom?.length === 1) return { produit: parNom[0], methode: "nom_exact" };
    if (parNom?.length > 1) return { ambigu: true, methode: "nom_exact" };

    const parNomNormalise = byNomNormalise.get(normaliser(nomAttendu));
    if (parNomNormalise?.length === 1) return { produit: parNomNormalise[0], methode: "nom_normalise" };
    if (parNomNormalise?.length > 1) return { ambigu: true, methode: "nom_normalise" };

    const titre = retirerAnnotationFinale(nomAttendu);
    if (titre !== nomAttendu) {
      const parTitre = byNomNormalise.get(normaliser(titre));
      if (parTitre?.length === 1) return { produit: parTitre[0], methode: "titre_avant_parenthese" };
      if (parTitre?.length > 1) return { ambigu: true, methode: "titre_avant_parenthese" };
    }
  }

  return null;
}

// A-CREER-03 (copies doubles) : garde-fou prix, comme demandé depuis la
// correction v7 (repris en v10) même si le produit existe déjà (créé lors
// d'un import précédent). Ne modifie le prix d'aucun autre produit.
async function assurerCopiesDoubles(byRef) {
  const trouves = byRef.get("A-CREER-03");
  const produit = trouves?.length === 1 ? trouves[0] : null;

  if (produit) {
    if (produit.prix !== 1800) {
      const { error } = await supabase.from("produits").update({ prix: 1800 }).eq("id", produit.id);
      if (error) console.error("Copies doubles : échec MAJ prix vente —", error.message);
      else produit.prix = 1800;
    }
    return;
  }

  const { data: categorie, error: errCat } = await supabase
    .from("categories")
    .select("id")
    .eq("nom", "Cahiers & papeterie")
    .single();
  if (errCat || !categorie) {
    console.error("Copies doubles : catégorie « Cahiers & papeterie » introuvable —", errCat?.message);
    return;
  }

  const { data: inserted, error: errIns } = await supabase
    .from("produits")
    .insert({
      nom: "Paquet de copies doubles grand format",
      prix: 1800,
      prix_achat: 1300,
      categorie_id: categorie.id,
      statut: "dispo",
      statut_publication: "en_attente",
      reference_fournisseur: "A-CREER-03",
      unite_vente: "paquet",
      photo_a_ameliorer: true,
      vendeur_id: "00000000-0000-0000-0000-000000000001",
      publie_par: "admin",
    })
    .select("id, nom, prix, statut, statut_publication, reference_fournisseur")
    .single();
  if (errIns) {
    console.error("Copies doubles : échec création —", errIns.message);
    return;
  }
  console.log(`Copies doubles créées (#${inserted.id}, masquées, photo à fournir).`);
  byRef.set("A-CREER-03", [inserted]);
}

function genererRapportResolution(byRef, byNom, byNomNormalise) {
  const lignes = [
    "# Rapport de résolution des références (correction v10)",
    "",
    `Lancé le ${new Date().toISOString()}.`,
    "",
    "| Référence | Nom attendu | Produit trouvé | Méthode | Drapeau prix |",
    "|---|---|---|---|---|",
  ];

  const refs = Object.entries(kitsJson.references).sort(([a], [b]) => a.localeCompare(b));
  let trouvees = 0;
  let ambigues = 0;
  let introuvables = 0;

  for (const [ref, meta] of refs) {
    const resultat = resoudre(ref, meta.nom, byRef, byNom, byNomNormalise);
    let colProduit = "—";
    let colMethode = "introuvable";
    let colDrapeau = "";

    if (resultat?.ambigu) {
      colMethode = `ambiguë (${resultat.methode})`;
      colProduit = "plusieurs produits correspondent";
      ambigues++;
    } else if (resultat?.produit) {
      const p = resultat.produit;
      colProduit = `#${p.id} ${p.nom} — ${p.prix} F (${p.statut}/${p.statut_publication})`;
      colMethode = resultat.methode;
      trouvees++;
      if (meta.prix_vente_classeur && p.prix) {
        const ecart = Math.abs(p.prix - meta.prix_vente_classeur) / meta.prix_vente_classeur;
        if (ecart > 0.5) colDrapeau = `⚠️ écart ${Math.round(ecart * 100)}% vs classeur (${meta.prix_vente_classeur} F)`;
      }
    } else {
      introuvables++;
    }

    lignes.push(
      `| ${ref} | ${meta.nom} | ${colProduit} | ${colMethode} | ${colDrapeau} |`,
    );
  }

  lignes.push(
    "",
    `Total : ${refs.length} références — ${trouvees} trouvées, ${ambigues} ambiguës, ${introuvables} introuvables.`,
  );

  writeFileSync("import-kits/rapport-resolution.md", lignes.join("\n"), "utf8");
  console.log(
    `Résolution : ${trouvees}/${refs.length} trouvées, ${ambigues} ambiguës, ${introuvables} introuvables.`,
  );
}

async function supprimerAnciensKits() {
  const slugs = kitsJson.slugs_supprimes ?? [];
  if (slugs.length === 0) return;
  // on delete cascade (0001_schema.sql) : supprime aussi les kit_items.
  const { error, count } = await supabase
    .from("kits")
    .delete({ count: "exact" })
    .in("slug", slugs);
  if (error) {
    console.error("Échec suppression des anciens kits —", error.message);
    return;
  }
  console.log(`Anciens kits supprimés (slugs_supprimes) : ${count ?? 0}/${slugs.length}`);
}

async function main() {
  const produits = await fetchAllProduits();
  const byRef = grouper(produits, "reference_fournisseur");
  const byNom = grouper(produits, "nom");
  const byNomNormalise = grouperNomNormalise(produits);

  await supprimerAnciensKits();
  await assurerCopiesDoubles(byRef);
  genererRapportResolution(byRef, byNom, byNomNormalise);

  const lignesIgnorees = [];
  let kitsCrees = 0;
  let kitsMisAJour = 0;
  let lignesInserees = 0;

  for (const kit of kitsJson.kits) {
    // On ne connaît pas encore si c'est un insert ou un update : on le
    // détecte via l'existence préalable du slug (pour le compte rendu et
    // pour ne jamais envoyer `statut` sur un kit existant).
    const { data: existant } = await supabase
      .from("kits")
      .select("id")
      .eq("slug", kit.slug)
      .maybeSingle();

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
      type_source: kit.type_source ?? null,
      source_interne: kit.source_interne ?? null,
      manquants_connus: kit.manquants_connus ?? [],
    };
    // Nouveau kit : statut par défaut de la colonne = "masque" (0085). Kit
    // existant : `statut` absent du payload = jamais écrasé (publication
    // manuelle préservée), même en repassant par un upsert.
    if (!existant) payloadKit.statut = "masque";

    const { data: kitRow, error: errKit } = await supabase
      .from("kits")
      .upsert(payloadKit, { onConflict: "slug" })
      .select("id")
      .single();
    if (errKit) {
      console.error(`Kit ${kit.slug} : échec upsert —`, errKit.message);
      continue;
    }
    if (existant) kitsMisAJour++;
    else kitsCrees++;

    const { error: errDelete } = await supabase.from("kit_items").delete().eq("kit_id", kitRow.id);
    if (errDelete) {
      console.error(`Kit ${kit.slug} : échec suppression des anciennes lignes —`, errDelete.message);
      continue;
    }

    const lignesAInserer = [];
    for (const ligne of kit.lignes) {
      const meta = kitsJson.references[ligne.ref];
      const resultat = resoudre(ligne.ref, meta?.nom, byRef, byNom, byNomNormalise);
      if (!resultat || resultat.ambigu || !resultat.produit) {
        lignesIgnorees.push({
          kit: kit.slug,
          ref: ligne.ref,
          libelle: ligne.libelle_besoin,
          motif: resultat?.ambigu ? "ambiguë" : "introuvable",
        });
        continue;
      }
      lignesAInserer.push({
        kit_id: kitRow.id,
        produit_id: resultat.produit.id,
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
    `- Kits créés : ${kitsCrees}`,
    `- Kits mis à jour (statut conservé) : ${kitsMisAJour}`,
    `- Total kits traités : ${kitsCrees + kitsMisAJour} / ${kitsJson.kits.length}`,
    `- Lignes insérées : ${lignesInserees}`,
    `- Lignes ignorées (référence introuvable ou ambiguë) : ${lignesIgnorees.length}`,
    "",
    "## Lignes ignorées",
    ...(lignesIgnorees.length
      ? lignesIgnorees.map((l) => `- ${l.kit} — ${l.ref} (${l.libelle}) [${l.motif}]`)
      : ["(aucune)"]),
  ].join("\n");

  writeFileSync("import-kits/rapport-import.md", rapport, "utf8");
  console.log(`Kits créés : ${kitsCrees}, mis à jour : ${kitsMisAJour} / ${kitsJson.kits.length}`);
  console.log(`Lignes insérées : ${lignesInserees}, ignorées : ${lignesIgnorees.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
