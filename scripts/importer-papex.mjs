// Import du catalogue Papex (Prompt_2_import_catalogue_Papex.md), fournisseur
// papeterie de Dakar. Usage : node scripts/importer-papex.mjs
// Lit .env.local. Idempotent par (vendeur_id, reference_fournisseur = id_sacado,
// index unique posé par la migration 0083) : relancer met à jour au lieu de
// recréer un doublon.
//
// Décisions actées avec le fondateur avant d'écrire :
//   - Les ~92 produits publiables du catalogue sont des CRÉATIONS (le
//     rapprochement contre les 1563 produits existants n'a trouvé aucune
//     correspondance, y compris par recherche floue — désignations_origine
//     ne correspond à rien de présent aujourd'hui dans SacAdo).
//   - produits_a_depublier.json ne déclenche AUCUNE écriture : ce fichier
//     documente pourquoi 137 articles Papex n'ont PAS été retenus (125 sans
//     prix trouvable, 5 vendus uniquement dans l'ensemble Superman SAC-003,
//     7 déjà couverts par Yuupee) — ce ne sont pas des produits SacAdo
//     existants à retirer de la vente.
//   - origine_prix_vente / fiabilite / remarque : ignorés (pas de colonne
//     "note interne" dans le schéma actuel, décision du fondateur).
//   - grille_majoration du fournisseur Papex : null (prix fixés pièce par
//     pièce dans le catalogue, comme Seye Dynamique — la grille de majoration
//     standard ne s'applique pas ici et n'est pas modifiée).
//   - Les 21 produits "sous-chemises Super 60 / chemises Forever" sans prix
//     de vente fiable (ambiguïté pièce/paquet) : prix=0 + prix_a_verifier=true
//     (convention déjà utilisée par l'import Yuupee, écran /admin/prix-a-verifier),
//     statut_publication='refuse'. Aucun prix n'est inventé.
//   - SAC-002 (trousse ovale) : statut_photo bloquant (seule photo porte le
//     logo Papex), reste sans image et non publié. Sa marque (Eastpak) n'est
//     jamais affichée côté client (article textile vendu sous désignation
//     générique) : on ne l'écrit donc pas dans `marque`.
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DATA_DIR =
  "C:\\Users\\WORLDI~1\\AppData\\Local\\Temp\\claude\\C--Users-WORLD-INFORMATIQUE-Downloads-SacAdo\\0828e870-2262-4723-ab01-3f27986288b1\\scratchpad\\files21\\papex\\SacAdo_integration_Papex";
const IMAGES_DIR = path.join(DATA_DIR, "images");
const CATALOGUE_PATH = path.join(DATA_DIR, "catalogue_papex.json");

const VENDEUR_NOM = "Papex";
const STORAGE_PREFIX = "papex";

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

// Un seul appel réseau par fichier physique, même s'il est référencé (400,
// 800, 1200) par une ou deux images du même produit.
const urlsDejaTeleversees = new Map();

async function televerserFichier(nomFichier, idSacadoPourErreur) {
  if (urlsDejaTeleversees.has(nomFichier)) return urlsDejaTeleversees.get(nomFichier);

  const cheminLocal = path.join(IMAGES_DIR, nomFichier);
  if (!existsSync(cheminLocal)) {
    throw new Error(`Fichier introuvable : ${nomFichier} (${idSacadoPourErreur})`);
  }

  const octets = await readFile(cheminLocal);
  const cheminStorage = `${STORAGE_PREFIX}/${nomFichier}`;
  const { error } = await supabase.storage.from("produits").upload(cheminStorage, octets, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true, // même fichier source à chaque relance, jamais un contenu différent sous ce nom
  });
  if (error) throw new Error(`Upload échoué (${nomFichier}, ${idSacadoPourErreur}) : ${error.message}`);

  const { data } = supabase.storage.from("produits").getPublicUrl(cheminStorage);
  urlsDejaTeleversees.set(nomFichier, data.publicUrl);
  return data.publicUrl;
}

