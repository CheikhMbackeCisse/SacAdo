// Import ponctuel du catalogue Ndayane Sport (TACHE_ndayane_sport_et_variantes.md).
// Usage : node scripts/importer-ndayane-sport.mjs
// Prérequis : migration 0069 déjà exécutée en base. Lit .env.local. Idempotent
// par nom de produit (relancer après une coupure réessaie seulement ce qui manque).
//
// Écarts assumés par rapport au document de tâche (voir chat) :
//   - Les 2 articles écartés (shaker, ensemble aux couleurs de club) ne sont
//     pas dans la liste ci-dessous : ils ne doivent jamais être importés.
//   - Aucune photo n'est attachée. Les photos WhatsApp fournies montrent soit
//     les 2 articles écartés eux-mêmes, soit des produits de marque (Nike,
//     Under Armour, Wilson/NBA) non recadrables sans dénaturer l'image — ce qui
//     violerait la règle "aucun nom de marque" (§3.3). 3 articles (ballon cousu
//     main, survêtement, t-shirt camouflage) n'ont aucune photo du tout parmi
//     les fichiers fournis. Tout est importé masqué (statut_publication =
//     'en_attente') : à illustrer avec de vraies photos avant publication.
//   - "Corde à sauter" : la colonne du tableur dit juste "Plusieurs coloris"
//     sans les nommer -> importée sans variantes formelles (pas de couleurs
//     inventées), à affiner si le fournisseur precise sa gamme.
//   - Stock : 0 partout, y compris les 2 articles dont un total est connu
//     (50 ballons waterproof, 10 manchons) car la répartition par taille/
//     couleur n'est pas connue -> notée en description, à répartir par
//     l'admin avant publication (§3.2).
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

const VENDEUR_SACADO_ID = "00000000-0000-0000-0000-000000000001";

// prix = round(prix_achat * (1 + marge)), repris tel quel du fichier
// "SacAdo_Ndayane_Sport (1).xlsx" (version la plus récente).
const PRODUITS = [
  {
    nom: "Ballon de football cousu main, taille 5",
    sousCategorieSlug: "ballons",
    prixAchat: 10000,
    marge: 0.25,
    description: "Ballon de football cousu main, taille 5. Disponible en plusieurs couleurs.",
    variantes: { couleur: ["Bleu", "Noir", "Jaune"] },
  },
  {
    nom: "Ballon de basket",
    sousCategorieSlug: "ballons",
    prixAchat: 8000,
    marge: 0.25,
    description: "Ballon de basket, tailles 6 et 7.",
    variantes: { taille: ["6", "7"] },
  },
  {
    nom: "Ballon de football waterproof",
    sousCategorieSlug: "ballons",
    prixAchat: 5000,
    marge: 0.25,
    description:
      "Ballon de football waterproof, tailles 4 et 5. 50 pièces en stock chez le fournisseur, à répartir par taille avant publication.",
    variantes: { taille: ["4", "5"] },
  },
  {
    nom: "Chasubles de sport, lot de 10",
    sousCategorieSlug: "accessoires-eps",
    prixAchat: 10000,
    marge: 0.25,
    description:
      "Lot de 10 chasubles de sport, taille standard. Plusieurs couleurs disponibles pour différencier les équipes.",
    variantes: { couleur: ["Vert", "Rouge", "Jaune", "Orange", "Vert fluo", "Violet", "Bleu"] },
  },
  {
    nom: "Manchons de maintien pour protège-tibias, la paire",
    sousCategorieSlug: "accessoires-eps",
    prixAchat: 1500,
    marge: 0.5,
    description:
      "Manchons de maintien pour protège-tibias, vendus par paire. 10 pièces en stock chez le fournisseur, à répartir par couleur avant publication.",
    variantes: { couleur: ["Noir", "Blanc", "Rouge", "Bleu", "Vert fluo"] },
  },
  {
    nom: "Corde à sauter, avec ou sans compteur",
    sousCategorieSlug: "accessoires-eps",
    prixAchat: 2000,
    marge: 0.4,
    description:
      "Corde à sauter avec ou sans compteur intégré, plusieurs coloris disponibles (à préciser avec le fournisseur).",
    variantes: null,
  },
  {
    nom: "Ensemble survêtement de sport, veste et pantalon",
    sousCategorieSlug: "tenues-sport",
    prixAchat: 8000,
    marge: 0.25,
    description: "Ensemble survêtement de sport (veste et pantalon), du L au 3XL, en plusieurs couleurs.",
    variantes: { taille: ["L", "XL", "2XL", "3XL"], couleur: ["Vert", "Bleu", "Rouge", "Noir"] },
    guideTailles: true,
  },
  {
    nom: "T-shirt de sport respirant, motif camouflage",
    sousCategorieSlug: "tenues-sport",
    prixAchat: 2500,
    marge: 0.3,
    description: "T-shirt de sport respirant, motif camouflage, du M au XL, en plusieurs couleurs.",
    variantes: { taille: ["M", "L", "XL"], couleur: ["Noir", "Kaki", "Bleu", "Turquoise"] },
    guideTailles: true,
  },
  {
    nom: "T-shirt de sport respirant, uni",
    sousCategorieSlug: "tenues-sport",
    prixAchat: 2500,
    marge: 0.3,
    description: "T-shirt de sport respirant uni, du L au 3XL, en plusieurs couleurs.",
    variantes: { taille: ["L", "XL", "2XL", "3XL"], couleur: ["Blanc", "Noir", "Marine"] },
    guideTailles: true,
  },
  {
    nom: "Short de sport",
    sousCategorieSlug: "tenues-sport",
    prixAchat: 2500,
    marge: 0.3,
    description: "Short de sport, en 2XL et 3XL, en plusieurs couleurs.",
    variantes: { taille: ["2XL", "3XL"], couleur: ["Vert", "Noir", "Gris"] },
    guideTailles: true,
  },
];

