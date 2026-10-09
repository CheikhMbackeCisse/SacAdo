// PROMPT_FINAL_CATALOGUE_KITS.md — Lot 4 : prix Didactikos (didactikos_prix.xlsx).
// Dry-run par défaut ; --apply pour écrire. Sauvegarde les produits touchés
// avant toute écriture.
//
// Usage : node scripts/lot4-prix-didactikos.mjs [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import xlsx from "xlsx";
import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VENDEUR_CISSE_ID = "c57af6ff-4007-4dc1-b430-80176218de16";
const CATEGORIE_LIVRES_ID = 6;
const SOUS_CATEGORIE_ELEMENTAIRE_ID = 117;

const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const rapport = [];
const log = (s) => {
  console.log(s);
  rapport.push(s);
};

// Image + description relevées manuellement sur editionsdidactikos.sn pour
// les 8 produits « Créer » (pas de fiche existante à mettre à jour).
const FICHES_A_CREER = {
  "https://editionsdidactikos.sn/produit/production-decrits-ce1/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2026/06/Capture-decran-2026-06-07-a-20.23.12.png",
    description:
      "Destiné aux élèves du Cours Élémentaire 1re année (CE1), ce cahier d'activités accompagne les apprenants dans le développement progressif de leurs compétences en production écrite. À travers des activités variées, l'élève apprend à enrichir son vocabulaire, organiser ses idées et produire des textes clairs, cohérents et adaptés à différentes situations de communication.",
  },
  "https://editionsdidactikos.sn/produit/etude-de-la-langue-ce1/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-04-08-a-10.49.37.png",
    description:
      "Complément du manuel et du cahier d'activités de Langue et Communication, il propose une démarche active et progressive autour de quatre étapes : Je lis et je comprends, Je réfléchis et je découvre, Je retiens et Je m'exerce.",
  },
  "https://editionsdidactikos.sn/produit/production-decrits-ce2/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-06-07-a-20.30.12.png",
    description:
      "Destiné aux élèves du Cours Élémentaire 2e année (CE2), ce cahier d'activités accompagne les apprenants dans le développement progressif de leurs compétences en production écrite. À travers une démarche progressive et des activités variées, l'élève apprend à enrichir son vocabulaire, structurer ses idées et produire des écrits clairs, cohérents et adaptés à différentes situations de communication.",
  },
  "https://editionsdidactikos.sn/produit/etude-de-la-langue-ce2/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-04-07-a-15.54.41.png",
    description:
      "Complément du manuel et du cahier d'activités de Langue et Communication, il propose une démarche pédagogique active et progressive.",
  },
  "https://editionsdidactikos.sn/produit/production-decrits-cm1/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-06-07-a-20.39.22.png",
    description:
      "À travers des activités progressives, l'élève apprend à identifier les caractéristiques de chaque type de texte, enrichir son vocabulaire, organiser ses idées et construire des écrits clairs, cohérents et pertinents.",
  },
  "https://editionsdidactikos.sn/produit/etude-de-la-langue-cm1/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-04-07-a-15.54.27.png",
    description:
      "Destiné aux élèves du Cours Moyen 1re année (CM1), ce cahier d'activités est conçu conformément aux orientations du curriculum de l'éducation de base du Sénégal (2016).",
  },
  "https://editionsdidactikos.sn/produit/production-decrits-cm2/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-06-07-a-20.39.50.png",
    description:
      "À travers des activités variées et progressives, l'élève apprend à identifier les caractéristiques de chaque type de texte, enrichir son vocabulaire, organiser ses idées et produire des écrits clairs, cohérents et pertinents.",
  },
  "https://editionsdidactikos.sn/produit/etude-de-la-langue-cm2/": {
    image: "https://editionsdidactikos.sn/wp-content/uploads/2025/07/Capture-decran-2026-04-07-a-15.54.09.png",
    description:
      "Destiné aux élèves du Cours Moyen 2e année (CM2), ce cahier d'activités est conçu conformément aux orientations du curriculum de l'éducation de base du Sénégal (2016).",
  },
};

