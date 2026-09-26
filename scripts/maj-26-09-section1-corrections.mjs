// maj-26-09/PROMPT-maj-catalogue-26-09.md — Section 1 (corrections produit
// par produit) + fusion "Boîte à goûter ronde" + suppressions "Bouteille
// isotherme vacuum cup" et "Cahiers Sokamel". Idempotent : relire l'état
// avant d'écrire, ne réapplique pas une correction déjà faite.
// Usage : node scripts/maj-26-09-section1-corrections.mjs
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
const CATEGORIE_FOURNITURES = 11; // "Fournitures d'école" == "Fournitures scolaires" du prompt (§5)

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

async function maj(id, champs, libelle) {
  const { error } = await supabase.from("produits").update(champs).eq("id", id);
  if (error) {
    console.error(`✗ #${id} ${libelle} —`, error.message);
    ajouterEntree({ section: "1", cible: libelle, action: JSON.stringify(champs), statut: "echec", detail: error.message });
    return false;
  }
  console.log(`✓ #${id} ${libelle}`);
  ajouterEntree({ section: "1", cible: libelle, action: JSON.stringify(champs), statut: "fait", produit_id: id });
  return true;
}

async function supprimer(id, libelle) {
  const { data: ki } = await supabase.from("kit_items").select("id").eq("produit_id", id);
  const { data: ci } = await supabase.from("commande_items").select("id").eq("produit_id", id);
  if ((ki?.length ?? 0) > 0 || (ci?.length ?? 0) > 0) {
    await maj(id, { statut_publication: "archive" }, `${libelle} (suppression logique : référencé)`);
    ajouterEntree({ section: "1", cible: libelle, action: "suppression", statut: "supprime_logique", produit_id: id });
    return;
  }
  const { error } = await supabase.from("produits").delete().eq("id", id);
  if (error) {
    console.error(`✗ suppression #${id} ${libelle} —`, error.message);
    ajouterEntree({ section: "1", cible: libelle, action: "suppression", statut: "echec", detail: error.message });
    return;
  }
  console.log(`✓ suppression réelle #${id} ${libelle}`);
  ajouterEntree({ section: "1", cible: libelle, action: "suppression", statut: "supprime_reel", produit_id: id });
}

