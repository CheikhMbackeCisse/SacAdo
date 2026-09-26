// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 3 (règles de nommage
// catalogue entier) : présentoirs restants, formats de cahier, entités HTML,
// Post-it. Idempotent : relit l'état avant d'écrire.
// Usage : node scripts/maj-26-09-section3-nommage.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { decoderEntitesHtml } from "./lib/entites-html.mjs";
import { ajouterEntree } from "./lib/journal-maj-26-09.mjs";

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

async function fetchAll(select) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from("produits").select(select).order("id").range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function maj(id, champs, libelle, section = "3") {
  const { error } = await supabase.from("produits").update(champs).eq("id", id);
  if (error) {
    console.error(`✗ #${id} ${libelle} —`, error.message);
    ajouterEntree({ section, cible: libelle, action: JSON.stringify(champs), statut: "echec", detail: error.message });
    return;
  }
  console.log(`✓ #${id} ${libelle}`);
  ajouterEntree({ section, cible: libelle, action: JSON.stringify(champs), statut: "fait", produit_id: id });
}

function normFormat(s) {
  if (!s) return s;
  return s
    .replace(/24\s*[x×]\s*32/gi, "grand format")
    .replace(/17\s*[x×]\s*22/gi, "petit format");
}

async function main() {
  // --- « Présentoir » restants (prix < 1000F pour un article d'écriture,
  // donc pas un prix de boîte) -------------------------------------------
  await maj(1235, { nom: "Taille-crayons chiffres" }, "Presentoir taille-crayons chiffres -> Taille-crayons chiffres");
  await maj(1212, { nom: "Gommes Deli motif smiley" }, "Gommes Deli motif smiley (presentoir) -> sans le mot");
  ajouterEntree({
    section: "3",
    cible: "Scan catalogue « présentoir »/« (lot) »",
    action: "audit",
    statut: "fait",
    detail:
      "Seuls #1235 et #1212 restaient à corriger (prix < 1000F, renommés). Les autres correspondances '(lot)'/'lot de' du catalogue " +
      "(pochettes, chasubles, hélices, capteurs, crayons couleur, cahiers vendus par 5...) sont de vrais lots multi-articles : non touchés, conformément à la consigne " +
      "« ne supprime/renomme aucun autre produit vendu en lot ».",
  });

  // --- Formats de cahier : 24x32 -> grand format, 17x22 -> petit format ---
  const produits = await fetchAll("id, nom, description");
  let formatsMaj = 0;
  for (const p of produits) {
    const nouveauNom = normFormat(p.nom);
    const nouvelleDesc = normFormat(p.description);
    if (nouveauNom !== p.nom || nouvelleDesc !== p.description) {
      await maj(p.id, { nom: nouveauNom, description: nouvelleDesc }, `${p.nom} -> ${nouveauNom}`);
      formatsMaj++;
    }
  }
  console.log(`Formats de cahier corrigés : ${formatsMaj}`);

  // --- Entités HTML dans les noms (et descriptions, par prudence) ---------
  let entitesMaj = 0;
  for (const p of produits) {
    const nouveauNom = decoderEntitesHtml(p.nom);
    const nouvelleDesc = decoderEntitesHtml(p.description);
    if (nouveauNom !== p.nom || nouvelleDesc !== p.description) {
      await maj(p.id, { nom: nouveauNom, description: nouvelleDesc }, `Entités HTML décodées : ${p.nom} -> ${nouveauNom}`);
      entitesMaj++;
    }
  }
  console.log(`Entités HTML décodées : ${entitesMaj}`);

  // --- Post-it : notes adhésives repositionnables, jamais les vrais blocs-notes ---
  const CATEGORIE_ETIQUETTES_MOTS_CLES = "étiquettes"; // pas de table de tags multi-catégorie : ajouté aux mots-clés (recherche/filtre)
  const postIt = [
    { id: 1200, nom: "Post-it repositionnables couleurs" },
    { id: 1228, nom: "Post-it Sticky Notes DHA" },
    { id: 1643, nom: "Post-it 75 x 75 mm Infonotes (100 feuilles)" },
  ];
  for (const item of postIt) {
    const { data: p } = await supabase.from("produits").select("mots_cles").eq("id", item.id).single();
    const motsCles = (p?.mots_cles ?? "").toString();
    const motsAjoutes = motsCles.toLowerCase().includes(CATEGORIE_ETIQUETTES_MOTS_CLES)
      ? motsCles
      : `${motsCles} ${CATEGORIE_ETIQUETTES_MOTS_CLES}`.trim();
    await maj(item.id, { nom: item.nom, mots_cles: motsAjoutes }, `Post-it : ${item.nom}`);
  }
  ajouterEntree({
    section: "3",
    cible: "Post-it -> filtre Étiquettes",
    action: "mots_cles",
    statut: "cas_douteux",
    detail:
      "Pas de table de rattachement multi-catégorie dans le schéma actuel (un produit n'a qu'une seule sous_categorie_id, " +
      "et la déplacer vers 'Étiquettes' (sous cat. 11) les sortirait de Cahiers & papeterie). Choix : mot-clé 'étiquettes' ajouté " +
      "à mots_cles pour qu'ils remontent en recherche/filtre par mot-clé, sans changer leur catégorie principale. #1690 'Petit " +
      "bloc-notes vert et jaune' (1200F) est ambigu (ni 'spirale' ni 'repositionnable' dans le nom) : laissé en l'état, à trancher.",
  });

  console.log("\nSection 3 terminée.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
