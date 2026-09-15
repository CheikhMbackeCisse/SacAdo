// SacAdo — création des 10 kits électroniques assemblés (Chantier A,
// TACHE_kits_impression_classement.md §A.7), à partir des fichiers fournis
// par le fondateur (kits.csv + composition_kits.csv, exports du classeur
// SacAdo_Kits_Electronique.xlsx). Remplace la reconstruction par prix faite
// plus tôt (6 kits) : ce fichier est la source réelle, 10 kits.
// Usage : node scripts/creer-kits-electronique-yuupee.mjs
// Prérequis : migration 0073 exécutée (produits.est_kit/niveau_difficulte,
// table composition_kit) + tous les composants déjà en base, rattachés à
// Yuupee (importer-composants-iot-yuupee.mjs + le complément ESP32-CAM-MB).
// Idempotent par nom de produit / par (kit_id, composant_id).
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

const DOSSIER = "C:/Users/WORLD INFORMATIQUE/Downloads/kits_electronique_reel";

function parseCsv(chemin) {
  const texte = readFileSync(chemin, "utf8").replace(/^\uFEFF/, "");
  const [enteteLigne, ...lignes] = texte.trim().split(/\r?\n/);
  const entetes = enteteLigne.split(";");
  return lignes.map((ligne) => {
    const valeurs = ligne.split(";");
    return Object.fromEntries(entetes.map((h, i) => [h, valeurs[i]]));
  });
}

// Tout non-alphanum\u00e9rique retir\u00e9 (pas juste r\u00e9duit \u00e0 une espace) : les noms
// diff\u00e8rent parfois seulement par une espace ("9 V" vs "9V", "128\u00d764" vs
// "128x64"), qu'un simple trim ne suffit pas \u00e0 absorber.
function normaliser(s) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Différences de graphie entre les CSV (ASCII, sans accents) et les noms
// réellement en base (importer-composants-iot-yuupee.mjs / catalogue
// électronique) : la normalisation ci-dessus gère les accents et la casse ;
// ces quelques cas restent différents même normalisés (mots ou ponctuation
// différents), résolus à la main après vérification manuelle un par un.
const CORRESPONDANCES_MANUELLES = {
  [normaliser("Kit de 6 moteurs a courant continu avec roues")]: normaliser("Kit de 6 moteurs à courant continu"),
  [normaliser("Moteur DC a engrenage avec roue")]: normaliser("moteur DC à engrenage et roues AD015"),
  [normaliser("DHT22 / AM2302 Capteur temperature et humidite")]: normaliser("DHT22 / AM2302 Module de capteur d’humidité"),
  // "×" (signe multiplication, U+00D7) n'est pas une lettre "x" pour NFKD :
  // retiré comme ponctuation côté base ("12864"), gardé comme lettre côté
  // CSV ASCII ("128x64") — les deux clés ne coïncident pas sans ce repli.
  [normaliser("Module OLED 0,96 pouces 128x64")]: normaliser("Module OLED 0,96 pouces 128×64"),
};