async function main() {
  // 1. Règle plastique
  await maj(1183, { prix: 100 }, "Règle plastique");

  // 2-3. Cahiers spirale
  await maj(1191, { prix: 5500 }, "Cahier spirale 8 sujets A4");
  await maj(1227, { prix: 5500 }, "Cahier spirale orange");

  // 4. Calculatrice Casio fx-92 (désambiguïsé par le prix 9000 -> #1592 ; #16
  // est un doublon archivé à 12000 F, non touché).
  await maj(1592, { prix: 8000 }, "Calculatrice Casio fx-92 Collège Classwiz");
  ajouterEntree({
    section: "1",
    cible: "Calculatrice Casio fx-92",
    action: "désambiguïsation",
    statut: "cas_douteux",
    detail: "2 correspondances par nom : #1592 (9000F, publié, choisi car prix identique à l'énoncé) et #16 (12000F, archivé, non touché).",
  });

  // 5. Calculatrice TI-83 : remplace la 1re image, ajoute la 2e.
  {
    const url1 = await televerser("calculatrice-ti-83-premium-ce-python-1.webp");
    const url2 = await televerser("calculatrice-ti-83-premium-ce-python-2.webp");
    const { data: p } = await supabase.from("produits").select("photos").eq("id", 1577).single();
    const autres = (p?.photos ?? []).slice(2); // garde d'éventuelles photos au-delà des 2 premières
    await maj(1577, { photo: url1, photos: [url1, url2, ...autres] }, "Calculatrice TI-83 (images)");
  }

  // 6. Fusion "Boîte à goûter ronde avec gourde" : #1182 (sans "ronde" dans le
  // nom) et #1196 sont le même article en 2 photos différentes (même prix
  // 3700F, même catégorie, aucune commande/kit sur les deux) — voir rapport
  // pour le détail de cette hypothèse. On garde #1196 (nom canonique).
  {
    const { data: a } = await supabase.from("produits").select("photo, photos").eq("id", 1182).single();
    const { data: b } = await supabase.from("produits").select("photo, photos").eq("id", 1196).single();
    const galerie = [...(b?.photos ?? []), ...(a?.photos ?? [])].filter((v, i, arr) => v && arr.indexOf(v) === i);
    await maj(1196, { photos: galerie }, "Boîte à goûter ronde avec gourde (fusion galerie)");
    await maj(1182, { statut_publication: "archive", equivalent_id: 1196 }, "Boîte à goûter avec gourde (doublon archivé -> redirige vers #1196)");
    ajouterEntree({
      section: "1",
      cible: "Boîte à goûter ronde avec gourde",
      action: "fusion",
      statut: "cas_douteux",
      detail: "Aucun des deux (#1182, #1196) n'a de commande/kit : hypothèse retenue faute de meilleur candidat, à confirmer.",
    });
  }

  // 7. Boîte à goûter rose avec gourde (3500F, sans photo) -> supprimer.
  await supprimer(1289, "Boîte à goûter rose avec gourde (3500F sans photo)");

  // 8. Bouteille isotherme Vacuum Cup, toute la gamme -> supprimer.
  for (const id of [1179, 1185, 1256, 1282]) {
    await supprimer(id, `Bouteille isotherme Vacuum Cup #${id}`);
  }

  // 9. Gourde inox noir sport (désambiguïsé par le prix 3100 -> #1281 ;
  // #1288 "noire et argent" à 2500F est un autre article, non touché).
  await maj(1281, { prix: 2800 }, "Gourde inox SPORT noire");

  // 10. Gourde sport spray brumisateur
  await maj(1189, { prix: 2800 }, "Gourde sport spray brumisateur");

  // 11. Brosse tableau magnétique
  await maj(1244, { prix: 400 }, "Brosse tableau blanc magnétique RX T-29");

  // 12. Marqueur tableau blanc vert
  await maj(1184, { prix: 500 }, "Marqueur tableau blanc vert");

  // 13. Présentoir correcteur Igle -> Stylo correcteur Blanco Igle
  await maj(1248, { nom: "Stylo correcteur Blanco Igle", prix: 400 }, "Présentoir correcteurs Igle -> Stylo correcteur Blanco Igle");

  // 14. Porte-mines métal (lot) -> vendu à l'unité
  await maj(1268, { nom: "Porte-mines métal", prix: 700 }, "Porte-mines métal (lot) -> Porte-mines métal");

  // 15. Stylo Stitch
  await maj(1700, { prix: 3000 }, "Stylo Stitch 10 couleurs");

  // 16. Taille-crayon rond -> Boîte à éponge, catégorie Fournitures
  await maj(
    1202,
    { nom: "Boîte à éponge", categorie_id: CATEGORIE_FOURNITURES },
    "Taille-crayon rond plastique -> Boîte à éponge (Fournitures d'école)",
  );

  // 17. Modem routeur 4G LTE (25000F) -> remplace l'image
  {
    const url = await televerser("modem-routeur-4g-lte.webp");
    await maj(1129, { photo: url, photos: [url] }, "Modem routeur Wi-Fi 4G LTE (image)");
  }

  // 18. Bloc-notes pupitre 160 pages
  await maj(1584, { prix: 5000 }, "Bloc-notes Pupitre 160 pages A4 90g 5x5 spirale");

  // 19. Cahier de dessin (1050F) -> #1297 (nom exact + prix exact). #1286
  // ("... TPG", même prix) est un article distinct, non touché.
  await maj(1297, { prix: 550 }, "Cahier de dessin (1050F)");
  ajouterEntree({
    section: "1",
    cible: "Cahier de dessin (1050 F)",
    action: "désambiguïsation",
    statut: "cas_douteux",
    detail: "2 correspondances au même prix (1050F) : #1297 'Cahier de dessin' (nom exact, choisi) et #1286 'Cahier de dessin TPG' (non touché).",
  });

  // 20. Cahier Prestige B5 500 pages
  await maj(1692, { prix: 4000 }, "Cahier Prestige B5 500 pages");

  // 21. Cahiers "Socamel" (orthographe réelle en base : "Sokamel") sans image -> supprimer.
  ajouterEntree({
    section: "1",
    cible: "Cahiers Socamel sans image",
    action: "correction orthographe",
    statut: "cas_douteux",
    detail: "Aucun produit 'Socamel' en base ; trouvé sous 'Sokamel' (#1246, #1247), tous deux sans image -> supprimés.",
  });
  await supprimer(1246, "Cahier Sokamel vert (sans image)");
  await supprimer(1247, "Cahier Sokamel jaune décor (sans image)");

  // 22. Protège-cahiers couleurs (lot) -> vendu à l'unité
  await maj(1277, { nom: "Protège-cahiers couleurs", prix: 150 }, "Protège-cahiers couleurs (lot) -> Protège-cahiers couleurs");

  // 23. "De Tilène au Plateau" : 2 produits distincts (#1317 LIT-017 3500F,
  // #1417 NIO-2896 3900F) portant le même titre normalisé -> ambigu, on ne
  // devine pas lequel recevoir la nouvelle image.
  ajouterEntree({
    section: "1",
    cible: "De Tilène au Plateau",
    action: "remplacement image",
    statut: "ambigu",
    detail: "2 produits distincts portent ce titre : #1317 (LIT-017, 3500F) et #1417 (NIO-2896, 3900F). Image non appliquée, à trancher manuellement.",
  });

  // 24. Découverte du monde CI (Didactikos) -> ajoute l'image (galerie)
  {
    const url = await televerser("decouverte-du-monde-ci.webp");
    const { data: p } = await supabase.from("produits").select("photo, photos").eq("id", 1488).single();
    const photos = [...(p?.photos ?? [])];
    if (!photos.includes(url)) photos.push(url);
    await maj(1488, { photo: p?.photo ?? url, photos }, "Découverte du monde C.I. (ajout image)");
  }

  console.log("\nSection 1 terminée.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
