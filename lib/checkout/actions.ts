"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { optionsPaiementPourTotal, paiementAutorise, type OptionsPaiement } from "@/lib/checkout/montants";
import { creerSessionWave, waveDisponible, waveEnModeSimulation } from "@/lib/wave/client";
import { jetonClient, verifierJetonClient } from "@/lib/client-auth";
import { journaliserCommande } from "@/lib/mesure";
import { journaliserCommandeValidee } from "@/lib/trafic/mesure";
import { fusionnerSessionCourante } from "@/lib/affinites";
import {
  getDatesFermees,
  getHeureLimiteSamedi,
  getNomMarchandWave,
  getPaiementLivraisonMax,
  getSeuilLivraisonGratuite,
} from "@/lib/parametres";
import { calculerDateLivraison } from "@/lib/checkout/date-livraison";
import { coordonneesValides } from "@/lib/checkout/localisation";
import { trouverLieuSpecialParPoint } from "@/lib/checkout/lieu-special";
import { distanceKm, pointDansPolygone } from "@/lib/geo";
import { declencherPreparationsAuto } from "@/lib/preparation-auto";
import { getConfigPromoExpress } from "@/lib/promo-express";
import { estJourPromoActif } from "@/lib/promo-express-regles";
import { notifierPushStatutCommande } from "@/lib/messages/notifier";
import { notifierPushAdminNouvelleCommande } from "@/lib/admin/notifier-commande";
import { origineSite } from "@/lib/site-url";
import type { GroupePanier, LignePanier } from "@/lib/local/panier";
import { champsGroupePourRpc } from "@/lib/commande/groupe-rpc";
import type { Commande, ModeLivraison, Produit, ProduitVariante, Zone } from "@/lib/supabase/types";

// Formats larges exprès (numéros sénégalais et internationaux varient), mais
// bornés : sert à rejeter du bruit random, pas à valider un vrai numéro.
const TELEPHONE_REGEX = /^[0-9+\s.-]{6,20}$/;
const NOM_MAX = 100;
const PRECISION_LIVREUR_MAX = 300;
const LIGNES_MAX = 50;
const QUANTITE_MAX = 999;
// Même borne que le champ de la fiche produit (migration 0111).
const PERSONNALISATION_MAX = 30;

export type CheckoutInput = {
  nom: string;
  telephone: string;
  // Lieu spécial choisi explicitement (retrait, ville hors zone habituelle à
  // confirmer…) : reste le seul choix manuel de destination. Si absent, la
  // localité est déterminée côté serveur à partir du point de livraison
  // (lat/lng ci-dessous) — jamais envoyée par le client (PROMPT_CLIENT_
  // LOCALISATION.md Lot 2).
  lieuSpecialId: number | null;
  // Point de livraison : coordonnées GPS si le client a autorisé la position,
  // celles extraites du lien Google Maps collé, ou celles du point déplacé/
  // cliqué à la main sur la carte. Détermine la localité ET les frais côté
  // serveur (resoudreLocaliteDepuisPoint ci-dessous) — jamais fait confiance
  // sur une valeur de localité/frais envoyée par le client.
  lat: number | null;
  lng: number | null;
  // Obligatoire : lien Google Maps, collé par le client ou reconstruit depuis
  // sa position GPS/le point déplacé — remplace le champ libre "Comment
  // trouver ta porte". Ouvert en un toucher par l'admin/le livreur.
  lienLocalisation: string | null;
  // Comment le point a été obtenu — purement descriptif (fiche commande
  // admin), jamais utilisé pour une décision métier.
  source: "position" | "lien" | "deplace" | null;
  // Champ libre historique : plus proposé au checkout depuis PROMPT_CLIENT_V2
  // Lot 2, gardé en lecture pour les anciennes commandes uniquement.
  precisionLivreur?: string | null;
  modeLivraison: ModeLivraison;
  // Case à cocher obligatoire côté checkout pour un paiement à la livraison
  // (PROMPT_CLIENT_V2 Lot 1) : « J'ai compris, je serai joignable au
  // <numéro> ». Ignoré pour un paiement Wave. Vérifié côté serveur dans
  // passerCommande (jamais fait confiance côté client).
  consentementAppel?: boolean;
  // Généré une fois côté client (crypto.randomUUID()) au chargement du
  // checkout : permet à creer_commande() de rejouer un clic double ou une
  // requête retentée sans créer deux commandes (voir 0004_performance.sql).
  reference: string;
  // Classe(s) de kit ajoutée(s) au panier (MODULE_EBOOKS.md, lot 4) : rangées
  // sur la commande pour proposer l'ebook offert de la classe dans « Mes
  // commandes ». Aucune donnée personnelle.
  ebookClasses?: { cycle: string; niveau: string }[];
  // Produits d'un kit rattachés à un bénéficiaire (TACHE_identite §2.3) : sert
  // uniquement à attribuer le signal « commande » au bon enfant. Validé côté
  // serveur (le bénéficiaire doit appartenir au compte). Jamais rangé sur la
  // commande elle-même.
  attributions?: { produitId: number; beneficiaireId: number }[];
};

const EBOOK_CLASSES_MAX = 12;
const ATTRIBUTIONS_MAX = 60;

// Associe chaque produit commandé au bénéficiaire déclaré au sélecteur de kit
// (si présent). Le bénéficiaire est revérifié dans journaliserCommande.
function lignesPourJournal(
  lignesResolues: { produitId: number }[],
  attributions: CheckoutInput["attributions"],
): { produitId: number; beneficiaireId?: number | null }[] {
  const parProduit = new Map<number, number>();
  for (const a of (attributions ?? []).slice(0, ATTRIBUTIONS_MAX)) {
    if (Number.isFinite(a?.produitId) && Number.isFinite(a?.beneficiaireId) && a.beneficiaireId > 0) {
      parProduit.set(a.produitId, a.beneficiaireId);
    }
  }
  return lignesResolues.map((l) => ({
    produitId: l.produitId,
    beneficiaireId: parProduit.get(l.produitId) ?? null,
  }));
}

