// Import ponctuel du catalogue livres Korka Diallo (TACHE_livres_korka_integration.md).
// Usage : node scripts/importer-livres-korka.mjs
// Prérequis : migration 0068 déjà exécutée en base. Lit .env.local. Idempotent
// par titre (relancer après une coupure réessaie seulement ce qui manque).
//
// Sources (hors dépôt, fournies avec la tâche) :
//   DATA_JSON  = chemin du JSON produit par scratchpad/build_livres_korka_json.py
//   PHOTOS_DIR = dossier contenant les 43 photos (photos_korka/)
// Par défaut, pointe vers le scratchpad de la session qui a préparé l'import.
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SCRATCHPAD =
  "C:\\Users\\WORLDI~1\\AppData\\Local\\Temp\\claude\\C--Users-WORLD-INFORMATIQUE-Downloads-SacAdo\\c4c2f17d-7008-4481-b7d8-9e46c155808b\\scratchpad";
const DATA_JSON = process.env.DATA_JSON ?? path.join(SCRATCHPAD, "livres-korka.json");
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? path.join(SCRATCHPAD, "files7", "photos_korka");

const VENDEUR_SACADO_ID = "00000000-0000-0000-0000-000000000001";
const LARGEUR_MAX = 800;
const QUALITE_WEBP = 82;

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

// Copie minimale de lib/images/sniff.ts (fichier .ts non importable tel quel
// dans un script .mjs jetable) : mêmes magic bytes, même logique.
function snifferImage(octets) {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return "jpg";
  if (
    octets.length >= 8 &&
    octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47 &&
    octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a
  ) return "png";
  if (
    octets.length >= 12 &&
    octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46 &&
    octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50
  ) return "webp";
  return null;
}

async function uploaderPhoto(filename) {
  const buf = await readFile(path.join(PHOTOS_DIR, filename));
  if (!snifferImage(buf.subarray(0, 12))) {
    throw new Error(`Fichier non reconnu comme image : ${filename}`);
  }
  const webp = await sharp(buf)
    .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
    .webp({ quality: QUALITE_WEBP })
    .toBuffer();
  const chemin = `import-korka/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("produits")
    .upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${filename}) : ${error.message}`);
  const { data } = supabase.storage.from("produits").getPublicUrl(chemin);
  return data.publicUrl;
}

async function main() {
  const lignes = JSON.parse(await readFile(DATA_JSON, "utf8"));
  console.log(`${lignes.length} lignes à traiter.`);

  const disponibles = new Set(await readdir(PHOTOS_DIR));
  for (const l of lignes) {
    if (!disponibles.has(l.photo)) throw new Error(`Photo manquante : ${l.photo}`);
    if (l.photo2 && !disponibles.has(l.photo2)) throw new Error(`Photo manquante : ${l.photo2}`);
  }

  const { data: categorie, error: errCat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "livres-manuels")
    .single();
  if (errCat || !categorie) throw new Error("Catégorie 'livres-manuels' introuvable — migration 0068 exécutée ?");

  const { data: sousCats } = await supabase
    .from("sous_categories")
    .select("id, slug")
    .eq("categorie_id", categorie.id);
  const idSousCat = Object.fromEntries((sousCats ?? []).map((s) => [s.slug, s.id]));

  const groupesOuvrage = {}; // groupe -> [id, ...]
  let crees = 0;
  let ignores = 0;

  for (const l of lignes) {
    const { data: existant } = await supabase
      .from("produits")
      .select("id")
      .eq("nom", l.titre)
      .maybeSingle();
    if (existant) {
      console.log(`= déjà présent, ignoré : ${l.titre}`);
      ignores++;
      if (l.ouvrage_group) (groupesOuvrage[l.ouvrage_group] ??= []).push(existant.id);
      continue;
    }

    const sousCategorieId = idSousCat[l.sous_categorie_slug] ?? null;
    if (!sousCategorieId) throw new Error(`Sous-catégorie inconnue : ${l.sous_categorie_slug} (${l.titre})`);

    console.log(`… photo(s) : ${l.titre}`);
    const photoUrl = await uploaderPhoto(l.photo);
    const photo2Url = l.photo2 ? await uploaderPhoto(l.photo2) : null;
    const photos = photo2Url ? [photoUrl, photo2Url] : [photoUrl];

    const payload = {
      nom: l.titre,
      categorie_id: categorie.id,
      sous_categorie_id: sousCategorieId,
      prix: l.prix,
      prix_achat: l.prix_achat,
      delai: "6j",
      photo: photoUrl,
      photos,
      stock: 10,
      seuil_alerte: 3,
      statut: "dispo",
      description: l.description,
      vendeur_id: VENDEUR_SACADO_ID,
      publie_par: "admin",
      statut_publication: "en_attente",
      niveau: l.niveau,
      serie: l.serie,
      matiere: l.matiere,
      type_ouvrage: l.type_ouvrage,
      auteur: l.auteur,
      editeur: l.editeur,
      edition: l.edition,
      edition_statut: l.edition_statut,
      couverture_epreuves: l.couverture_epreuves,
    };

    const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
    if (error || !inserted) throw new Error(`Insertion échouée (${l.titre}) : ${error?.message}`);
    console.log(`✓ créé #${inserted.id} : ${l.titre}`);
    crees++;
    if (l.ouvrage_group) (groupesOuvrage[l.ouvrage_group] ??= []).push(inserted.id);
  }

  for (const [groupe, ids] of Object.entries(groupesOuvrage)) {
    if (ids.length < 2) continue;
    const ouvrageId = Math.min(...ids);
    const { error } = await supabase.from("produits").update({ ouvrage_id: ouvrageId }).in("id", ids);
    if (error) throw new Error(`Liaison ouvrage_id échouée (${groupe}) : ${error.message}`);
    console.log(`✓ ouvrage_id ${ouvrageId} partagé entre ${ids.join(", ")} (${groupe})`);
  }

  const mobama = lignes.filter((l) => l.mobama_a_verifier).map((l) => l.titre);
  console.log(`\n${crees} produits créés, ${ignores} déjà présents (ignorés).`);
  console.log(`Tous en statut_publication = 'en_attente' (masqués) : à republier depuis /admin/produits après vérification.`);
  console.log(`\nÀ NE PAS PUBLIER tant que le fournisseur n'a pas confirmé le tarif Mobama :`);
  for (const t of mobama) console.log(`  - ${t}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
