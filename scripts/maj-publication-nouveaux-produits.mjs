// SacAdo — maj-publication/PROMPT-publication-korka.md §2
// Crée (ou met à jour si déjà présents) les 3 nouveaux produits : le pack
// Livre parlant + 4 cahiers magiques (Korka Diallo), et la calculatrice Casio
// fx-991ES Plus. Idempotent par nom.
import { readFileSync } from "node:fs";
import { readFile as readFileP } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

const VENDEUR_SACADO_ID = "00000000-0000-0000-0000-000000000001";
const LARGEUR_MAX = 800;
const QUALITE_WEBP = 82;
const IMAGES_DIR = "maj-publication/images";

async function uploaderPhoto(filename, dossier) {
  const buf = await readFileP(`${IMAGES_DIR}/${filename}`);
  const webp = await sharp(buf).resize({ width: LARGEUR_MAX, withoutEnlargement: true }).webp({ quality: QUALITE_WEBP }).toBuffer();
  const chemin = `${dossier}/${randomUUID()}.webp`;
  const { error } = await supabase.storage.from("produits").upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${filename}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

async function creerOuMajProduit(nom, champs, imageFichier) {
  const { data: existant } = await supabase.from("produits").select("id, photo").ilike("nom", nom).maybeSingle();

  if (existant) {
    const patch = { ...champs };
    if (!existant.photo && imageFichier) {
      const url = await uploaderPhoto(imageFichier, "maj-publication");
      patch.photo = url;
      patch.photos = [url];
    }
    const { error } = await supabase.from("produits").update(patch).eq("id", existant.id);
    if (error) throw error;
    console.log(`  = [${existant.id}] "${nom}" mis à jour (déjà existant).`);
    return existant.id;
  }

  const url = imageFichier ? await uploaderPhoto(imageFichier, "maj-publication") : null;
  const { data: cree, error } = await supabase
    .from("produits")
    .insert({
      nom,
      vendeur_id: VENDEUR_SACADO_ID,
      publie_par: "admin",
      statut_publication: "publie",
      delai: "6j",
      stock: 15,
      seuil_alerte: 3,
      photo: url,
      photos: url ? [url] : [],
      ...champs,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  ✓ [${cree.id}] "${nom}" créé.`);
  return cree.id;
}

async function main() {
  const { data: cats } = await supabase.from("categories").select("id, slug");
  const idCat = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  const { data: sousCats } = await supabase.from("sous_categories").select("id, slug, categorie_id");
  const idSousCat = (catSlug, scSlug) =>
    sousCats.find((s) => s.categorie_id === idCat[catSlug] && s.slug === scSlug)?.id ?? null;

  // --- Pack Livre parlant + 4 cahiers magiques offerts (Korka Diallo) ---
  await creerOuMajProduit(
    "Pack Livre parlant 300+ mots + 4 cahiers magiques offerts",
    {
      prix: 12900,
      prix_achat: 10320,
      categorie_id: idCat["livres-manuels"],
      sous_categorie_id: idSousCat("livres-manuels", "eveil-maternelle"),
      niveau: "Maternelle",
      type_ouvrage: "cahier d activites",
      marque: "Leleyu",
      description:
        "Un livre sonore de 11 thèmes (lettres, chiffres, animaux, métiers...) pour découvrir en jouant, avec 4 cahiers réutilisables offerts (alphabet, chiffres, mathématiques, dessins) : l'encre s'efface, l'enfant recommence autant de fois qu'il veut.",
    },
    "pack-livre-parlant-4-cahiers-magiques.webp",
  );

  // --- Les 4 cahiers magiques : DÉJÀ AU CATALOGUE (id 79), déjà conforme
  //     (prix, catégorie, 2 photos, publié) -> rien à faire, juste vérifié.
  const { data: cahiersExistants } = await supabase
    .from("produits")
    .select("id, prix, prix_achat, statut_publication")
    .ilike("nom", "%4 cahiers magiques%")
    .maybeSingle();
  if (cahiersExistants) {
    console.log(
      `  = [${cahiersExistants.id}] "Les 4 cahiers magiques" déjà au catalogue (${cahiersExistants.prix} F, achat ${cahiersExistants.prix_achat} F, ${cahiersExistants.statut_publication}) — aucune modification.`,
    );
  }

  // --- Calculatrice scientifique Casio fx-991ES Plus ---
  await creerOuMajProduit(
    "Calculatrice scientifique Casio fx-991ES Plus",
    {
      prix: 4750,
      prix_achat: 3700,
      categorie_id: idCat["fournitures-ecole"],
      marque: "Casio",
      description:
        "Calculatrice scientifique Casio fx-991ES Plus : plus de 400 fonctions, écran haute résolution, fonctions statistiques et calculs matriciels — idéale du collège au supérieur.",
    },
    "calculatrice-casio-fx-991es-plus.webp",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