// Téléverse toutes les variantes d'une image (400/800/1200) et renvoie l'URL
// publique de la variante -800 (garantie d'exister) : c'est elle qu'on stocke
// en base, le loader next/image du prompt 1 retrouve les autres par leur nom.
async function televerserImage(image, idSacado) {
  const variantes = Object.values(image.variantes);
  if (!variantes.some((v) => v.largeur >= 400)) {
    throw new Error(`Aucune variante >= 400px pour une image de ${idSacado}`);
  }
  let url800 = null;
  for (const v of variantes) {
    if (v.largeur < 400) throw new Error(`Variante sous 400px (${v.fichier}, ${idSacado})`);
    const url = await televerserFichier(v.fichier, idSacado);
    if (image.variantes["800"] && v.fichier === image.variantes["800"].fichier) url800 = url;
  }
  if (!url800) throw new Error(`Variante -800 manquante pour une image de ${idSacado}`);
  return url800;
}

async function main() {
  const catalogue = JSON.parse(await readFile(CATALOGUE_PATH, "utf8"));
  console.log(`${catalogue.length} produits Papex à traiter.`);

  const { data: categories, error: errCat } = await supabase.from("categories").select("id, nom");
  if (errCat) throw new Error(`Lecture catégories échouée : ${errCat.message}`);
  const idCategorie = Object.fromEntries(categories.map((c) => [c.nom, c.id]));

  let vendeur = (
    await supabase.from("vendeurs").select("id").ilike("nom_boutique", VENDEUR_NOM).maybeSingle()
  ).data;
  if (!vendeur) {
    const { data: cree, error } = await supabase
      .from("vendeurs")
      .insert({
        nom_boutique: VENDEUR_NOM,
        user_id: null,
        contact_telephone: null,
        grille_remise: null,
        grille_majoration: null,
        actif: true,
      })
      .select("id")
      .single();
    if (error || !cree) throw new Error(`Création du fournisseur Papex échouée : ${error?.message}`);
    vendeur = cree;
    console.log(`✓ fournisseur créé : ${VENDEUR_NOM} (#${vendeur.id})`);
  } else {
    console.log(`= fournisseur déjà présent : ${VENDEUR_NOM} (#${vendeur.id})`);
  }

  let crees = 0;
  let mis_a_jour = 0;

  for (const item of catalogue) {
    const categorieId = idCategorie[item.categorie_app];
    if (!categorieId) throw new Error(`Catégorie inconnue en base : "${item.categorie_app}" (${item.id_sacado})`);

    let photo = null;
    const photos = [];
    for (const image of item.images) {
      const url = await televerserImage(image, item.id_sacado);
      photos.push(url);
      if (image.role === "principale") photo = url;
    }
    if (item.images.length > 0 && !photo) {
      throw new Error(`Aucune image "principale" trouvée pour ${item.id_sacado}`);
    }

    const prixVenteInconnu = item.prix_vente === null || item.prix_vente === undefined;

    const payload = {
      nom: item.designation,
      categorie_id: categorieId,
      sous_categorie_id: null,
      prix: prixVenteInconnu ? 0 : item.prix_vente,
      prix_achat: item.prix_fournisseur ?? null,
      prix_a_verifier: prixVenteInconnu,
      delai: "6j",
      photo,
      photos,
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      description: null,
      vendeur_id: vendeur.id,
      publie_par: "admin",
      statut_publication: item.publier ? "publie" : "refuse",
      motif_refus: item.publier ? null : item.raison_non_publication,
      marque: item.id_sacado === "SAC-002" ? null : item.marque,
      reference_fournisseur: item.id_sacado,
    };

    const { data: existant } = await supabase
      .from("produits")
      .select("id")
      .eq("vendeur_id", vendeur.id)
      .eq("reference_fournisseur", item.id_sacado)
      .maybeSingle();

    if (existant) {
      const { error } = await supabase.from("produits").update(payload).eq("id", existant.id);
      if (error) throw new Error(`Mise à jour échouée (${item.id_sacado}) : ${error.message}`);
      console.log(`= mis à jour #${existant.id} : ${item.id_sacado} — ${item.designation}`);
      mis_a_jour++;
    } else {
      const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
      if (error || !inserted) throw new Error(`Création échouée (${item.id_sacado}) : ${error?.message}`);
      console.log(`✓ créé #${inserted.id} : ${item.id_sacado} — ${item.designation}`);
      crees++;
    }
  }

  console.log(`\n${crees} produits créés, ${mis_a_jour} mis à jour.`);
  console.log(`Fichiers uniques téléversés dans le bucket "produits/${STORAGE_PREFIX}/" : ${urlsDejaTeleversees.size}.`);
  console.log(`produits_a_depublier.json : aucune écriture (voir en-tête du script).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
