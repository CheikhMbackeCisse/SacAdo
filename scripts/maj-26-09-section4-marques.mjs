// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 4 (champ marque).
// Remplit produits.marque à partir du nom pour les marques connues, jamais
// pour les livres (categorie_id=6) ni les ebooks (categorie_id=14) : voir
// §4 "pour les livres, l'éditeur n'est pas la marque". N'écrase jamais une
// marque déjà renseignée. Idempotent.
// Usage : node scripts/maj-26-09-section4-marques.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ajouterEntree } from "./lib/journal-maj-26-09.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CATEGORIES_EXCLUES = [6, 14]; // Livres et annales, Ebooks

// Ordre : marques à 2 mots avant leurs abréviations pour éviter un faux
// rattachement (ex. "Texas Instruments" avant tout token "TI").
const MARQUES = [
  { marque: "Texas Instruments", motifs: [/texas\s*instruments/i] },
  { marque: "Faber-Castell", motifs: [/faber[\s-]?castell/i] },
  { marque: "Maped", motifs: [/\bmaped\b/i] },
  { marque: "Giotto", motifs: [/\bgiotto\b/i] },
  { marque: "Clairefontaine", motifs: [/\bclairefontaine\b/i] },
  { marque: "Calligraphe", motifs: [/\bcalligraphe\b/i] },
  { marque: "Schneider", motifs: [/\bschneider\b/i] },
  { marque: "Staedtler", motifs: [/\bstaedtler\b/i] },
  { marque: "Bic", motifs: [/\bbic\b/i] },
  { marque: "Casio", motifs: [/\bcasio\b/i] },
  { marque: "Stabilo", motifs: [/\bstabilo\b/i] },
  { marque: "Pelikan", motifs: [/\bpelikan\b/i] },
  { marque: "Exacompta", motifs: [/\bexacompta\b/i] },
  { marque: "Esselte", motifs: [/\besselte\b/i] },
];

async function fetchAll() {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, marque, categorie_id")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  const produits = await fetchAll();
  let maj = 0;
  const incertains = [];

  for (const p of produits) {
    if (p.marque) continue; // ne jamais écraser une marque déjà renseignée
    if (CATEGORIES_EXCLUES.includes(p.categorie_id)) continue;

    const trouvees = MARQUES.filter((m) => m.motifs.some((re) => re.test(p.nom)));
    if (trouvees.length === 0) continue;
    if (trouvees.length > 1) {
      incertains.push({ id: p.id, nom: p.nom, candidats: trouvees.map((t) => t.marque).join(" / ") });
      continue;
    }

    const { error } = await supabase.from("produits").update({ marque: trouvees[0].marque }).eq("id", p.id);
    if (error) {
      console.error(`✗ #${p.id} —`, error.message);
      continue;
    }
    console.log(`✓ #${p.id} ${p.nom} -> marque=${trouvees[0].marque}`);
    maj++;
  }

  console.log(`\nMarques renseignées : ${maj}`);
  ajouterEntree({
    section: "4",
    cible: "Champ marque",
    action: "remplissage",
    statut: "fait",
    detail: `${maj} produits mis à jour (hors Livres/Ebooks, jamais d'écrasement d'une marque déjà renseignée).`,
  });

  if (incertains.length) {
    console.log(`Cas incertains (plusieurs marques détectées) : ${incertains.length}`);
    for (const i of incertains) console.log(`  #${i.id} ${i.nom} -> ${i.candidats}`);
    ajouterEntree({
      section: "4",
      cible: "Champ marque (cas incertains)",
      action: "remplissage",
      statut: "cas_douteux",
      detail: incertains.map((i) => `#${i.id} ${i.nom} (${i.candidats})`).join(" ; "),
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
