// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 2 (stylos Staedtler et
// Bic vendus à l'unité, plus de lots). Suit exactement le gabarit déjà en
// place pour Schneider Tops 505 M (#1635/1636 : mêmes vendeur/prix/refs
// SAC-xxx) sauf que Staedtler/Bic sont réellement fournis par LPD (déjà
// vendeur des boîtes existantes), donc on garde ce fournisseur plutôt que
// "à préciser". Idempotent : upsert sur reference_fournisseur.
// Usage : node scripts/maj-26-09-section2-stylos.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
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

const IMAGES_DIR = "maj-26-09/images/produits";
const CATEGORIE_ECRITURE = 3;
const VENDEUR_LPD = "bcb4028f-ddf4-4ac2-990a-e399bb7086db";

async function televerser(nomFichier) {
  const octets = readFileSync(`${IMAGES_DIR}/${nomFichier}`);
  const chemin = `sacado/${nomFichier}`;
  const { error } = await supabase.storage.from("produits").upload(chemin, octets, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(`Upload ${nomFichier} : ${error.message}`);
  return supabase.storage.from("produits").getPublicUrl(chemin).data.publicUrl;
}

async function supprimerLot(id, libelle) {
  const { error } = await supabase.from("produits").delete().eq("id", id);
  if (error) {
    console.error(`✗ suppression #${id} ${libelle} —`, error.message);
    ajouterEntree({ section: "2", cible: libelle, action: "suppression lot", statut: "echec", detail: error.message });
    return;
  }
  console.log(`✓ suppression lot #${id} ${libelle}`);
  ajouterEntree({ section: "2", cible: libelle, action: "suppression lot", statut: "supprime_reel", produit_id: id });
}

async function creerOuMaj(ref, champs, libelle) {
  const { data: existant } = await supabase.from("produits").select("id").eq("reference_fournisseur", ref).maybeSingle();
  if (existant) {
    const { error } = await supabase.from("produits").update(champs).eq("id", existant.id);
    if (error) { console.error(`✗ maj ${libelle} —`, error.message); return; }
    console.log(`= déjà créé, mis à jour #${existant.id} ${libelle}`);
    ajouterEntree({ section: "2", cible: libelle, action: "creation/maj", statut: "fait", produit_id: existant.id });
    return;
  }
  const { data, error } = await supabase
    .from("produits")
    .insert({
      reference_fournisseur: ref,
      categorie_id: CATEGORIE_ECRITURE,
      vendeur_id: VENDEUR_LPD,
      delai: "6j",
      stock: 0,
      seuil_alerte: 1,
      statut: "dispo",
      statut_publication: "publie",
      publie_par: "admin",
      unite_vente: "inconnu",
      prix_achat: null,
      ...champs,
    })
    .select("id")
    .single();
  if (error) {
    console.error(`✗ création ${libelle} —`, error.message);
    ajouterEntree({ section: "2", cible: libelle, action: "creation", statut: "echec", detail: error.message });
    return;
  }
  console.log(`✓ créé #${data.id} ${libelle}`);
  ajouterEntree({ section: "2", cible: libelle, action: "creation", statut: "fait", produit_id: data.id });
}

const COULEURS = ["bleu", "noir", "rouge", "vert"];

async function main() {
  // Suppression des lots Staedtler et Bic existants.
  await supprimerLot(1208, "Présentoir stylos Staedtler Stick 430 rouge (lot)");
  await supprimerLot(1267, "Stylos Staedtler Stick 430 boîte de 10 bleu (lot)");
  await supprimerLot(1275, "Stylos Staedtler Stick 430 boîte de 10 vert (lot)");
  await supprimerLot(1214, "Stylos BIC Cristal Original 5 couleurs (lot)");

  // Staedtler Stick 430 M à l'unité (100F) + pack de 4 (400F).
  for (const couleur of COULEURS) {
    const url = await televerser(`stylo-staedtler-stick-430-${couleur}.webp`);
    await creerOuMaj(
      `stylo-staedtler-stick-430-${couleur}`,
      {
        nom: `Stylo à bille Staedtler Stick 430 M (Couleur: ${couleur[0].toUpperCase()}${couleur.slice(1)})`,
        prix: 100,
        marque: "Staedtler",
        photo: url,
        photos: [url],
      },
      `Stylo Staedtler Stick 430 M ${couleur}`,
    );
  }
  {
    const url = await televerser("pack-4-stylos-staedtler-stick-430.webp");
    await creerOuMaj(
      "pack-4-stylos-staedtler-stick-430",
      {
        nom: "Pack de 4 stylos Staedtler Stick 430 M (bleu, rouge, noir, vert)",
        prix: 400,
        marque: "Staedtler",
        photo: url,
        photos: [url],
      },
      "Pack de 4 stylos Staedtler Stick 430 M",
    );
  }

  // Bic Cristal à l'unité (100F), pas de pack demandé.
  for (const couleur of COULEURS) {
    const url = await televerser(`stylo-bic-cristal-${couleur}.webp`);
    await creerOuMaj(
      `stylo-bic-cristal-${couleur}`,
      {
        nom: `Stylo à bille Bic Cristal (Couleur: ${couleur[0].toUpperCase()}${couleur.slice(1)})`,
        prix: 100,
        marque: "Bic",
        photo: url,
        photos: [url],
      },
      `Stylo Bic Cristal ${couleur}`,
    );
  }

  console.log("\nSection 2 terminée.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
