// SacAdo — réparation urgente (TACHE_photos_et_accueil.md, chantier A.3) :
// les 34 produits Thioune Teranga "lot 1" utilisent la vignette 78×78 px de
// la négociation comme photo catalogue (agrandie à l'affichage, bouillie de
// pixels). Le lot 2 (A02-A09, photos WhatsApp réelles) n'est pas concerné.
// Dépublie ces 34 produits (statut_publication = 'en_attente', même effet
// que le bouton "Dépublier" de /admin/produits) en attendant de vraies
// photos (scripts/reparer-photos-thioune-lot1.mjs).
// Usage : node scripts/depublier-thioune-lot1.mjs
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

// Noms exacts copiés de LOT_1 dans scripts/importer-thioune-teranga.mjs.
const NOMS_LOT_1 = [
  "Modem routeur Wi-Fi 4G LTE, emplacement SIM",
  "Modem routeur Wi-Fi TP-Link",
  "Routeur modem Wi-Fi 4G de poche, emplacement SIM, batterie 3000 mAh",
  "Amplificateur de signal Wi-Fi AC 300 Mbps",
  "Répéteur Wi-Fi 2,4 et 5 GHz",
  "Clé USB Wi-Fi 300 Mbps",
  "Mini adaptateur USB Wi-Fi TP-Link TL-WN823N 300 Mbps",
  "Support pliable en aluminium pour ordinateur portable",
  "Souris sans fil rechargeable STARLIGHT 2,4 GHz / Bluetooth",
  "Tablette Survival K3000, 16 Go, 1 To",
  "Tablette origimo 10\" 5G, 8 Go, 512 Go",
  "Tablette oteeto TAB16 10,1\" Android 14, clavier et stylet inclus",
  "Tablette redbeat A2 10,1\", 8 Go, 128 Go, Android 14",
  "Tablette redbeat C1 8\", 6 Go, 64 Go, Android 14",
  "Tablette Easyfun 10,1\", 16 Go + 1 To, clavier et souris inclus",
  "Tablette redbeat C1 8\", 6 Go, 64 Go, Android 14 (2)",
  "MacBook Air 13\" puce M4",
  "MacBook Air puce M2",
  "MacBook Air 13\" puce M2",
  "HP Elite x360 1040 G11 14\" Core Ultra 7, 16 Go, 512 Go SSD",
  "HP EliteBook 1040 x360 G11 14\" Core Ultra 7, 16 Go, 512 Go SSD, tactile",
  "HP ZBook Core Ultra 7, 32 Go, 512 Go SSD",
  "HP All In One 24\" Core i5, 8 Go, 1 To SSD",
  "HP OmniBook 7 14-KH0000NF 14\" Ryzen AI 9 HX 475, 64 Go, 1 To SSD, OLED",
  "HP ProBook 450 G10 Core i5 13e génération, 16 Go, 1 To SSD, 15,6\" Full HD",
  "HP EliteBook 830 G8 Core i5, 8 Go, 256 Go SSD, 13\" tactile",
  "ACEMAGIC 15,6\" FHD IPS, Intel N150, 16 Go, 512 Go SSD",
  "Lenovo ThinkPad T14 Core i5, 16 Go, SSD",
  "Lenovo ThinkPad X1 Carbon Gen 12 Core Ultra 7 155H",
  "HP ProBook (modèle et configuration à préciser)",
  "HP EliteBook x360 1030 G4 Core i7, 16 Go, 256 Go SSD",
  "HP EliteBook 840 G6 Core i5, 8 Go, 256 Go SSD",
  "HP EliteBook 840 G5",
  "HP 250 Dual Core, 4 Go, 256 Go SSD",
];

async function main() {
  console.log(`${NOMS_LOT_1.length} noms à traiter (requête par nom individuel — .in() avec 34 chaînes accentuées dépasse la limite d'URL PostgREST et tronque silencieusement).`);

  let manquants = 0;
  let dejaMasques = 0;
  let depublies = 0;

  for (const nom of NOMS_LOT_1) {
    const { data: produit, error } = await supabase
      .from("produits")
      .select("id, nom, statut_publication")
      .eq("nom", nom)
      .maybeSingle();
    if (error) throw new Error(`Lecture échouée (${nom}) : ${error.message}`);
    if (!produit) {
      console.log(`MANQUANT : ${nom}`);
      manquants++;
      continue;
    }
    if (produit.statut_publication !== "publie") {
      dejaMasques++;
      continue;
    }
    const { error: errUpdate } = await supabase
      .from("produits")
      .update({ statut_publication: "en_attente" })
      .eq("id", produit.id);
    if (errUpdate) throw new Error(`Mise à jour échouée (#${produit.id}) : ${errUpdate.message}`);
    console.log(`✓ dépublié #${produit.id} ${produit.nom}`);
    depublies++;
  }

  console.log(`\n${depublies} dépubliés, ${dejaMasques} déjà masqués, ${manquants} manquants.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