// Nettoie et borne la liste de classes de kit avant de la ranger sur la
// commande. Renvoie null si rien d'exploitable (colonne laissée à NULL).
function normaliserEbookClasses(
  entrees: { cycle: string; niveau: string }[] | undefined,
): { cycle: string; niveau: string }[] | null {
  if (!entrees?.length) return null;
  const vues = new Set<string>();
  const sortie: { cycle: string; niveau: string }[] = [];
  for (const e of entrees.slice(0, EBOOK_CLASSES_MAX)) {
    const cycle = String(e?.cycle ?? "").trim().slice(0, 20);
    const niveau = String(e?.niveau ?? "").trim().slice(0, 40);
    if (!cycle || !niveau) continue;
    const cle = `${cycle}|${niveau}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    sortie.push({ cycle, niveau });
  }
  return sortie.length ? sortie : null;
}

// Annotation non critique posée après coup pour ne pas toucher à la fonction
// atomique creer_commande. Idempotent si la requête est rejouée.
async function annoterEbookClasses(
  commandeId: number,
  entrees: { cycle: string; niveau: string }[] | undefined,
) {
  const classes = normaliserEbookClasses(entrees);
  if (classes) {
    await supabaseAdmin.from("commandes").update({ ebook_classes: classes }).eq("id", commandeId);
  }
}

// `jeton` : à ranger sur l'appareil (voir lib/client-auth.ts), il conditionne
// la relecture de l'historique / des messages / de la position du client.
// `nomEnregistre` : présent uniquement si ce numéro est déjà associé à un nom
// différent de celui saisi — la commande est enregistrée sous ce nom-là
// (GROUPE_B §1), à afficher au client sans bloquer la commande.
export type CheckoutResult =
  | { ok: true; commandeId: number; jeton: string; nomEnregistre: string | null }
  | { ok: false; error: string };

type LigneResolue = {
  produitId: number;
  varianteId: number | null;
  quantite: number;
  prixUnitaire: number;
  // Coût d'achat du produit à l'instant de la vente (figé ensuite sur la ligne
  // pour le calcul du bénéfice, migration 0055). null si non renseigné.
  prixAchat: number | null;
  nom: string;
  // Kit scolaire d'où vient la ligne (CORRECTIONS_V15 Lot 2), pour regrouper
  // l'affichage de la commande (admin, WhatsApp) sans exploser en produits un
  // par un. null pour un produit ajouté hors kit.
  groupe: GroupePanier | null;
  // Personnalisation payante (migration 0111) : null si la ligne n'en porte pas.
  personnalisationNom: string | null;
  personnalisationSpecialite: string | null;
};

type CommandeResolue = {
  zoneId: number | null;
  localiteId: number | null;
  lieuSpecialId: number | null;
  localiteNom: string;
  aConfirmer: boolean;
  // Message de la destination qui remplace le délai « 24h / 6j » (0054).
  messageLivraison: string | null;
  // Distance (km) entre le point de livraison et le point de référence de la
  // localité retenue. NULL si lieu spécial ou hors couverture.
  distanceLocaliteKm: number | null;
  dateLivraisonFixe: string | null;
  lignesResolues: LigneResolue[];
  sousTotal: number;
  fraisLivraison: number;
  // Les deux tarifs (pas seulement celui du mode choisi) pour que le checkout
  // affiche les deux options de vitesse sans un aller-retour par mode.
  fraisLivraison24h: number;
  // Tarif express avant une éventuelle promo (Lot 4a), pour le prix barré côté client.
  fraisLivraison24hNormal: number;
  fraisLivraison6j: number;
  total: number;
  // Promo express (Lot 4a) : jour promo + avant l'heure limite -> l'express
  // est au prix du 6j. `promoExpress` = la promo s'applique au mode choisi
  // (toujours false si gratuite, ou si le mode choisi n'est pas "24h").
  promoExpress: boolean;
  promoExpressHeureLimite: string | null;
};

type ResolutionLivraison = {
  zoneId: number | null;
  localiteId: number | null;
  lieuSpecialId: number | null;
  localiteNom: string;
  fraisLivraison: number;
  fraisLivraison24h: number;
  fraisLivraison24hNormal: number;
  fraisLivraison6j: number;
  aConfirmer: boolean;
  messageLivraison: string | null;
  distanceLocaliteKm: number | null;
  // Date de livraison figée du lieu spécial retenu (EPT…), null sinon.
  dateLivraisonFixe: string | null;
  // true si le tarif express a été aligné sur le tarif 6j par la promo (Lot 4a).
  promoExpress: boolean;
  promoExpressHeureLimite: string | null;
};

type LocaliteGeo = {
  id: number;
  nom: string;
  groupe_id: number;
  lat: number;
  lng: number;
  rayon_km: number;
  zone_polygone: [number, number][] | null;
};

// Localité = celle dont la zone dessinée contient le point (prioritaire), sinon
// la plus proche du point de référence parmi celles dont le point tombe dans
// son rayon de couverture (PROMPT_CLIENT_LOCALISATION.md Lot 2, localités
// géolocalisées par PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 2). null = hors
// couverture (aucune localité assez proche, aucune zone ne contient le point).
async function resoudreLocaliteDepuisPoint(
  lat: number,
  lng: number,
): Promise<{ localite: LocaliteGeo; distanceKm: number } | null> {
  const { data } = await supabaseAdmin
    .from("localites")
    .select("id, nom, groupe_id, lat, lng, rayon_km, zone_polygone")
    .not("lat", "is", null)
    .not("lng", "is", null);
  const localites = (data ?? []) as LocaliteGeo[];
  if (localites.length === 0) return null;

  for (const l of localites) {
    if (l.zone_polygone && l.zone_polygone.length >= 3 && pointDansPolygone(lat, lng, l.zone_polygone)) {
      return { localite: l, distanceKm: distanceKm(lat, lng, l.lat, l.lng) };
    }
  }

  let meilleure: LocaliteGeo | null = null;
  let meilleureDistance = Infinity;
  for (const l of localites) {
    const d = distanceKm(lat, lng, l.lat, l.lng);
    if (d <= l.rayon_km && d < meilleureDistance) {
      meilleure = l;
      meilleureDistance = d;
    }
  }
  return meilleure ? { localite: meilleure, distanceKm: meilleureDistance } : null;
}

// Tarif recalculé EN BASE à partir du point de livraison (jamais du libellé ou
// du montant que le client pourrait forger) — IMPLEMENTATION_TARIFS_LIVRAISON.md
// §6 et PROMPT_CLIENT_LOCALISATION.md Lot 2.
// Résolution directe sur une ligne `lieux_speciaux` (choix explicite du
// LieuSpecialPicker, ou lieu retrouvé automatiquement par point/mots-clés).
function resolutionDepuisLieuSpecial(lieu: {
  id: number;
  nom: string;
  tarif: number | null;
  mode: string;
  message: string | null;
  date_livraison_fixe: string | null;
}): ResolutionLivraison {
  // Même tarif quelle que soit la vitesse choisie (§4 du doc de spec).
  const tarif = lieu.mode === "a_confirmer" ? 0 : (lieu.tarif ?? 0);
  return {
    zoneId: null,
    localiteId: null,
    lieuSpecialId: lieu.id,
    localiteNom: lieu.nom,
    fraisLivraison: tarif,
    fraisLivraison24h: tarif,
    fraisLivraison24hNormal: tarif,
    fraisLivraison6j: tarif,
    aConfirmer: lieu.mode === "a_confirmer",
    messageLivraison: lieu.message ?? null,
    distanceLocaliteKm: null,
    dateLivraisonFixe: lieu.date_livraison_fixe ?? null,
    // Lieux spéciaux : même tarif quel que soit le mode, la promo express n'a
    // rien à y faire (Lot 4a).
    promoExpress: false,
    promoExpressHeureLimite: null,
  };
}

async function resoudreLivraison(params: {
  modeLivraison: ModeLivraison;
  lieuSpecialId: number | null;
  lat: number | null;
  lng: number | null;
}): Promise<{ ok: true; data: ResolutionLivraison } | { ok: false; error: string }> {
  if (params.lieuSpecialId != null) {
    const { data: lieu, error } = await supabaseAdmin
      .from("lieux_speciaux")
      .select("*")
      .eq("id", params.lieuSpecialId)
      .maybeSingle();
    if (error) return { ok: false, error: "Une erreur est survenue, réessaie." };
    if (!lieu) return { ok: false, error: "Ce lieu n'est plus disponible, choisis-en un autre." };
    return { ok: true, data: resolutionDepuisLieuSpecial(lieu) };
  }

  if (params.lat == null || params.lng == null || !coordonneesValides(params.lat, params.lng)) {
    return { ok: false, error: "Indique ta position de livraison (position actuelle ou lien Google Maps)." };
  }

  // Un point qui tombe dans le rayon de couverture d'un lieu spécial
  // géolocalisé (ex: EPT) prime sur la déduction par localité — c'est le cas
  // typique d'une recherche d'adresse ("École Polytechnique de Thiès") qui
  // place l'épingle au bon endroit sans que le client ait choisi le lieu
  // spécial à la main (TACHE_bug_checkout_ept.md).
  const { data: lieuxSpeciaux } = await supabaseAdmin.from("lieux_speciaux").select("*");
  const lieuParPoint = trouverLieuSpecialParPoint(
    params.lat,
    params.lng,
    (lieuxSpeciaux ?? []).map((l) => ({ id: l.id, motsCles: [], lat: l.lat, lng: l.lng, rayonM: l.rayon_m })),
  );
  if (lieuParPoint) {
    const lieu = (lieuxSpeciaux ?? []).find((l) => l.id === lieuParPoint.id)!;
    return { ok: true, data: resolutionDepuisLieuSpecial(lieu) };
  }

  const trouvee = await resoudreLocaliteDepuisPoint(params.lat, params.lng);
  if (!trouvee) {
    // Hors couverture : on ne bloque pas la commande, l'admin confirme le
    // tarif ensuite par téléphone (PROMPT_CLIENT_LOCALISATION.md Lot 2).
    return {
      ok: true,
      data: {
        zoneId: null,
        localiteId: null,
        lieuSpecialId: null,
        localiteNom: "Livraison hors zone habituelle",
        fraisLivraison: 0,
        fraisLivraison24h: 0,
        fraisLivraison24hNormal: 0,
        fraisLivraison6j: 0,
        aConfirmer: true,
        messageLivraison: null,
        distanceLocaliteKm: null,
        dateLivraisonFixe: null,
        promoExpress: false,
        promoExpressHeureLimite: null,
      },
    };
  }

  const { data: groupe, error: errGroupe } = await supabaseAdmin
    .from("zones")
    .select("*")
    .eq("id", trouvee.localite.groupe_id)
    .maybeSingle<Zone>();
  if (errGroupe || !groupe) return { ok: false, error: "Une erreur est survenue, réessaie." };

  // Promo express (Lot 4a) : un jour promo, avant l'heure limite, l'express
  // coûte le même prix que la livraison à date donnée pour cette localité.
  const configPromo = await getConfigPromoExpress();
  const promoActive = estJourPromoActif(configPromo);
  const fraisLivraison24h = promoActive ? groupe.tarif_6j : groupe.tarif_24h;

  return {
    ok: true,
    data: {
      zoneId: groupe.id,
      localiteId: trouvee.localite.id,
      lieuSpecialId: null,
      localiteNom: trouvee.localite.nom,
      fraisLivraison: params.modeLivraison === "24h" ? fraisLivraison24h : groupe.tarif_6j,
      fraisLivraison24h,
      fraisLivraison24hNormal: groupe.tarif_24h,
      fraisLivraison6j: groupe.tarif_6j,
      aConfirmer: false,
      messageLivraison: groupe.message_special ?? null,
      distanceLocaliteKm: trouvee.distanceKm,
      dateLivraisonFixe: null,
      promoExpress: promoActive && params.modeLivraison === "24h",
      promoExpressHeureLimite: promoActive ? configPromo.heureLimite : null,
    },
  };
}

// Prix et frais recalculés EN BASE (jamais depuis le client) à partir du
// panier et de la localité. Partagé par passerCommande() (création) et
// getOptionsPaiement() (règle du seuil de paiement) pour qu'un seul et même
// total serve à décider et à facturer. Le stock n'est plus un critère de
// disponibilité (le fournisseur source à la demande) : aucun contrôle ici.
async function resoudreCommande(
  lignes: LignePanier[],
  params: {
    modeLivraison: ModeLivraison;
    lieuSpecialId: number | null;
    lat: number | null;
    lng: number | null;
  },
): Promise<{ ok: true; data: CommandeResolue } | { ok: false; error: string }> {
  const produitIds = [...new Set(lignes.map((l) => l.produitId))];
  const varianteIds = [...new Set(lignes.map((l) => l.varianteId).filter((v): v is number => v !== null))];

  const [produitsRes, variantesRes, livraison, seuil] = await Promise.all([
    supabaseAdmin.from("produits").select("*").in("id", produitIds),
    varianteIds.length > 0
      ? supabaseAdmin.from("produit_variantes").select("*").in("id", varianteIds)
      : Promise.resolve({ data: [] as ProduitVariante[], error: null }),
    resoudreLivraison(params),
    getSeuilLivraisonGratuite(),
  ]);

  if (produitsRes.error || variantesRes.error) {
    return { ok: false, error: "Une erreur est survenue, réessaie." };
  }
  if (!livraison.ok) return livraison;

  const produitsById = new Map<number, Produit>((produitsRes.data ?? []).map((p) => [p.id, p]));
  const variantesById = new Map<number, ProduitVariante>((variantesRes.data ?? []).map((v) => [v.id, v]));

  const lignesResolues: LigneResolue[] = [];
  for (const ligne of lignes) {
    const produit = produitsById.get(ligne.produitId);
    if (!produit) return { ok: false, error: "Un produit du panier n'existe plus." };

    // Visibilité catalogue (AUDIT_SECURITE_3 G2) : resoudreCommande lit en
    // service_role, hors RLS. Un produit vendeur pas encore publié (en
    // négociation, refusé) ne doit pas être commandable, même par appel direct.
    // On refait donc ici le filtre de la policy catalogue.
    if (produit.vendeur_id !== null && produit.statut_publication !== "publie") {
      return { ok: false, error: "Un produit du panier n'est plus disponible à la vente." };
    }

    const variante = ligne.varianteId ? variantesById.get(ligne.varianteId) : null;
    if (ligne.varianteId && !variante) {
      return { ok: false, error: "Une option choisie n'existe plus." };
    }
    // Intégrité prix (AUDIT_SECURITE_2 D4) : la variante doit bien appartenir au
    // produit de la ligne — sinon on pourrait envoyer varianteId d'un produit
    // pas cher pour un produit cher et payer le mauvais prix.
    if (variante && variante.produit_id !== produit.id) {
      return { ok: false, error: "Cette option ne correspond pas à ce produit." };
    }

    // Personnalisation payante (migration 0111) : jamais fait confiance côté
    // client — ignorée si le produit n'est pas `personnalisable`, bornée à
    // PERSONNALISATION_MAX caractères sinon (même limite que la fiche produit).
    const personnalise = produit.personnalisable && ligne.personnalisation;
    const nomPerso = personnalise ? ligne.personnalisation!.nom.trim().slice(0, PERSONNALISATION_MAX) : null;
    const specialitePerso = personnalise
      ? ligne.personnalisation!.specialite.trim().slice(0, PERSONNALISATION_MAX)
      : null;
    const surchargePersoVente = personnalise && nomPerso && specialitePerso ? (produit.prix_personnalisation ?? 0) : 0;
    const surchargePersoAchat = personnalise && nomPerso && specialitePerso ? (produit.achat_personnalisation ?? 0) : 0;

    lignesResolues.push({
      produitId: produit.id,
      varianteId: variante?.id ?? null,
      quantite: ligne.quantite,
      prixUnitaire: (variante?.prix ?? produit.prix) + surchargePersoVente,
      prixAchat: produit.prix_achat != null ? produit.prix_achat + surchargePersoAchat : null,
      nom: produit.nom,
      groupe: ligne.groupe ?? null,
      personnalisationNom: nomPerso && specialitePerso ? nomPerso : null,
      personnalisationSpecialite: nomPerso && specialitePerso ? specialitePerso : null,
    });
  }

  const sousTotal = lignesResolues.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0);
  // Livraison gratuite au-dessus du seuil : prime sur tout le reste, y compris
  // un tarif "à confirmer" (rien à confirmer si c'est de toute façon gratuit).
  // seuil === null : désactivée (CORRECTIONS_V11 lot 1), jamais gratuite.
  const gratuite = seuil !== null && sousTotal >= seuil;
  const fraisLivraison = gratuite ? 0 : livraison.data.fraisLivraison;
  const aConfirmer = gratuite ? false : livraison.data.aConfirmer;

  return {
    ok: true,
    data: {
      zoneId: livraison.data.zoneId,
      localiteId: livraison.data.localiteId,
      lieuSpecialId: livraison.data.lieuSpecialId,
      localiteNom: livraison.data.localiteNom,
      aConfirmer,
      messageLivraison: livraison.data.messageLivraison,
      distanceLocaliteKm: livraison.data.distanceLocaliteKm,
      dateLivraisonFixe: livraison.data.dateLivraisonFixe,
      lignesResolues,
      sousTotal,
      fraisLivraison,
      fraisLivraison24h: gratuite ? 0 : livraison.data.fraisLivraison24h,
      fraisLivraison24hNormal: gratuite ? 0 : livraison.data.fraisLivraison24hNormal,
      fraisLivraison6j: gratuite ? 0 : livraison.data.fraisLivraison6j,
      promoExpress: gratuite ? false : livraison.data.promoExpress,
      promoExpressHeureLimite: gratuite ? null : livraison.data.promoExpressHeureLimite,
      total: sousTotal + fraisLivraison,
    },
  };
}

// `creer_commande()` (RPC) ne connaît pas le message de livraison : on le fige
// juste après, sur la ligne créée. Idempotent (même valeur sur une reprise).
async function figerMessageLivraison(commandeId: number, message: string | null): Promise<void> {
  if (!message) return;
  await supabaseAdmin.from("commandes").update({ message_livraison: message }).eq("id", commandeId);
}

// `creer_commande()` (RPC) ne connaît pas le lien Google Maps (PROMPT_CLIENT_V2
// Lot 2, migration 0106) : on le fige juste après, comme le message de
// livraison ci-dessus. Idempotent.
async function figerLienLocalisation(commandeId: number, lien: string | null): Promise<void> {
  if (!lien) return;
  await supabaseAdmin.from("commandes").update({ lien_localisation: lien }).eq("id", commandeId);
}

// `creer_commande()` (RPC) ne connaît pas la source du point ni sa distance à
// la localité retenue (migration 0115) : traçabilité posée juste après,
// comme ci-dessus. Idempotent.
async function figerSourceEtDistance(
  commandeId: number,
  source: CheckoutInput["source"],
  distanceLocaliteKm: number | null,
): Promise<void> {
  if (!source && distanceLocaliteKm == null) return;
  await supabaseAdmin
    .from("commandes")
    .update({ source_localisation: source, distance_localite_km: distanceLocaliteKm })
    .eq("id", commandeId);
}

// Prix d'achat figé sur chaque ligne de commande (migration 0055) : base de la
// part fournisseur du bénéfice, jamais recalculée ensuite. Idempotent (ne touche
// que les lignes pas encore renseignées).
async function figerPrixAchat(commandeId: number, lignes: LigneResolue[]): Promise<void> {
  const parProduit = new Map<number, number>();
  for (const l of lignes) {
    if (l.prixAchat != null && l.prixAchat > 0) parProduit.set(l.produitId, l.prixAchat);
  }
  for (const [produitId, prixAchat] of parProduit) {
    await supabaseAdmin
      .from("commande_items")
      .update({ prix_achat_unitaire: prixAchat })
      .eq("commande_id", commandeId)
      .eq("produit_id", produitId)
      .is("prix_achat_unitaire", null);
  }
}

// `creer_commande()` (RPC) ne connaît pas la promo express (Lot 4a) : figée
// juste après, comme le message de livraison ci-dessus. Idempotent (ne touche
// jamais `frais_livraison`, déjà correct depuis sa création).
async function figerPromoExpress(commandeId: number, promoExpress: boolean): Promise<void> {
  if (!promoExpress) return;
  await supabaseAdmin.from("commandes").update({ promo_express: true }).eq("id", commandeId);
}

function panierValide(lignes: LignePanier[]): boolean {
  return (
    lignes.length > 0 &&
    lignes.length <= LIGNES_MAX &&
    lignes.every((l) => l.quantite >= 1 && l.quantite <= QUANTITE_MAX)
  );
}

export type OptionsPaiementResult =
  | ({ ok: true } & OptionsPaiement & {
        fraisLivraison: number;
        fraisLivraison24h: number;
        fraisLivraison24hNormal: number;
        fraisLivraison6j: number;
        localiteNom: string;
        aConfirmer: boolean;
        messageLivraison: string | null;
        // Date de livraison "à date donnée" (maj-accueil §7), affichée à la
        // place de « 6 jours » — "YYYY-MM-DD".
        dateLivraisonPrevue: string;
        // Date figée du lieu spécial retenu (EPT…), affichée dans la carte
        // "Livraison" à la place du choix de mode. null sinon.
        dateLivraisonFixe: string | null;
        // Nom marchand réellement affiché par Wave à l'écran de paiement
        // (lib/parametres.ts::getNomMarchandWave) — null si Wave n'est pas une
        // option pour ce total, pour ne jamais afficher une mention Wave hors
        // propos.
        waveNomMarchand: string | null;
        promoExpress: boolean;
        promoExpressHeureLimite: string | null;
      })
  | { ok: false; error: string };

// Calcule la date de livraison "à date donnée" (maj-accueil §7) à partir de
// l'heure limite du samedi et des dates fermées réglées dans l'admin.
async function dateLivraisonPrevue(): Promise<string> {
  const [heureLimiteSamedi, datesFermees] = await Promise.all([getHeureLimiteSamedi(), getDatesFermees()]);
  return calculerDateLivraison(new Date(), heureLimiteSamedi, datesFermees);
}

// Fige la date sur la commande juste après sa création (creer_commande() ne
// la connaît pas) : la date fixe d'un lieu spécial (EPT…) prime toujours,
// sinon seulement pour le mode "à date donnée". Idempotent.
async function figerDateLivraison(
  commandeId: number,
  modeLivraison: ModeLivraison,
  dateLivraisonFixe: string | null,
): Promise<void> {
  const date = dateLivraisonFixe ?? (modeLivraison === "6j" ? await dateLivraisonPrevue() : null);
  if (!date) return;
  await supabaseAdmin.from("commandes").update({ date_livraison_prevue: date }).eq("id", commandeId);
}

// Règle du seuil de paiement (INTEGRATION_WAVE.md, lot W2) : le checkout appelle
// cette action pour savoir quels modes de paiement proposer ET le tarif de
// livraison à afficher (recalculé ici, jamais fourni par le client).
export async function getOptionsPaiement(
  lignes: LignePanier[],
  params: {
    modeLivraison: ModeLivraison;
    lieuSpecialId: number | null;
    lat: number | null;
    lng: number | null;
  },
): Promise<OptionsPaiementResult> {
  if (!panierValide(lignes)) return { ok: false, error: "Panier invalide." };

  const [resolu, paiementLivraisonMax] = await Promise.all([
    resoudreCommande(lignes, params),
    getPaiementLivraisonMax(),
  ]);
  if (!resolu.ok) return { ok: false, error: resolu.error };

  const options = optionsPaiementPourTotal(resolu.data.total, waveDisponible(), paiementLivraisonMax);

  return {
    ok: true,
    ...options,
    fraisLivraison: resolu.data.fraisLivraison,
    fraisLivraison24h: resolu.data.fraisLivraison24h,
    fraisLivraison24hNormal: resolu.data.fraisLivraison24hNormal,
    fraisLivraison6j: resolu.data.fraisLivraison6j,
    localiteNom: resolu.data.localiteNom,
    aConfirmer: resolu.data.aConfirmer,
    messageLivraison: resolu.data.messageLivraison,
    dateLivraisonPrevue: resolu.data.dateLivraisonFixe ?? (await dateLivraisonPrevue()),
    dateLivraisonFixe: resolu.data.dateLivraisonFixe,
    waveNomMarchand: options.options.includes("wave") ? await getNomMarchandWave() : null,
    promoExpress: resolu.data.promoExpress,
    promoExpressHeureLimite: resolu.data.promoExpressHeureLimite,
  };
}

const LIEN_LOCALISATION_MAX = 500;

// Validation commune du formulaire de checkout (livraison comme Wave).
function validerCheckout(input: CheckoutInput, lignes: LignePanier[]): string | null {
  const nom = input.nom.trim();
  const telephone = input.telephone.trim();
  const precisionLivreur = (input.precisionLivreur ?? "").trim();
  const lienLocalisation = (input.lienLocalisation ?? "").trim();

  if (lignes.length === 0) return "Ton panier est vide.";
  if (!nom || !telephone) return "Merci de renseigner ton nom et ton téléphone.";
  // Obligatoire (PROMPT_CLIENT_LOCALISATION.md Lot 1) : le point de livraison
  // détermine la localité et les frais côté serveur — jamais fait confiance
  // côté client seul, revérifié ici avant la commande.
  if (input.lat == null || input.lng == null) {
    return "Indique ta position de livraison (position actuelle ou lien Google Maps).";
  }
  if (!coordonneesValides(input.lat, input.lng)) return "Position invalide.";
  if (!lienLocalisation) return "Indique ta position de livraison (position actuelle ou lien Google Maps).";
  if (lienLocalisation.length > LIEN_LOCALISATION_MAX) return "Lien de localisation trop long.";
  if (nom.length > NOM_MAX || precisionLivreur.length > PRECISION_LIVREUR_MAX) {
    return "Un des champs est trop long.";
  }
  if (!TELEPHONE_REGEX.test(telephone)) return "Numéro de téléphone invalide.";
  if (!panierValide(lignes)) return "Panier invalide.";
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(input.reference)) return "Requête invalide.";
  return null;
}

// Client retrouvé par téléphone (identifiant unique), sinon créé ; la zone
// connue et la dernière position sont mises à jour à chaque commande. Le conflit
// sur la contrainte unique (deux commandes du même nouveau client à la même
// seconde) est géré en relisant le client au lieu d'échouer.
//
// Un numéro = un seul compte (GROUPE_B §1) : si le nom saisi diffère du nom
// enregistré, on NE l'écrase PAS silencieusement (ça reviendrait à renommer le
// compte d'un simple coup de faute de frappe ou d'un tiers qui commande pour
// quelqu'un d'autre). Le nom enregistré reste la source de vérité pour la
// commande ; `nomEnregistre` remonte l'appelant pour qu'il informe le client
// (non bloquant). Le changement de nom volontaire se fait dans Paramètres
// (voir modifierNomClient, lib/moi/actions.ts).
async function trouverOuCreerClient(params: {
  nom: string;
  telephone: string;
  zoneId: number | null;
  lat: number | null;
  lng: number | null;
  precisionLivreur: string | null;
}): Promise<
  | { ok: true; clientId: number; nomEnregistre: string | null }
  | { ok: false; error: string }
> {
  // La page de commande ne capture plus de coordonnées (carte retirée) : on
  // n'écrase la dernière position connue que si on en reçoit réellement une
  // (elle peut venir d'une ancienne commande ou avoir été posée côté admin).
  const position: Record<string, unknown> = {
    derniere_precision_livreur: params.precisionLivreur,
  };
  if (params.lat != null && params.lng != null) {
    position.derniere_lat = params.lat;
    position.derniere_lng = params.lng;
  }

  const { data: clientExistant, error: clientReadError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("telephone", params.telephone)
    .maybeSingle();
  if (clientReadError) return { ok: false, error: "Une erreur est survenue, réessaie." };

  if (clientExistant) {
    await supabaseAdmin.from("clients").update({ zone_id: params.zoneId, ...position }).eq("id", clientExistant.id);
    const memeNom = clientExistant.nom.trim().toLowerCase() === params.nom.trim().toLowerCase();
    return { ok: true, clientId: clientExistant.id, nomEnregistre: memeNom ? null : clientExistant.nom };
  }

  const { data: nouveauClient, error: clientInsertError } = await supabaseAdmin
    .from("clients")
    .insert({ nom: params.nom, telephone: params.telephone, zone_id: params.zoneId, ...position })
    .select()
    .single();

  if (clientInsertError || !nouveauClient) {
    // Course gagnée par une commande concurrente du même nouveau client : le
    // nom qu'elle a créé fait foi, pas celui-ci.
    const { data: retente } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("telephone", params.telephone)
      .maybeSingle();
    if (!retente) return { ok: false, error: "Impossible de créer ton profil client." };
    const memeNom = retente.nom.trim().toLowerCase() === params.nom.trim().toLowerCase();
    return { ok: true, clientId: retente.id, nomEnregistre: memeNom ? null : retente.nom };
  }
  return { ok: true, clientId: nouveauClient.id, nomEnregistre: null };
}

function messageErreurCreerCommande(): string {
  return "Impossible de créer la commande.";
}

function lignesPourRpc(lignesResolues: LigneResolue[]) {
  return lignesResolues.map((l) => ({
    produit_id: l.produitId,
    variante_id: l.varianteId,
    quantite: l.quantite,
    prix_unitaire: l.prixUnitaire,
    // Regroupement kit/liste (CORRECTIONS_V15 Lot 2, migration 0100) :
    // dénormalisé sur chaque ligne pour n'avoir besoin d'aucune jointure côté
    // admin/WhatsApp.
    ...champsGroupePourRpc(l.groupe),
    personnalisation_nom: l.personnalisationNom,
    personnalisation_specialite: l.personnalisationSpecialite,
  }));
}

// Toute la logique métier de MODELE_DONNEES.md (Lot 4) : les prix et le stock
// ne sont JAMAIS pris depuis le client, on relit tout en base ici. C'est aussi
// la seule route autorisée à écrire dans clients/commandes/commande_items
// (RLS n'accorde aucun accès public à ces tables, voir supabase/README.md).
//
// Le stock n'est plus un critère de disponibilité (le fournisseur source à la
// demande, migration 0071) : creer_commande() ne bloque plus dessus.
export async function passerCommande(
  lignes: LignePanier[],
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const erreurValidation = validerCheckout(input, lignes);
  if (erreurValidation) return { ok: false, error: erreurValidation };

  // Case à cocher obligatoire (PROMPT_CLIENT_V2 Lot 1) : jamais fait confiance
  // côté client, revérifiée ici avant de créer la commande.
  if (!input.consentementAppel) {
    return { ok: false, error: "Merci de confirmer que tu seras joignable avant de valider." };
  }

  const precisionLivreur = (input.precisionLivreur ?? "").trim() || null;

  const ip = await getClientIp();
  const autorise = await verifierLimite(`commande:${ip}`, 8, 600);
  if (!autorise) {
    return { ok: false, error: "Trop de commandes envoyées d'un coup. Réessaie dans quelques minutes." };
  }

  const [resolu, paiementLivraisonMax] = await Promise.all([
    resoudreCommande(lignes, {
      modeLivraison: input.modeLivraison,
      lieuSpecialId: input.lieuSpecialId,
      lat: input.lat,
      lng: input.lng,
    }),
    getPaiementLivraisonMax(),
  ]);
  if (!resolu.ok) return { ok: false, error: resolu.error };
  const {
    zoneId,
    localiteId,
    lieuSpecialId,
    localiteNom,
    aConfirmer,
    lignesResolues,
    sousTotal,
    fraisLivraison,
    total,
    dateLivraisonFixe,
  } = resolu.data;

  // Au-dessus du plafond (réglable dans l'admin), le paiement à la livraison
  // n'est plus permis (PROMPT_CLIENT_V2 Lot 1). Contrôle serveur : le client a
  // beau envoyer "livraison", on refuse. Le checkout bascule alors sur
  // demarrerPaiementWave. (Si Wave n'est pas branché, waveDisponible()=false
  // => tout reste "livraison", le plafond ne s'applique pas.)
  if (!paiementAutorise("livraison", total, waveDisponible(), paiementLivraisonMax)) {
    return { ok: false, error: "Pour ce montant, le paiement se fait d'avance par Wave." };
  }

  const client = await trouverOuCreerClient({
    nom: input.nom.trim(),
    telephone: input.telephone.trim(),
    zoneId,
    lat: input.lat,
    lng: input.lng,
    precisionLivreur,
  });
  if (!client.ok) return { ok: false, error: client.error };

  // Connexion effective : rattache la session anonyme au compte (affinités +
  // événements passés). Best-effort, ne bloque pas la commande.
  await fusionnerSessionCourante(client.clientId);

  const { data: commandeId, error: commandeError } = await supabaseAdmin.rpc("creer_commande", {
    p_client_id: client.clientId,
    p_zone_id: zoneId,
    p_adresse: null,
    p_lat: input.lat,
    p_lng: input.lng,
    p_precision_livreur: precisionLivreur,
    p_mode_livraison: input.modeLivraison,
    p_frais_livraison: fraisLivraison,
    p_sous_total: sousTotal,
    p_total: total,
    p_reference: input.reference,
    p_lignes: lignesPourRpc(lignesResolues),
    p_localite_id: localiteId,
    p_lieu_special_id: lieuSpecialId,
    p_localite_nom: localiteNom,
    p_frais_livraison_a_confirmer: aConfirmer,
  });

  if (commandeError) {
    return { ok: false, error: messageErreurCreerCommande() };
  }

  await figerMessageLivraison(commandeId as number, resolu.data.messageLivraison);
  await figerLienLocalisation(commandeId as number, input.lienLocalisation);
  await figerSourceEtDistance(commandeId as number, input.source, resolu.data.distanceLocaliteKm);
  await figerDateLivraison(commandeId as number, input.modeLivraison, dateLivraisonFixe);
  await figerPrixAchat(commandeId as number, lignesResolues);
  await figerPromoExpress(commandeId as number, resolu.data.promoExpress);
  await annoterEbookClasses(commandeId as number, input.ebookClasses);

  // Signal de classement « commande » (poids 5), une ligne par produit.
  await journaliserCommande(lignesPourJournal(lignesResolues, input.attributions), {
    clientId: client.clientId,
  });
  // Étape "commande validée" du parcours d'achat (PROMPT_ADMIN_V2 Lot 3).
  await journaliserCommandeValidee(commandeId as number);

  // Une commande payée à la livraison part maintenant sur 'a_confirmer_appel'
  // (PROMPT_CLIENT_V2 Lot 1, migration 0105) : on ne prévient plus les
  // fournisseurs ni n'envoie le push "commande confirmée" dès la création,
  // seulement après l'appel de confirmation — voir changerStatutCommande()
  // (lib/admin/commandes-actions.ts), qui déclenche les deux à l'entrée en
  // 'recue'. La boîte de réception reçoit déjà le message "On va t'appeler"
  // via le trigger DB.
  await notifierPushStatutCommande(commandeId as number, "a_confirmer_appel");

  // PROMPT_ADMIN Lot 2 : prévenir le fondateur même hors de l'app (badge +
  // notification push), best-effort, ne doit jamais faire échouer la commande.
  await notifierPushAdminNouvelleCommande(commandeId as number, input.nom.trim(), total);

  return {
    ok: true,
    commandeId: commandeId as number,
    jeton: jetonClient(client.clientId),
    nomEnregistre: client.nomEnregistre,
  };
}

// ---------------------------------------------------------------------------
// Paiement Wave (INTEGRATION_WAVE.md, W3)
// ---------------------------------------------------------------------------

export type PaiementWaveResult =
  | { ok: true; waveLaunchUrl: string; commandeId: number; jeton: string; nomEnregistre: string | null }
  | { ok: false; error: string };

async function urlsRetourWave(reference: string) {
  const base = await origineSite();
  const ref = encodeURIComponent(reference);
  return {
    successUrl: `${base}/checkout/confirmation?ref=${ref}`,
    errorUrl: `${base}/checkout/paiement-echoue?ref=${ref}`,
  };
}

// Démarre un paiement Wave : crée la session Wave PUIS la commande (statut
// 'paiement_en_attente'), et renvoie l'URL de paiement vers laquelle rediriger
// le client. La commande ne devient 'payee' que sur webhook signé (W4) — jamais
// au simple retour sur la success_url.
export async function demarrerPaiementWave(
  lignes: LignePanier[],
  input: CheckoutInput,
): Promise<PaiementWaveResult> {
  const erreurValidation = validerCheckout(input, lignes);
  if (erreurValidation) return { ok: false, error: erreurValidation };

  if (!waveDisponible()) {
    return { ok: false, error: "Le paiement en ligne n'est pas disponible pour le moment." };
  }

  const precisionLivreur = (input.precisionLivreur ?? "").trim() || null;

  const ip = await getClientIp();
  const autorise = await verifierLimite(`commande:${ip}`, 8, 600);
  if (!autorise) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const resolu = await resoudreCommande(lignes, {
    modeLivraison: input.modeLivraison,
    lieuSpecialId: input.lieuSpecialId,
    lat: input.lat,
    lng: input.lng,
  });
  if (!resolu.ok) return { ok: false, error: resolu.error };
  const {
    zoneId,
    localiteId,
    lieuSpecialId,
    localiteNom,
    aConfirmer,
    lignesResolues,
    sousTotal,
    fraisLivraison,
    total,
    dateLivraisonFixe,
  } = resolu.data;

  if (!paiementAutorise("wave", total)) {
    return { ok: false, error: "Le paiement Wave n'est pas disponible pour cette commande." };
  }

  // Une commande déjà créée pour cette référence (double clic, retour arrière) :
  // on ne recrée rien, on relance juste une session de paiement dessus.
  const existante = await getCommandeParReference(input.reference);
  if (existante) return relancerSessionPourCommande(existante);

  // Session Wave créée AVANT la commande : si Wave refuse, aucune commande n'est
  // créée (rien à nettoyer). Si la commande échoue ensuite pour une autre raison,
  // la session Wave orpheline expire d'elle-même.
  const { successUrl, errorUrl } = await urlsRetourWave(input.reference);
  const session = await creerSessionWave({
    montant: total,
    reference: input.reference,
    successUrl,
    errorUrl,
  });
  if (!session.ok) return { ok: false, error: session.error };

  const client = await trouverOuCreerClient({
    nom: input.nom.trim(),
    telephone: input.telephone.trim(),
    zoneId,
    lat: input.lat,
    lng: input.lng,
    precisionLivreur,
  });
  if (!client.ok) return { ok: false, error: client.error };

  // Connexion effective : rattache la session anonyme au compte (affinités +
  // événements passés). Best-effort, ne bloque pas la commande.
  await fusionnerSessionCourante(client.clientId);

  const { data: commandeId, error: commandeError } = await supabaseAdmin.rpc("creer_commande", {
    p_client_id: client.clientId,
    p_zone_id: zoneId,
    p_adresse: null,
    p_lat: input.lat,
    p_lng: input.lng,
    p_precision_livreur: precisionLivreur,
    p_mode_livraison: input.modeLivraison,
    p_frais_livraison: fraisLivraison,
    p_sous_total: sousTotal,
    p_total: total,
    p_reference: input.reference,
    p_lignes: lignesPourRpc(lignesResolues),
    p_mode_paiement: "wave",
    p_wave_session_id: session.session.id,
    p_localite_id: localiteId,
    p_lieu_special_id: lieuSpecialId,
    p_localite_nom: localiteNom,
    p_frais_livraison_a_confirmer: aConfirmer,
  });

  if (commandeError) {
    return { ok: false, error: messageErreurCreerCommande() };
  }

  await figerMessageLivraison(commandeId as number, resolu.data.messageLivraison);
  await figerLienLocalisation(commandeId as number, input.lienLocalisation);
  await figerSourceEtDistance(commandeId as number, input.source, resolu.data.distanceLocaliteKm);
  await figerDateLivraison(commandeId as number, input.modeLivraison, dateLivraisonFixe);
  await figerPrixAchat(commandeId as number, lignesResolues);
  await figerPromoExpress(commandeId as number, resolu.data.promoExpress);
  await annoterEbookClasses(commandeId as number, input.ebookClasses);

  // Signal de classement « commande » (poids 5). Enregistré à la création
  // (panier construit + kit choisi + checkout atteint) ; un paiement Wave
  // abandonné reste une exception, lissée par la fenêtre 90 j des affinités.
  await journaliserCommande(lignesPourJournal(lignesResolues, input.attributions), {
    clientId: client.clientId,
  });
  // Étape "commande validée" du parcours d'achat (PROMPT_ADMIN_V2 Lot 3) :
  // comme pour le signal de classement, le paiement Wave n'étant pas encore
  // confirmé n'empêche pas de compter la commande créée dans ce funnel.
  await journaliserCommandeValidee(commandeId as number);

  return {
    ok: true,
    waveLaunchUrl: session.session.waveLaunchUrl,
    commandeId: commandeId as number,
    jeton: jetonClient(client.clientId),
    nomEnregistre: client.nomEnregistre,
  };
}

// Rejoue un paiement Wave sur une commande existante restée 'paiement_en_attente'
// (bouton « Réessayer le paiement » de l'écran d'échec).
export async function reprendrePaiementWave(reference: string): Promise<PaiementWaveResult> {
  const commande = await getCommandeParReference(reference);
  if (!commande) return { ok: false, error: "Commande introuvable." };
  return relancerSessionPourCommande(commande);
}

export type BasculerLivraisonResult =
  | { ok: true; commandeId: number; jeton: string }
  | { ok: false; error: string };

// Bascule une commande Wave restée sans paiement (abandonnée ou échouée) vers
// le paiement à la livraison (PROMPT_CLIENT_V2 Lot 1, bouton « Payer à la
// livraison à la place » de l'écran d'échec / de « Mes commandes »). Le stock
// a déjà été réservé à la création : rien à toucher de ce côté, seulement le
// mode de paiement et le statut (-> 'a_confirmer_appel', comme une commande
// livraison créée directement dans cet état).
export async function basculerPaiementLivraison(
  reference: string,
  consentementAppel: boolean,
): Promise<BasculerLivraisonResult> {
  if (!consentementAppel) {
    return { ok: false, error: "Merci de confirmer que tu seras joignable avant de valider." };
  }

  const commande = await getCommandeParReference(reference);
  if (!commande) return { ok: false, error: "Commande introuvable." };
  if (commande.mode_paiement !== "wave" || commande.statut !== "paiement_en_attente") {
    return { ok: false, error: "Cette commande ne peut plus changer de mode de paiement." };
  }

  const paiementLivraisonMax = await getPaiementLivraisonMax();
  if (!paiementAutorise("livraison", commande.total, waveDisponible(), paiementLivraisonMax)) {
    return { ok: false, error: "Pour ce montant, le paiement se fait d'avance par Wave." };
  }

  const { error } = await supabaseAdmin
    .from("commandes")
    .update({
      mode_paiement: "livraison",
      statut: "a_confirmer_appel",
      statut_paiement: null,
      wave_session_id: null,
    })
    .eq("id", commande.id);
  if (error) return { ok: false, error: "Impossible de changer le mode de paiement." };

  await notifierPushStatutCommande(commande.id, "a_confirmer_appel");

  return { ok: true, commandeId: commande.id, jeton: jetonClient(commande.client_id) };
}

async function relancerSessionPourCommande(commande: Commande): Promise<PaiementWaveResult> {
  if (commande.mode_paiement !== "wave" || commande.statut !== "paiement_en_attente") {
    return { ok: false, error: "Cette commande ne peut plus être payée en ligne." };
  }
  if (!commande.client_reference) {
    return { ok: false, error: "Référence de commande manquante." };
  }

  const { successUrl, errorUrl } = await urlsRetourWave(commande.client_reference);
  const session = await creerSessionWave({
    montant: commande.total,
    reference: commande.client_reference,
    successUrl,
    errorUrl,
  });
  if (!session.ok) return { ok: false, error: session.error };

  await supabaseAdmin
    .from("commandes")
    .update({ wave_session_id: session.session.id, statut_paiement: "en_attente" })
    .eq("id", commande.id);

  return {
    ok: true,
    waveLaunchUrl: session.session.waveLaunchUrl,
    commandeId: commande.id,
    jeton: jetonClient(commande.client_id),
    nomEnregistre: null,
  };
}

// Lecture d'une commande par sa référence de checkout — utilisée par les écrans
// de retour de paiement (confirmation / échec). commandes n'a aucune policy
// publique : lecture service_role uniquement.
export async function getCommandeParReference(reference: string): Promise<Commande | null> {
  const ref = reference.trim();
  if (!ref) return null;
  const { data } = await supabaseAdmin
    .from("commandes")
    .select("*")
    .eq("client_reference", ref)
    .maybeSingle<Commande>();
  return data ?? null;
}

// Rejoue la logique du webhook Wave depuis la page de simulation (dev sans clé).
// Refuse de tourner dès qu'un vrai secret Wave est configuré.
export async function simulerPaiementWave(
  reference: string,
  issue: "paye" | "echoue",
): Promise<{ ok: true; resultat: string } | { ok: false; error: string }> {
  if (!waveEnModeSimulation()) {
    return { ok: false, error: "Simulation indisponible : Wave est configuré en mode réel." };
  }
  const commande = await getCommandeParReference(reference);
  if (!commande) return { ok: false, error: "Commande introuvable." };

  const { data, error } = await supabaseAdmin.rpc("traiter_paiement_wave", {
    p_event_id: `sim_${issue}_${commande.id}_${Date.now()}`,
    p_reference: reference,
    p_session_id: commande.wave_session_id,
    p_resultat: issue,
    p_montant: issue === "paye" ? commande.total : null,
    p_erreur_code: null,
  });

  if (error) {
    console.error("Simulation webhook Wave: RPC échouée", error);
    return { ok: false, error: "La simulation a échoué." };
  }

  if (data === "ok_payee") await declencherPreparationsAuto(commande.id);
  return { ok: true, resultat: data as string };
}

export type DernierePosition = {
  lat: number;
  lng: number;
  precisionLivreur: string | null;
};

// Dernière position validée par le client, pour pré-remplir le checkout.
// Exige le jeton client (AUDIT_SECURITE_2 C3) : sans lui, on ne révèle pas la
// position GPS enregistrée pour un numéro.
export async function getDernierePosition(
  telephone: string,
  jeton: string,
): Promise<DernierePosition | null> {
  const numero = telephone.trim();
  if (!numero || !jeton) return null;
  const { data } = await supabaseAdmin
    .from("clients")
    .select("id, derniere_lat, derniere_lng, derniere_precision_livreur")
    .eq("telephone", numero)
    .maybeSingle();

  if (!data || !verifierJetonClient(data.id, jeton)) return null;
  if (data.derniere_lat == null || data.derniere_lng == null) return null;
  return {
    lat: data.derniere_lat,
    lng: data.derniere_lng,
    precisionLivreur: data.derniere_precision_livreur ?? null,
  };
}

export type LivraisonDefautCheckout = {
  localite: { id: number; nom: string } | null;
  lieuSpecial: { id: number; nom: string } | null;
  precisionLivreur: string | null;
};

// Localité par défaut + précision livreur choisies dans Préférences (§C.6) :
// pré-remplissent le checkout suivant. Même exigence de jeton que
// getDernierePosition ci-dessus.
export async function getLivraisonDefaut(
  telephone: string,
  jeton: string,
): Promise<LivraisonDefautCheckout | null> {
  const numero = telephone.trim();
  if (!numero || !jeton) return null;
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("telephone", numero)
    .maybeSingle();
  if (!client || !verifierJetonClient(client.id, jeton)) return null;

  const { data: pref } = await supabaseAdmin
    .from("preferences_utilisateur")
    .select("localite_defaut_id, lieu_special_defaut_id, precision_livreur, localites(id, nom), lieux_speciaux(id, nom)")
    .eq("client_id", client.id)
    .maybeSingle();
  if (!pref) return null;

  // Jointure belongs-to : Supabase renvoie tantôt un objet, tantôt un tableau
  // à un élément selon le contexte — même garde que resoudreLivraison ci-dessus.
  const unJoint = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const localite = unJoint(pref.localites as { id: number; nom: string } | { id: number; nom: string }[] | null);
  const lieuSpecial = unJoint(
    pref.lieux_speciaux as { id: number; nom: string } | { id: number; nom: string }[] | null,
  );

  return {
    localite,
    lieuSpecial,
    precisionLivreur: pref.precision_livreur ?? null,
  };
}
