// Import du catalogue Cissé & Frères (import-cisse-freres/produits.json).
// Usage : node scripts/importer-cisse-freres.mjs
// Lit .env.local. Idempotent par (vendeur_id, reference_fournisseur = slug du
// fichier source, index unique posé par la migration 0083) : relancer met à
// jour au lieu de recréer un doublon.
//
// Décisions actées avec le fondateur avant d'écrire :
//   - Les 4 ardoises (groupe "ardoise") fusionnent en UN seul produit "Ardoise
//     quadrillée" à 2 500 FCFA avec 4 variantes de couleur (produit_variantes
//     + variante_attributs, attribut "Couleur" déjà en base). Sa clé
//     d'idempotence est la constante REFERENCE_ARDOISE ci-dessous (aucun
//     slug du fichier source ne représente le produit fusionné).
//   - Les 12 trousses (groupe "trousse", variante null) restent 12 produits
//     séparés : ce sont 12 modèles différents, pas des couleurs d'un même
//     article.
//   - Sous-catégorie assignée seulement quand la correspondance est nette
//     (trousses, ardoises, colle, marqueurs, stylo) — voir SOUS_CATEGORIE_PAR.
//     Les autres (cahiers/blocs/carnets, brosse, set boîte+gourde) restent
//     sans sous-catégorie : pas de correspondance fiable en base.
//   - stock 1 / seuil_alerte 1 / statut "dispo" / statut_publication "publie"
//     pour les 32 : catalogue complet (prix, photos, descriptions), publié
//     direct comme Papex. Le stock ne bloque plus rien côté client et ne
//     bascule jamais "Épuisé" tout seul depuis la migration 0071 — stock 1
//     ne fait donc que nourrir l'alerte de réappro admin.
//   - unite_vente "unite" pour les 32 (tout vendu à la pièce).
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DATA_DIR = path.join(process.cwd(), "import-cisse-freres");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const CATALOGUE_PATH = path.join(DATA_DIR, "produits.json");

const VENDEUR_NOM = "Cissé & Frères";
const STORAGE_PREFIX = "cisse-freres";
const REFERENCE_ARDOISE = "ardoise-quadrillee";

const SOUS_CATEGORIE_PAR = (item) => {
  if (item.groupe === "trousse") return "trousses";
  if (item.groupe === "ardoise") return "ardoises";
  if (item.slug.startsWith("colle-")) return "colle-adhesifs";
  if (item.slug.startsWith("marqueur-")) return "marqueurs";
  if (item.slug === "stylo-stitch-10-couleurs") return "stylos";
  return null;
};

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

// Un seul appel réseau par fichier physique.
const urlsDejaTeleversees = new Map();

async function televerserImage(nomFichier) {
  if (urlsDejaTeleversees.has(nomFichier)) return urlsDejaTeleversees.get(nomFichier);

  const cheminLocal = path.join(IMAGES_DIR, path.basename(nomFichier));
  const octets = await readFile(cheminLocal);
  const cheminStorage = `${STORAGE_PREFIX}/${path.basename(nomFichier)}`;
  const { error } = await supabase.storage.from("produits").upload(cheminStorage, octets, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true, // même fichier source à chaque relance, jamais un contenu différent sous ce nom
  });
  if (error) throw new Error(`Upload échoué (${nomFichier}) : ${error.message}`);

  const { data } = supabase.storage.from("produits").getPublicUrl(cheminStorage);
  urlsDejaTeleversees.set(nomFichier, data.publicUrl);
  return data.publicUrl;
}

async function upsertProduit(payload, referenceFournisseur, vendeurId) {
  const { data: existant } = await supabase
    .from("produits")
    .select("id")
    .eq("vendeur_id", vendeurId)
    .eq("reference_fournisseur", referenceFournisseur)
    .maybeSingle();

  if (existant) {
    const { error } = await supabase.from("produits").update(payload).eq("id", existant.id);
    if (error) throw new Error(`Mise à jour échouée (${referenceFournisseur}) : ${error.message}`);
    return { id: existant.id, cree: false };
  }
  const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
  if (error || !inserted) throw new Error(`Création échouée (${referenceFournisseur}) : ${error?.message}`);
  return { id: inserted.id, cree: true };
}

async function upsertVariante(produitId, couleur, attributCouleurId, payload) {
  const { data: variantes, error: errList } = await supabase
    .from("produit_variantes")
    .select("id, variante_attributs(attribut_id, valeur)")
    .eq("produit_id", produitId);
  if (errList) throw new Error(`Lecture des variantes échouée (produit #${produitId}) : ${errList.message}`);

  const existante = (variantes ?? []).find((v) =>
    v.variante_attributs.some((a) => a.attribut_id === attributCouleurId && a.valeur === couleur),
  );

  if (existante) {
    const { error } = await supabase.from("produit_variantes").update(payload).eq("id", existante.id);
    if (error) throw new Error(`Mise à jour de variante échouée (${couleur}) : ${error.message}`);
    return { id: existante.id, cree: false };
  }

  const { data: variante, error: errVar } = await supabase
    .from("produit_variantes")
    .insert({ produit_id: produitId, ...payload })
    .select("id")
    .single();
  if (errVar || !variante) throw new Error(`Création de variante échouée (${couleur}) : ${errVar?.message}`);

  const { error: errAttr } = await supabase
    .from("variante_attributs")
    .insert({ variante_id: variante.id, attribut_id: attributCouleurId, valeur: couleur });
  if (errAttr) throw new Error(`Attribut de variante échoué (${couleur}) : ${errAttr.message}`);

  return { id: variante.id, cree: true };
}

