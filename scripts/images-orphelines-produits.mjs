// Chantier A (TACHE_nettoyage_carrousel_preferences.md §A.3) — lecture seule.
// Repère les fichiers du bucket Storage "produits" dont le NOM DE FICHIER
// n'apparaît dans AUCUNE colonne texte de la base (pas seulement produits.photo/
// photos : une image peut être référencée depuis une galerie, une catégorie, une
// demande de produit, un document…). Recherche par nom de fichier plutôt que par
// URL exacte pour ne pas rater une variante (URL de transformation /render/image/
// public/, paramètre de cache ?t=…, encodage d'accents/espaces).
//
// N'affiche que la taille totale + la liste : NE SUPPRIME RIEN, NE DÉPLACE RIEN.
// Usage : node scripts/images-orphelines-produits.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
const BUCKET = "produits";

async function listerBucketRecursif(prefixe = "") {
  const fichiers = [];
  const { data, error } = await supabase.storage.from(BUCKET).list(prefixe, { limit: 1000 });
  if (error) {
    console.error(`Erreur listage bucket (${prefixe}):`, error.message);
    return fichiers;
  }
  for (const item of data ?? []) {
    const chemin = prefixe ? `${prefixe}/${item.name}` : item.name;
    if (item.id === null) {
      fichiers.push(...(await listerBucketRecursif(chemin)));
    } else {
      fichiers.push({ chemin, taille: item.metadata?.size ?? 0 });
    }
  }
  return fichiers;
}

async function main() {
  console.log("Listage du bucket…");
  const fichiersBucket = await listerBucketRecursif();
  const tailleTotale = fichiersBucket.reduce((s, f) => s + f.taille, 0);
  console.log(`Bucket "${BUCKET}" : ${fichiersBucket.length} fichier(s), ${(tailleTotale / 1024 / 1024).toFixed(1)} Mo au total.`);

  console.log("Vérification via texte_present_partout() — scanne toutes les colonnes texte de la base pour chaque fichier, peut prendre plusieurs minutes…");

  const orphelins = [];
  let tailleOrphelins = 0;
  let i = 0;
  for (const f of fichiersBucket) {
    i++;
    if (i % 25 === 0) console.log(`  ${i}/${fichiersBucket.length}…`);
    // Nom de fichier seul (sans dossier), décodé : c'est ce qui doit apparaître
    // quelque part si l'image est utilisée, quelle que soit la forme de l'URL
    // (directe, transformation /render/image/public/, ?t=cache…).
    const nomFichier = decodeURIComponent(f.chemin.split("/").pop());
    const { data: trouve, error } = await supabase.rpc("texte_present_partout", {
      p_motif: nomFichier,
    });
    if (error) {
      console.error(`Erreur recherche "${nomFichier}":`, error.message);
      continue;
    }
    if (!trouve) {
      orphelins.push(f);
      tailleOrphelins += f.taille;
    }
  }

  console.log(`\n${orphelins.length} fichier(s) dont le nom n'apparaît dans AUCUNE colonne texte de la base.`);
  console.log(`Poids total : ${(tailleOrphelins / 1024 / 1024).toFixed(1)} Mo.`);
  if (orphelins.length > 0) {
    console.log("\nListe :");
    for (const f of orphelins) console.log(`  ${f.chemin} (${(f.taille / 1024).toFixed(0)} Ko)`);
  }
}

main();
