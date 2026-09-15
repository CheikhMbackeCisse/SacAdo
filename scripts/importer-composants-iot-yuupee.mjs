// SacAdo — import des composants du petit catalogue IoT Yuupee (offre
// éducative), nécessaires à la composition des 6 kits électroniques
// (Chantier A.7). À exécuter avant creer-kits-yuupee.mjs : "les composants
// d'abord, les kits ensuite" (§8) — un kit ne peut pas référencer un produit
// inexistant.
// Usage : node scripts/importer-composants-iot-yuupee.mjs
// Idempotent par nom de produit.
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

const SOURCE_JSON = "C:/Users/WORLD INFORMATIQUE/Downloads/integration_yuupee_extract/photos_iot_composants.json";

const GRILLE_MAJORATION_YUUPEE = [
  { seuil: 5000, valeur: 500 },
  { seuil: 20000, valeur: 1000 },
  { seuil: 50000, valeur: 2500 },
  { seuil: 150000, valeur: 5000 },
  { seuil: 400000, valeur: 10000 },
  { seuil: null, valeur: 20000 },
];
function palier(prix, grille) {
  for (const p of grille) {
    if (p.seuil === null || prix < p.seuil) return p.valeur;
  }
  throw new Error(`Aucun palier pour ${prix}`);
}

const SOUS_CAT_ARDUINO = ["Arduino UNO R3 ATmega328P CH340", "Arduino Nano ATmega328P", "Arduino Mega 2560",
  "ESP32 DevKit WiFi + Bluetooth", "ESP32-CAM", "Kit Arduino Starter"];
const SOUS_CAT_RASPBERRY = ["Raspberry Pi 3 Modèle B+ 64 bits"];
// Le reste va dans "Modules et capteurs" (id 103).

async function main() {
  const lignes = JSON.parse(readFileSync(SOURCE_JSON, "utf8"));

  const { data: vendeur } = await supabase.from("vendeurs").select("id").ilike("nom_boutique", "Yuupee").single();
  if (!vendeur) throw new Error("Fournisseur Yuupee introuvable.");

  const { data: sousCats } = await supabase.from("sous_categories").select("id, slug, categorie_id").eq("categorie_id", 8);
  const parSlug = Object.fromEntries((sousCats ?? []).map((s) => [s.slug, s]));

  let crees = 0;
  let ignores = 0;
  let rejetes = 0;

  for (const l of lignes) {
    if (l.prix_public == null || l.prix_public === 0) {
      console.log(`REJET prix nul/absent : ${l.designation}`);
      rejetes++;
      continue;
    }

    const cible = SOUS_CAT_ARDUINO.includes(l.designation)
      ? parSlug["arduino"]
      : SOUS_CAT_RASPBERRY.includes(l.designation)
        ? parSlug["raspberry-pi"]
        : parSlug["modules-capteurs"];

    const { data: existant } = await supabase.from("produits").select("id").eq("nom", l.designation).maybeSingle();
    if (existant) {
      ignores++;
      continue;
    }

    const prixAchat = Math.round(l.prix_public);
    const prixVente = prixAchat + palier(prixAchat, GRILLE_MAJORATION_YUUPEE);

    const { error } = await supabase.from("produits").insert({
      nom: l.designation,
      categorie_id: cible.categorie_id,
      sous_categorie_id: cible.id,
      prix: prixVente,
      prix_achat: prixAchat,
      delai: "6j",
      photo: l.url,
      photos: [l.url],
      stock: 1,
      seuil_alerte: 1,
      statut: "dispo",
      description: null,
      vendeur_id: vendeur.id,
      publie_par: "admin",
      statut_publication: "en_attente",
      prix_a_verifier: false,
    });
    if (error) throw new Error(`Insertion échouée (${l.designation}) : ${error.message}`);
    crees++;
    console.log(`✓ créé : ${l.designation} — achat ${prixAchat}, vente ${prixVente}`);
  }

  console.log(`\n${crees} créés, ${ignores} déjà présents, ${rejetes} rejetés (prix nul/absent).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