async function main() {
  const catalogue = JSON.parse(await readFile(CATALOGUE_PATH, "utf8"));
  const produitsSource = catalogue.produits;
  console.log(`${produitsSource.length} produits Cissé & Frères à traiter.`);

  const noms = [...new Set(produitsSource.map((p) => p.categorie))];
  const { data: categories, error: errCat } = await supabase.from("categories").select("id, nom").in("nom", noms);
  if (errCat) throw new Error(`Lecture catégories échouée : ${errCat.message}`);
  const idCategorie = Object.fromEntries(categories.map((c) => [c.nom, c.id]));
  for (const nom of noms) {
    if (!idCategorie[nom]) throw new Error(`Catégorie introuvable en base : "${nom}"`);
  }

  const slugsSousCategorie = ["trousses", "ardoises", "colle-adhesifs", "marqueurs", "stylos"];
  const { data: sousCategories, error: errSc } = await supabase
    .from("sous_categories")
    .select("id, slug")
    .in("slug", slugsSousCategorie);
  if (errSc) throw new Error(`Lecture sous-catégories échouée : ${errSc.message}`);
  const idSousCategorie = Object.fromEntries(sousCategories.map((s) => [s.slug, s.id]));

  const { data: attributCouleur, error: errAttr } = await supabase
    .from("attributs")
    .select("id")
    .ilike("nom", "couleur")
    .single();
  if (errAttr || !attributCouleur) throw new Error("Attribut 'Couleur' introuvable (migration 0022 exécutée ?).");

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
    if (error || !cree) throw new Error(`Création du fournisseur ${VENDEUR_NOM} échouée : ${error?.message}`);
    vendeur = cree;
    console.log(`✓ fournisseur créé : ${VENDEUR_NOM} (#${vendeur.id})`);
  } else {
    console.log(`= fournisseur déjà présent : ${VENDEUR_NOM} (#${vendeur.id})`);
  }

  const ardoises = produitsSource.filter((p) => p.groupe === "ardoise");
  const autres = produitsSource.filter((p) => p.groupe !== "ardoise");

  let crees = 0;
  let misAJour = 0;
  let variantesCreees = 0;
  let variantesMisesAJour = 0;

  for (const item of autres) {
    const photo = await televerserImage(item.image);
    const payload = {
      nom: item.nom,
      categorie_id: idCategorie[item.categorie],
      sous_categorie_id: idSousCategorie[SOUS_CATEGORIE_PAR(item)] ?? null,
      sous_sous_categorie_id: null,
      prix: item.prix_vente,
      prix_achat: item.prix_achat ?? null,
      prix_a_verifier: false,
      delai: "6j",
      photo,
      photos: [photo],
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      description: item.description,
      vendeur_id: vendeur.id,
      publie_par: "admin",
      statut_publication: "publie",
      motif_refus: null,
      marque: null,
      mots_cles: null,
      gamme: null,
      unite_vente: "unite",
      quantite_conditionnement: null,
      equivalent_id: null,
      guide_tailles: false,
      reference_fournisseur: item.slug,
    };
    const { id, cree } = await upsertProduit(payload, item.slug, vendeur.id);
    console.log(`${cree ? "✓ créé" : "= mis à jour"} #${id} : ${item.slug} — ${item.nom}`);
    if (cree) crees++;
    else misAJour++;
  }

  if (ardoises.length > 0) {
    const photosArdoises = [];
    for (const a of ardoises) photosArdoises.push(await televerserImage(a.image));

    const premiere = ardoises[0];
    const payloadParent = {
      nom: "Ardoise quadrillée",
      categorie_id: idCategorie[premiere.categorie],
      sous_categorie_id: idSousCategorie.ardoises ?? null,
      sous_sous_categorie_id: null,
      prix: premiere.prix_vente,
      prix_achat: premiere.prix_achat ?? null,
      prix_a_verifier: false,
      delai: "6j",
      photo: photosArdoises[0],
      photos: photosArdoises,
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      description: "Ardoise noire quadrillée avec poignée, disponible en plusieurs couleurs de contour.",
      vendeur_id: vendeur.id,
      publie_par: "admin",
      statut_publication: "publie",
      motif_refus: null,
      marque: null,
      mots_cles: null,
      gamme: null,
      unite_vente: "unite",
      quantite_conditionnement: null,
      equivalent_id: null,
      guide_tailles: false,
      reference_fournisseur: REFERENCE_ARDOISE,
    };
    const { id: produitId, cree } = await upsertProduit(payloadParent, REFERENCE_ARDOISE, vendeur.id);
    console.log(`${cree ? "✓ créé" : "= mis à jour"} #${produitId} : ${REFERENCE_ARDOISE} — Ardoise quadrillée`);
    if (cree) crees++;
    else misAJour++;

    for (let i = 0; i < ardoises.length; i++) {
      const a = ardoises[i];
      const { id: varianteId, cree: varianteCreee } = await upsertVariante(produitId, a.variante, attributCouleur.id, {
        prix: a.prix_vente,
        stock: 1,
        statut: "dispo",
        photo: photosArdoises[i],
      });
      console.log(
        `  ${varianteCreee ? "✓ variante créée" : "= variante mise à jour"} #${varianteId} : ${a.variante}`,
      );
      if (varianteCreee) variantesCreees++;
      else variantesMisesAJour++;
    }
  }

  console.log(
    `\n${crees} produits créés, ${misAJour} mis à jour, ${variantesCreees} variantes créées, ${variantesMisesAJour} variantes mises à jour.`,
  );
  console.log(`Fichiers uniques téléversés dans le bucket "produits/${STORAGE_PREFIX}/" : ${urlsDejaTeleversees.size}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