async function main() {
  const kitsCsv = parseCsv(`${DOSSIER}/kits.csv`);
  const compositionCsv = parseCsv(`${DOSSIER}/composition_kits.csv`);

  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "Yuupee").single();
  if (!vendeur) throw new Error("Fournisseur Yuupee introuvable.");

  const { data: sousCatKits } = await supabase
    .from("sous_categories")
    .select("id, categorie_id")
    .eq("id", 106) // Kits SacAdo, sous Électronique (8)
    .single();
  if (!sousCatKits) throw new Error("Sous-catégorie 'Kits SacAdo' introuvable (creer-categories-yuupee-electronique.mjs a-t-il tourné ?).");

  // Index de tous les produits Yuupee, par nom normalisé, pour résoudre les
  // composants du CSV vers leur produit_id réel.
  const { data: produitsYuupee } = await supabase.from("produits").select("id, nom, prix_achat").eq("vendeur_id", vendeur.id);
  const parNomNormalise = new Map();
  for (const p of produitsYuupee ?? []) {
    parNomNormalise.set(normaliser(p.nom), p);
  }

  function resoudreComposant(nomCsv) {
    const cle = normaliser(nomCsv);
    const cleCorrigee = CORRESPONDANCES_MANUELLES[cle];
    const produit = parNomNormalise.get(cle) ?? (cleCorrigee ? parNomNormalise.get(cleCorrigee) : undefined);
    if (!produit) throw new Error(`Composant introuvable en base : "${nomCsv}" (normalisé: "${cle}")`);
    return produit;
  }

  // Composition groupée par kit (nom CSV -> liste de {composant, quantite}).
  const compositionParKit = new Map();
  for (const ligne of compositionCsv) {
    const liste = compositionParKit.get(ligne.kit) ?? [];
    liste.push({ composant: ligne.composant, quantite: Number(ligne.quantite) });
    compositionParKit.set(ligne.kit, liste);
  }

  let kitsCrees = 0;
  let kitsIgnores = 0;
  let lignesComposition = 0;

  for (const k of kitsCsv) {
    // Les CSV sont en ASCII sans accents ; noms d'affichage corrects posés à
    // la main (plus sûr qu'une regex générique de ré-accentuation).
    const NOMS_FR = {
      "Kit Decouverte Arduino": "Kit Découverte Arduino",
      "Kit Radar de recul": "Kit Radar de recul",
      "Kit Alarme et detection": "Kit Alarme et détection",
      "Kit Station meteo connectee": "Kit Station météo connectée",
      "Kit Maison connectee": "Kit Maison connectée",
      "Kit Robot suiveur de ligne": "Kit Robot suiveur de ligne",
      "Kit Controle d'acces RFID": "Kit Contrôle d'accès RFID",
      "Kit Camera connectee": "Kit Caméra connectée",
      "Kit Objets connectes longue portee": "Kit Objets connectés longue portée",
      "Kit Robot explorateur 4 roues": "Kit Robot explorateur 4 roues",
    };
    const nomFinal = NOMS_FR[k.kit] ?? k.kit;
    const niveau = { Debutant: "debutant", Intermediaire: "intermediaire", Avance: "avance" }[k.niveau];
    if (!niveau) throw new Error(`Niveau inconnu : ${k.niveau} (${k.kit})`);

    const composants = compositionParKit.get(k.kit) ?? [];
    if (composants.length === 0) throw new Error(`Aucune composition trouvée pour ${k.kit}`);

    const resolus = composants.map((c) => ({ produit: resoudreComposant(c.composant), quantite: c.quantite }));
    const prixAchatCalcule = resolus.reduce((s, c) => s + (c.produit.prix_achat ?? 0) * c.quantite, 0);
    if (prixAchatCalcule !== Number(k.prix_achat)) {
      console.log(`  ATTENTION écart prix d'achat ${k.kit} : CSV=${k.prix_achat}, composants=${prixAchatCalcule}`);
    }

    const prixVente = Number(k.prix_vente);
    const marge = (prixVente - prixAchatCalcule) / prixVente;
    if (marge < 0.22) {
      console.log(`  ATTENTION marge sous 22% pour ${k.kit} : ${(marge * 100).toFixed(1)}%`);
    }

    const { data: existant } = await supabase.from("produits").select("id").eq("nom", nomFinal).maybeSingle();
    let kitId;
    if (existant) {
      kitId = existant.id;
      kitsIgnores++;
      console.log(`= kit déjà présent : ${nomFinal} (#${kitId})`);
    } else {
      const { data: cree, error } = await supabase
        .from("produits")
        .insert({
          nom: nomFinal,
          categorie_id: sousCatKits.categorie_id,
          sous_categorie_id: sousCatKits.id,
          prix: prixVente,
          prix_achat: prixAchatCalcule,
          delai: "6j",
          photo: null,
          photos: [],
          stock: 1,
          seuil_alerte: 1,
          statut: "dispo",
          description: k.description || null,
          vendeur_id: vendeur.id,
          publie_par: "admin",
          statut_publication: "en_attente",
          est_kit: true,
          niveau_difficulte: niveau,
        })
        .select("id")
        .single();
      if (error || !cree) throw new Error(`Création échouée (${nomFinal}) : ${error?.message}`);
      kitId = cree.id;
      kitsCrees++;
      console.log(`✓ kit créé : ${nomFinal} (#${kitId}) — achat ${prixAchatCalcule}, vente ${prixVente}, marge ${(marge * 100).toFixed(1)}%`);
    }

    for (const { produit, quantite } of resolus) {
      const { error } = await supabase
        .from("composition_kit")
        .upsert({ kit_id: kitId, composant_id: produit.id, quantite }, { onConflict: "kit_id,composant_id" });
      if (error) throw new Error(`Composition échouée (${nomFinal} / ${produit.nom}) : ${error.message}`);
      lignesComposition++;
    }
  }

  console.log(`\n${kitsCrees} kits créés, ${kitsIgnores} déjà présents, ${lignesComposition} lignes de composition écrites.`);
  console.log(`Tous en statut_publication = 'en_attente', sans photo (aucune photo de montage fournie) : non publiables tant qu'une photo n'est pas ajoutée.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
