// SacAdo — Purge des brouillons d'import laissés dans le bucket Storage
// "produits" (TACHE_nettoyage_carrousel_preferences.md §A.3, retour du
// fondateur : ne jamais supprimer directement, déplacer dans une corbeille
// réversible ; vérifier par recherche du nom de fichier dans TOUTES les
// colonnes texte de la base, pas seulement 2 colonnes connues).
//
// Ne supprime jamais rien : déplace les fichiers non référencés vers
// _corbeille/<chemin d'origine> dans le MÊME bucket (un `storage.move`, pas un
// upload+delete — le fichier retrouve son emplacement d'origine en une seule
// commande si besoin). Un fichier réellement inutile ne coûte qu'une inaction
// pendant 30 jours ; une image encore utilisée mais mal détectée coûte un
// simple retour en arrière au lieu d'une perte définitive.
//
// À lancer après tout import qui passe par un dossier de brouillon
// (import-yuupee-photos/, import-yuupee-iot-composants/, etc.) une fois
// l'import terminé et les produits publiés — voir telecharger-images-yuupee.mjs
// et uploader-photos-iot-composants.mjs.
//
// Prérequis : exécuter scripts/verification_images_orphelines.sql une fois
// dans le SQL Editor Supabase (crée la fonction texte_present_partout).
//
// Usage :
//   node scripts/purger-brouillons-images.mjs --prefixe=import-yuupee-photos
//   node scripts/purger-brouillons-images.mjs               (tout le bucket)
//   node scripts/purger-brouillons-images.mjs --restaurer    (vide _corbeille/
//                                                              en remettant
//                                                              chaque fichier
//                                                              à sa place)
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
const CORBEILLE = "_corbeille";

const args = process.argv.slice(2);
const prefixeArg = args.find((a) => a.startsWith("--prefixe="))?.split("=")[1] ?? "";
const restaurer = args.includes("--restaurer");

async function listerRecursif(prefixe) {
  const fichiers = [];
  const { data, error } = await supabase.storage.from(BUCKET).list(prefixe, { limit: 1000 });
  if (error) {
    console.error(`Erreur listage (${prefixe}):`, error.message);
    return fichiers;
  }
  for (const item of data ?? []) {
    const chemin = prefixe ? `${prefixe}/${item.name}` : item.name;
    if (item.id === null) fichiers.push(...(await listerRecursif(chemin)));
    else fichiers.push(chemin);
  }
  return fichiers;
}

async function restaurerCorbeille() {
  const fichiers = await listerRecursif(CORBEILLE);
  console.log(`${fichiers.length} fichier(s) dans ${CORBEILLE}/ à restaurer.`);
  for (const chemin of fichiers) {
    const original = chemin.slice(CORBEILLE.length + 1);
    const { error } = await supabase.storage.from(BUCKET).move(chemin, original);
    if (error) console.error(`  ÉCHEC restauration ${chemin} :`, error.message);
    else console.log(`  ✓ ${chemin} -> ${original}`);
  }
}

async function purger() {
  console.log(`Listage du bucket (préfixe "${prefixeArg || "(racine)"}")…`);
  const fichiers = (await listerRecursif(prefixeArg)).filter((c) => !c.startsWith(`${CORBEILLE}/`));
  console.log(`${fichiers.length} fichier(s) à vérifier.`);

  let deplaces = 0;
  let i = 0;
  for (const chemin of fichiers) {
    i++;
    if (i % 25 === 0) console.log(`  ${i}/${fichiers.length}…`);
    const nomFichier = decodeURIComponent(chemin.split("/").pop());
    const { data: trouve, error } = await supabase.rpc("texte_present_partout", { p_motif: nomFichier });
    if (error) {
      console.error(`Erreur recherche "${nomFichier}":`, error.message);
      continue;
    }
    if (trouve) continue;

    const destination = `${CORBEILLE}/${chemin}`;
    const { error: errMove } = await supabase.storage.from(BUCKET).move(chemin, destination);
    if (errMove) console.error(`  ÉCHEC déplacement ${chemin} :`, errMove.message);
    else {
      deplaces++;
      console.log(`  -> corbeille : ${chemin}`);
    }
  }
  console.log(`\n${deplaces} fichier(s) déplacé(s) vers ${CORBEILLE}/.`);
  console.log(`Pour annuler : node scripts/purger-brouillons-images.mjs --restaurer`);
  console.log(`Pour supprimer définitivement après 30 jours : vider ${CORBEILLE}/ depuis le dashboard Supabase Storage.`);
}

(restaurer ? restaurerCorbeille() : purger()).catch((err) => {
  console.error(err);
  process.exit(1);
});
