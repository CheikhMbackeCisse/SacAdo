// Corrections ponctuelles + publication de la papeterie LPD, demandées
// directement par le fondateur (chat du 2026-09-20) :
//   - S008 : supprimé (aucun prix, pas de piste chez LPD).
//   - S038 : prix 7000 / achat 6000 (confirmés par le fondateur).
//   - S066 : nouvelles photos (2), le manifeste pointait vers une image
//     montrant un autre produit (kit de géométrie, vérifié visuellement).
//   - Tous les autres articles papeterie (réf. commençant par "S") publiés,
//     y compris les 10 sans photo publiable (S006, S060, S063, S072, S077,
//     S078, S090, S094, S132, S133) — dérogation explicite du fondateur
//     ("c'est pas grave la mtn"), à ne pas reproduire ailleurs sans
//     confirmation aussi explicite.
// Usage : node scripts/publier-lpd-grille.mjs
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
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

const DEROGATION_SANS_PHOTO = [
  "S006", "S060", "S063", "S072", "S077", "S078", "S090", "S094", "S132", "S133",
];
const PHOTOS_S066 = [
  "C:\\Users\\WORLD INFORMATIQUE\\Downloads\\photo 066\\81drbhd88al._ac_sx569__1_.webp", // face
  "C:\\Users\\WORLD INFORMATIQUE\\Downloads\\photo 066\\61uij5ppwil._ac_sx569_.webp",   // tranche
];

async function uploaderPhoto(fichier, ref) {
  const buf = await readFile(fichier);
  const webp = await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const chemin = `import-lpd/${ref}-${randomUUID()}.webp`;
  const { error } = await supabase.storage.from("produits").upload(chemin, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload échoué (${fichier}) : ${error.message}`);
  return supabase.storage.from("produits").getPublicUrl(chemin).data.publicUrl;
}

async function main() {
  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "LPD").maybeSingle();
  if (!vendeur) throw new Error("Vendeur LPD introuvable.");

  // 1. S008 : suppression
  const { data: s008 } = await supabase.from("produits").select("id").eq("vendeur_id", vendeur.id).eq("reference_fournisseur", "S008").maybeSingle();
  if (s008) {
    const { error } = await supabase.from("produits").delete().eq("id", s008.id);
    if (error) throw new Error(`Suppression S008 échouée : ${error.message}`);
    console.log(`✓ S008 supprimé (#${s008.id})`);
  } else {
    console.log("= S008 déjà absent");
  }

  // 2. S038 : prix confirmé
  const { data: s038, error: errS038 } = await supabase
    .from("produits")
    .update({ prix: 7000, prix_achat: 6000, prix_a_verifier: false })
    .eq("vendeur_id", vendeur.id)
    .eq("reference_fournisseur", "S038")
    .select("id")
    .single();
  if (errS038 || !s038) throw new Error(`Mise à jour S038 échouée : ${errS038?.message}`);
  console.log(`✓ S038 mis à jour (#${s038.id}) : prix 7000, achat 6000`);

  // 3. S066 : nouvelles photos
  console.log("… upload des 2 photos S066");
  const urls066 = [];
  for (const fichier of PHOTOS_S066) urls066.push(await uploaderPhoto(fichier, "S066"));
  const { data: s066, error: errS066 } = await supabase
    .from("produits")
    .update({ photo: urls066[0], photos: urls066 })
    .eq("vendeur_id", vendeur.id)
    .eq("reference_fournisseur", "S066")
    .select("id")
    .single();
  if (errS066 || !s066) throw new Error(`Mise à jour photos S066 échouée : ${errS066?.message}`);
  console.log(`✓ S066 mis à jour (#${s066.id}) : ${urls066.length} photos`);

  // 4. Publication de toute la papeterie (réf. "S%"), avec dérogation photo
  //    pour la liste ci-dessus.
  const { data: papeterie, error: errLecture } = await supabase
    .from("produits")
    .select("id, reference_fournisseur, nom, photo, statut_publication")
    .eq("vendeur_id", vendeur.id)
    .like("reference_fournisseur", "S%");
  if (errLecture) throw new Error(`Lecture papeterie échouée : ${errLecture.message}`);

  let publies = 0;
  let deja = 0;
  let bloques = [];
  for (const p of papeterie) {
    if (p.statut_publication === "publie") { deja++; continue; }
    const aUneDerogation = DEROGATION_SANS_PHOTO.includes(p.reference_fournisseur);
    if (!p.photo && !aUneDerogation) {
      bloques.push(p);
      continue;
    }
    const { error } = await supabase.from("produits").update({ statut_publication: "publie" }).eq("id", p.id);
    if (error) throw new Error(`Publication échouée (${p.reference_fournisseur}) : ${error.message}`);
    console.log(`✓ publié : ${p.reference_fournisseur} — ${p.nom}${aUneDerogation ? " (sans photo, dérogation)" : ""}`);
    publies++;
  }

  console.log(`\nTerminé : ${publies} publiés, ${deja} déjà publiés, ${bloques.length} bloqués (imprévu).`);
  if (bloques.length) console.log("Bloqués :", bloques.map((b) => b.reference_fournisseur));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