async function telechargerEtCompresser(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Téléchargement échoué (${reponse.status}) : ${url}`);
  const buf = Buffer.from(await reponse.arrayBuffer());
  let qualite = 80;
  let webp = await sharp(buf).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: qualite }).toBuffer();
  while (webp.length > 200 * 1024 && qualite > 35) {
    qualite -= 10;
    webp = await sharp(buf).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: qualite }).toBuffer();
  }
  return webp;
}

async function uploaderImage(buffer, slug) {
  const chemin = `didactikos-nouveaux/${slug}-${randomUUID()}.webp`;
  const { error } = await sb.storage.from("produits").upload(chemin, buffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw new Error(`Upload échoué (${slug}) : ${error.message}`);
  const { data } = sb.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

function slugifier(nom) {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const wb = xlsx.readFile("C:/Users/WORLD INFORMATIQUE/Downloads/extracted_46/sacado_catalogue_kits/didactikos_prix.xlsx");
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }).slice(1);

  log(`# Rapport Lot 4 — prix Didactikos (${APPLY ? "APPLIQUÉ" : "DRY-RUN"}) — ${horodatage}\n`);

  const aMettreAJour = rows.filter((r) => r[6] === "Mettre à jour · Sûr");
  const aCreer = rows.filter((r) => r[6] === "Créer");
  const nonCommunique = rows.filter((r) => String(r[6]).startsWith("Prix non communiqué"));
  log(`${aMettreAJour.length} à mettre à jour, ${aCreer.length} à créer, ${nonCommunique.length} prix non communiqué (rien à faire).\n`);

  // --------------------------------------------------------------------------
  // Mettre à jour (123) : prix d'achat, prix de vente (achat + 500), fournisseur.
  // --------------------------------------------------------------------------
  log("## Mises à jour\n");
  if (APPLY) {
    const ids = aMettreAJour.map((r) => r[4]);
    const { data: avant } = await sb.from("produits").select("*").in("id", ids);
    writeFileSync(`scripts/_backup_produits_lot4_${horodatage}.json`, JSON.stringify(avant, null, 1));
    log(`Sauvegarde : scripts/_backup_produits_lot4_${horodatage}.json (${avant.length} produits)\n`);
  }

  let nbMaj = 0;
  const anomaliesNom = [];
  for (const r of aMettreAJour) {
    const [titre, , achat, , id, nomActuel] = r;
    const vente = achat + 500;
    const { data: produitActuel } = await sb.from("produits").select("nom").eq("id", id).maybeSingle();
    if (!produitActuel) {
      log(`  ERREUR : produit #${id} (${titre}) introuvable en base.`);
      continue;
    }
    if (produitActuel.nom !== nomActuel) {
      anomaliesNom.push(`#${id} : nom en base "${produitActuel.nom}" ≠ nom attendu "${nomActuel}"`);
    }
    if (APPLY) {
      const { error } = await sb
        .from("produits")
        .update({
          prix_achat: achat,
          prix: vente,
          vendeur_id: VENDEUR_CISSE_ID,
          prix_achat_previsionnel: false,
        })
        .eq("id", id);
      if (error) log(`  ERREUR maj #${id} (${titre}) : ${error.message}`);
      else nbMaj += 1;
    } else {
      nbMaj += 1;
    }
  }
  log(`${nbMaj} produit(s) ${APPLY ? "mis à jour" : "seraient mis à jour"} (prix d'achat, prix de vente, fournisseur Cissé & Frères).`);
  if (anomaliesNom.length > 0) {
    log(`\n⚠ ${anomaliesNom.length} nom(s) en base différents du nom attendu dans le fichier (mis à jour quand même, nom non touché) :`);
    for (const a of anomaliesNom) log(`  - ${a}`);
  }
  log("");

  // --------------------------------------------------------------------------
  // Créer (8) : nouveaux produits, catégorie Livres et annales > Élémentaire.
  // --------------------------------------------------------------------------
  log("## Créations\n");
  for (const r of aCreer) {
    const [titre, niveau, achat, , , , , , lien] = r;
    const vente = achat + 500;
    const fiche = FICHES_A_CREER[lien];
    if (!fiche) {
      log(`  ERREUR : pas de fiche (image/description) préparée pour "${titre}" (${lien}).`);
      continue;
    }
    log(`- ${titre} (${niveau}) — achat ${achat} / vente ${vente} — ${lien}`);
    if (APPLY) {
      const webp = await telechargerEtCompresser(fiche.image);
      log(`  image compressée : ${(webp.length / 1024).toFixed(0)} Ko`);
      const url = await uploaderImage(webp, slugifier(titre));
      const { error } = await sb.from("produits").insert({
        nom: titre,
        categorie_id: CATEGORIE_LIVRES_ID,
        sous_categorie_id: SOUS_CATEGORIE_ELEMENTAIRE_ID,
        prix: vente,
        prix_achat: achat,
        prix_achat_previsionnel: false,
        delai: "6j",
        stock: 0,
        statut: "dispo",
        statut_publication: "publie",
        publie_par: "admin",
        vendeur_id: VENDEUR_CISSE_ID,
        gamme: "essentiel",
        unite_vente: "unite",
        editeur: "Éditions Didactikos",
        type_ouvrage: "Cahier d'activités",
        niveau,
        description: fiche.description,
        photo: url,
        photos: [url],
      });
      if (error) log(`  ERREUR création "${titre}" : ${error.message}`);
      else log(`  ✓ créé`);
    }
  }
  log("");

  // --------------------------------------------------------------------------
  // Prix non communiqué (4) : rien à faire, juste le signaler.
  // --------------------------------------------------------------------------
  log("## Prix non communiqué (aucune action)\n");
  for (const r of nonCommunique) log(`- ${r[0]} (${r[1]})`);
  log("");

  // --------------------------------------------------------------------------
  // « Autres produits proches » (doublons possibles), listés pour info.
  // --------------------------------------------------------------------------
  log("## Autres produits proches (doublons possibles, signalés — rien touché)\n");
  for (const r of rows) {
    if (r[7]) log(`- ${r[5] || r[0]} (#${r[4] || "—"}) : ${r[7]}`);
  }

  writeFileSync(`rapport-lot4-didactikos-${horodatage}.md`, rapport.join("\n"));
  console.log(`\nRapport écrit : rapport-lot4-didactikos-${horodatage}.md`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
