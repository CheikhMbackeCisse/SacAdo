// SacAdo — maj-publication/PROMPT-publication-korka.md §1
// Publie les 92 produits `en_attente` (59 Yuupee, 32 Seye Dynamique
// Technologie, 1 SacAdo — paquet de copies doubles), après nettoyage du nom.
// Ne touche jamais aux `refuse` ni aux `archive`. Idempotent : relançable.
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

// Restes de page web observés à l'import (ID 1001 : "Roll over image to zoom in").
const PREFIXES_A_RETIRER = [/^Roll over image to zoom in\s*/i];

const ENTITES_HTML = {
  "&amp;": "&", "&#38;": "&",
  "&quot;": '"', "&#34;": '"',
  "&apos;": "'", "&#39;": "'",
  "&lt;": "<", "&#60;": "<",
  "&gt;": ">", "&#62;": ">",
  "&nbsp;": " ",
  "&#8217;": "’", "&#8216;": "‘",
};

function decoderEntitesHtml(nom) {
  return nom.replace(/&[a-zA-Z#0-9]{2,8};/g, (m) => ENTITES_HTML[m] ?? m);
}

// "CRUCIAL BARETTE DDR4 16GB PC4 2666 DESKTOP" -> "Crucial barette Ddr4 16GB..."
// non : on garde en majuscules tout token qui contient un chiffre (codes,
// modèles, unités : DDR4, 16GB, HP-951XL...) ou qui fait 4 lettres ou moins
// (sigles : HP, USB, SSD, LCD...) ; le reste passe en casse normale.
function enCasseNormale(mot) {
  const lettres = mot.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (lettres.length === 0) return mot;
  if (/\d/.test(mot)) return mot;
  if (lettres.length <= 4 && lettres === lettres.toUpperCase()) return mot;
  return mot.charAt(0) + mot.slice(1).toLowerCase();
}

function nettoyerNom(nomBrut) {
  let nom = nomBrut;
  for (const re of PREFIXES_A_RETIRER) nom = nom.replace(re, "");
  nom = decoderEntitesHtml(nom).trim().replace(/\s+/g, " ");

  const lettres = nom.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  const entierementMajuscules = lettres.length > 0 && lettres === lettres.toUpperCase();
  if (entierementMajuscules) {
    nom = nom.split(" ").map(enCasseNormale).join(" ");
  }
  return nom;
}

async function main() {
  const { data: produits, error } = await supabase
    .from("produits")
    .select("id, nom, photo, photos")
    .eq("statut_publication", "en_attente")
    .order("id");
  if (error) throw error;

  console.log(`${produits.length} produits en_attente trouvés.\n`);

  const sansImage = [];
  let renommes = 0;
  for (const p of produits) {
    const nomPropre = nettoyerNom(p.nom);
    const patch = { statut_publication: "publie" };
    if (nomPropre !== p.nom) {
      patch.nom = nomPropre;
      renommes++;
      console.log(`  ✎ [${p.id}] "${p.nom}" -> "${nomPropre}"`);
    }
    const { error: updErr } = await supabase.from("produits").update(patch).eq("id", p.id);
    if (updErr) {
      console.log(`  ! [${p.id}] échec de mise à jour : ${updErr.message}`);
      continue;
    }
    const aUneImage = Boolean(p.photo) || (Array.isArray(p.photos) && p.photos.length > 0);
    if (!aUneImage) sansImage.push({ id: p.id, nom: nomPropre });
  }

  console.log(`\n${produits.length} produits publiés, ${renommes} noms nettoyés.`);
  if (sansImage.length > 0) {
    console.log(`\n${sansImage.length} produits publiés SANS IMAGE (à illustrer) :`);
    for (const p of sansImage) console.log(`  - [${p.id}] ${p.nom}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