function combinaisons(variantes) {
  if (!variantes) return [];
  const { taille, couleur } = variantes;
  if (taille && couleur) {
    return taille.flatMap((t) => couleur.map((c) => ({ taille: t, couleur: c })));
  }
  if (taille) return taille.map((t) => ({ taille: t }));
  if (couleur) return couleur.map((c) => ({ couleur: c }));
  return [];
}

async function main() {
  const { data: categorie, error: errCat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "sport-eps")
    .single();
  if (errCat || !categorie) throw new Error("Catégorie 'sport-eps' introuvable.");

  const { data: sousCats, error: errSc } = await supabase
    .from("sous_categories")
    .select("id, slug")
    .eq("categorie_id", categorie.id);
  if (errSc) throw new Error(`Sous-catégories introuvables : ${errSc.message}`);
  const idSousCat = Object.fromEntries((sousCats ?? []).map((s) => [s.slug, s.id]));

  const { data: attributs, error: errAttr } = await supabase
    .from("attributs")
    .select("id, nom")
    .in("nom", ["Couleur", "Taille"]);
  if (errAttr) throw new Error(`Attributs introuvables : ${errAttr.message}`);
  const idAttribut = Object.fromEntries((attributs ?? []).map((a) => [a.nom.toLowerCase(), a.id]));
  if (!idAttribut.couleur || !idAttribut.taille) {
    throw new Error("Attributs 'Couleur' / 'Taille' absents (migration 0022 exécutée ?).");
  }

  let crees = 0;
  let ignores = 0;
  let varCreees = 0;

  for (const p of PRODUITS) {
    const sousCategorieId = idSousCat[p.sousCategorieSlug];
    if (!sousCategorieId) throw new Error(`Sous-catégorie inconnue : ${p.sousCategorieSlug} (${p.nom})`);

    const { data: existant } = await supabase
      .from("produits")
      .select("id")
      .eq("nom", p.nom)
      .maybeSingle();

    let produitId;
    if (existant) {
      console.log(`= déjà présent, ignoré : ${p.nom}`);
      ignores++;
      produitId = existant.id;
    } else {
      const prix = Math.round(p.prixAchat * (1 + p.marge));
      const payload = {
        nom: p.nom,
        categorie_id: categorie.id,
        sous_categorie_id: sousCategorieId,
        prix,
        prix_achat: p.prixAchat,
        delai: "6j",
        photo: null,
        stock: 0,
        seuil_alerte: 3,
        statut: "epuise",
        description: p.description,
        vendeur_id: VENDEUR_SACADO_ID,
        publie_par: "admin",
        statut_publication: "en_attente",
        guide_tailles: p.guideTailles ?? false,
      };
      const { data: inserted, error } = await supabase.from("produits").insert(payload).select("id").single();
      if (error || !inserted) throw new Error(`Insertion échouée (${p.nom}) : ${error?.message}`);
      console.log(`✓ créé #${inserted.id} : ${p.nom} — ${prix} FCFA (achat ${p.prixAchat})`);
      crees++;
      produitId = inserted.id;
    }

    const combos = combinaisons(p.variantes);
    if (combos.length === 0) continue;

    const { data: varExistantes } = await supabase
      .from("produit_variantes")
      .select("id")
      .eq("produit_id", produitId);
    if ((varExistantes ?? []).length > 0) {
      console.log(`  = variantes déjà présentes (${varExistantes.length}), ignorées.`);
      continue;
    }

    for (const combo of combos) {
      const { data: variante, error: errVar } = await supabase
        .from("produit_variantes")
        .insert({ produit_id: produitId, stock: 0, statut: "epuise", photo: null })
        .select("id")
        .single();
      if (errVar || !variante) throw new Error(`Variante échouée (${p.nom}, ${JSON.stringify(combo)}) : ${errVar?.message}`);

      const paires = [];
      if (combo.taille) paires.push({ variante_id: variante.id, attribut_id: idAttribut.taille, valeur: combo.taille });
      if (combo.couleur) paires.push({ variante_id: variante.id, attribut_id: idAttribut.couleur, valeur: combo.couleur });
      const { error: errAttrs } = await supabase.from("variante_attributs").insert(paires);
      if (errAttrs) throw new Error(`Attributs de variante échoués (${p.nom}) : ${errAttrs.message}`);
      varCreees++;
    }
    console.log(`  ✓ ${combos.length} variante(s) créée(s) pour ${p.nom}`);
  }

  console.log(`\n${crees} produits créés, ${ignores} déjà présents (ignorés), ${varCreees} variantes créées.`);
  console.log(`Tous en statut_publication = 'en_attente' (masqués), stock 0 : à compléter (photos, stock réel par variante) puis republier depuis /admin/produits.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
