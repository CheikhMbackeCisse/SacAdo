"use server";

import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { optionsPaiementPourTotal, paiementAutorise, type OptionsPaiement } from "@/lib/checkout/montants";
import { creerSessionWave, waveDisponible, waveEnModeSimulation } from "@/lib/wave/client";
import { jetonClient, verifierJetonClient } from "@/lib/client-auth";
import { journaliserCommande } from "@/lib/mesure";
import { fusionnerSessionCourante } from "@/lib/affinites";
import { getSeuilLivraisonGratuite } from "@/lib/parametres";
import { declencherPreparationsAuto } from "@/lib/preparation-auto";
import type { LignePanier } from "@/lib/local/panier";
import type { Commande, ModeLivraison, Produit, ProduitVariante, Zone } from "@/lib/supabase/types";

// Formats larges exprès (numéros sénégalais et internationaux varient), mais
// bornés : sert à rejeter du bruit random, pas à valider un vrai numéro.
const TELEPHONE_REGEX = /^[0-9+\s.-]{6,20}$/;
const NOM_MAX = 100;
const PRECISION_LIVREUR_MAX = 300;
const LOCALITE_TEXTE_MAX = 150;
const LIGNES_MAX = 50;
const QUANTITE_MAX = 999;

export type CheckoutInput = {
  nom: string;
  telephone: string;
  // Localité choisie dans le sélecteur dédié (IMPLEMENTATION_TARIFS_LIVRAISON.md) :
  // détermine le tarif. `localiteId`/`lieuSpecialId` sont mutuellement exclusifs ;
  // si aucun des deux ne correspond (saisie libre non reconnue), `localiteTexte`
  // sert de libellé et le tarif reste "à confirmer" — la commande n'est pas bloquée.
  localiteId: number | null;
  lieuSpecialId: number | null;
  localiteTexte: string;
  // Point carte désormais FACULTATIF : sert uniquement à préciser l'endroit
  // exact pour le livreur, plus à déduire le tarif.
  lat: number | null;
  lng: number | null;
  // Champ libre facultatif : « portail bleu, 2e étage, appeler en arrivant ».
  precisionLivreur?: string | null;
  modeLivraison: ModeLivraison;
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
  nom: string;
  stockDisponible: number;
};

type CommandeResolue = {
  zoneId: number | null;
  localiteId: number | null;
  lieuSpecialId: number | null;
  localiteNom: string;
  aConfirmer: boolean;
  lignesResolues: LigneResolue[];
  sousTotal: number;
  fraisLivraison: number;
  // Les deux tarifs (pas seulement celui du mode choisi) pour que le checkout
  // affiche les deux options de vitesse sans un aller-retour par mode.
  fraisLivraison24h: number;
  fraisLivraison6j: number;
  total: number;
};

type ResolutionLivraison = {
  zoneId: number | null;
  localiteId: number | null;
  lieuSpecialId: number | null;
  localiteNom: string;
  fraisLivraison: number;
  fraisLivraison24h: number;
  fraisLivraison6j: number;
  aConfirmer: boolean;
};

// Tarif recalculé EN BASE à partir de l'id envoyé (jamais du libellé ou du
// montant que le client pourrait forger) — IMPLEMENTATION_TARIFS_LIVRAISON.md §6.
async function resoudreLivraison(params: {
  modeLivraison: ModeLivraison;
  localiteId: number | null;
  lieuSpecialId: number | null;
  localiteTexte: string;
}): Promise<{ ok: true; data: ResolutionLivraison } | { ok: false; error: string }> {
  if (params.lieuSpecialId != null) {
    const { data: lieu, error } = await supabaseAdmin
      .from("lieux_speciaux")
      .select("*")
      .eq("id", params.lieuSpecialId)
      .maybeSingle();
    if (error) return { ok: false, error: "Une erreur est survenue, réessaie." };
    if (!lieu) return { ok: false, error: "Ce lieu n'est plus disponible, choisis-en un autre." };
    // Même tarif quelle que soit la vitesse choisie (§4 du doc de spec).
    const tarif = lieu.mode === "a_confirmer" ? 0 : (lieu.tarif ?? 0);
    return {
      ok: true,
      data: {
        zoneId: null,
        localiteId: null,
        lieuSpecialId: lieu.id,
        localiteNom: lieu.nom,
        fraisLivraison: tarif,
        fraisLivraison24h: tarif,
        fraisLivraison6j: tarif,
        aConfirmer: lieu.mode === "a_confirmer",
      },
    };
  }

  if (params.localiteId != null) {
    const { data: localite, error } = await supabaseAdmin
      .from("localites")
      .select("*, groupe:zones(*)")
      .eq("id", params.localiteId)
      .maybeSingle();
    if (error) return { ok: false, error: "Une erreur est survenue, réessaie." };
    type LocaliteJointe = { id: number; nom: string; groupe: Zone | Zone[] | null };
    const row = localite as unknown as LocaliteJointe | null;
    const groupe = row ? (Array.isArray(row.groupe) ? row.groupe[0] : row.groupe) : null;
    if (!row || !groupe) {
      return { ok: false, error: "Cette localité n'est plus disponible, choisis-en une autre." };
    }
    return {
      ok: true,
      data: {
        zoneId: groupe.id,
        localiteId: row.id,
        lieuSpecialId: null,
        localiteNom: row.nom,
        fraisLivraison: params.modeLivraison === "24h" ? groupe.tarif_24h : groupe.tarif_6j,
        fraisLivraison24h: groupe.tarif_24h,
        fraisLivraison6j: groupe.tarif_6j,
        aConfirmer: false,
      },
    };
  }

  // Rien de reconnu : saisie libre, on ne bloque pas la commande (§6) — l'admin
  // confirme le tarif ensuite.
  const texteLibre = params.localiteTexte.trim().slice(0, LOCALITE_TEXTE_MAX);
  if (!texteLibre) return { ok: false, error: "Indique ta localité de livraison." };
  return {
    ok: true,
    data: {
      zoneId: null,
      localiteId: null,
      lieuSpecialId: null,
      localiteNom: texteLibre,
      fraisLivraison: 0,
      fraisLivraison24h: 0,
      fraisLivraison6j: 0,
      aConfirmer: true,
    },
  };
}

// Prix et frais recalculés EN BASE (jamais depuis le client) à partir du
// panier et de la localité. Partagé par passerCommande() (création) et
// getOptionsPaiement() (règle du seuil de paiement) pour qu'un seul et même
// total serve à décider et à facturer. Ne fait pas le contrôle de stock dur :
// il expose stockDisponible par ligne, l'appelant décide quoi en faire.
async function resoudreCommande(
  lignes: LignePanier[],
  params: {
    modeLivraison: ModeLivraison;
    localiteId: number | null;
    lieuSpecialId: number | null;
    localiteTexte: string;
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

    lignesResolues.push({
      produitId: produit.id,
      varianteId: variante?.id ?? null,
      quantite: ligne.quantite,
      prixUnitaire: variante?.prix ?? produit.prix,
      nom: produit.nom,
      stockDisponible: variante ? variante.stock : produit.stock,
    });
  }

  const sousTotal = lignesResolues.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0);
  // Livraison gratuite au-dessus du seuil : prime sur tout le reste, y compris
  // un tarif "à confirmer" (rien à confirmer si c'est de toute façon gratuit).
  const gratuite = sousTotal >= seuil;
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
      lignesResolues,
      sousTotal,
      fraisLivraison,
      fraisLivraison24h: gratuite ? 0 : livraison.data.fraisLivraison24h,
      fraisLivraison6j: gratuite ? 0 : livraison.data.fraisLivraison6j,
      total: sousTotal + fraisLivraison,
    },
  };
}

function coordonneesValides(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
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
        fraisLivraison6j: number;
        localiteNom: string;
        aConfirmer: boolean;
      })
  | { ok: false; error: string };

// Règle du seuil de paiement (INTEGRATION_WAVE.md, lot W2) : le checkout appelle
// cette action pour savoir quels modes de paiement proposer ET le tarif de
// livraison à afficher (recalculé ici, jamais fourni par le client).
export async function getOptionsPaiement(
  lignes: LignePanier[],
  params: {
    modeLivraison: ModeLivraison;
    localiteId: number | null;
    lieuSpecialId: number | null;
    localiteTexte: string;
  },
): Promise<OptionsPaiementResult> {
  if (!panierValide(lignes)) return { ok: false, error: "Panier invalide." };

  const resolu = await resoudreCommande(lignes, params);
  if (!resolu.ok) return { ok: false, error: resolu.error };

  return {
    ok: true,
    ...optionsPaiementPourTotal(resolu.data.total, waveDisponible()),
    fraisLivraison: resolu.data.fraisLivraison,
    fraisLivraison24h: resolu.data.fraisLivraison24h,
    fraisLivraison6j: resolu.data.fraisLivraison6j,
    localiteNom: resolu.data.localiteNom,
    aConfirmer: resolu.data.aConfirmer,
  };
}

// Validation commune du formulaire de checkout (livraison comme Wave).
function validerCheckout(input: CheckoutInput, lignes: LignePanier[]): string | null {
  const nom = input.nom.trim();
  const telephone = input.telephone.trim();
  const precisionLivreur = (input.precisionLivreur ?? "").trim();
  const localiteTexte = input.localiteTexte.trim();

  if (lignes.length === 0) return "Ton panier est vide.";
  if (!nom || !telephone) return "Merci de renseigner ton nom et ton téléphone.";
  if (!localiteTexte) return "Indique ta localité de livraison.";
  if (localiteTexte.length > LOCALITE_TEXTE_MAX) return "Nom de localité trop long.";
  if (input.lat != null && input.lng != null && !coordonneesValides(input.lat, input.lng)) {
    return "Position invalide sur la carte.";
  }
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
  const position = {
    derniere_lat: params.lat,
    derniere_lng: params.lng,
    derniere_precision_livreur: params.precisionLivreur,
  };

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

// Traduit l'erreur brute de creer_commande() (souvent STOCK_INSUFFISANT:<id>)
// en message client.
function messageErreurCreerCommande(message: string, lignesResolues: LigneResolue[]): string {
  const match = /STOCK_INSUFFISANT:(\d+)/.exec(message);
  if (match) {
    const nomProduit =
      lignesResolues.find((l) => l.produitId === Number(match[1]))?.nom ?? "un article";
    return `Stock insuffisant pour "${nomProduit}" — quelqu'un d'autre vient de le commander. Retire-le ou ajuste la quantité.`;
  }
  return "Impossible de créer la commande.";
}

function lignesPourRpc(lignesResolues: LigneResolue[]) {
  return lignesResolues.map((l) => ({
    produit_id: l.produitId,
    variante_id: l.varianteId,
    quantite: l.quantite,
    prix_unitaire: l.prixUnitaire,
  }));
}

// Toute la logique métier de MODELE_DONNEES.md (Lot 4) : les prix et le stock
// ne sont JAMAIS pris depuis le client, on relit tout en base ici. C'est aussi
// la seule route autorisée à écrire dans clients/commandes/commande_items
// (RLS n'accorde aucun accès public à ces tables, voir supabase/README.md).
//
// Le stock est vérifié ici une première fois (retour rapide et clair dans le
// cas courant), mais la vérification qui compte vraiment est celle, atomique,
// de creer_commande() côté base : c'est elle qui empêche deux commandes
// simultanées de survendre le dernier exemplaire d'un article (voir
// 0004_performance.sql pour le détail du problème corrigé).
export async function passerCommande(
  lignes: LignePanier[],
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const erreurValidation = validerCheckout(input, lignes);
  if (erreurValidation) return { ok: false, error: erreurValidation };

  const precisionLivreur = (input.precisionLivreur ?? "").trim() || null;

  const ip = await getClientIp();
  const autorise = await verifierLimite(`commande:${ip}`, 8, 600);
  if (!autorise) {
    return { ok: false, error: "Trop de commandes envoyées d'un coup. Réessaie dans quelques minutes." };
  }

  const resolu = await resoudreCommande(lignes, {
    modeLivraison: input.modeLivraison,
    localiteId: input.localiteId,
    lieuSpecialId: input.lieuSpecialId,
    localiteTexte: input.localiteTexte,
  });
  if (!resolu.ok) return { ok: false, error: resolu.error };
  const { zoneId, localiteId, lieuSpecialId, localiteNom, aConfirmer, lignesResolues, sousTotal, fraisLivraison, total } =
    resolu.data;

  // Au-dessus du seuil, le paiement à la livraison n'est plus permis
  // (INTEGRATION_WAVE.md, W2). Contrôle serveur : le client a beau envoyer
  // "livraison", on refuse. Le checkout bascule alors sur demarrerPaiementWave.
  // (Si Wave n'est pas branché, waveDisponible()=false => tout reste "livraison".)
  if (!paiementAutorise("livraison", total, waveDisponible())) {
    return { ok: false, error: "Pour ce montant, le paiement se fait d'avance par Wave." };
  }

  for (const ligne of lignesResolues) {
    if (ligne.stockDisponible < ligne.quantite) {
      return {
        ok: false,
        error: `Stock insuffisant pour "${ligne.nom}" (${ligne.stockDisponible} disponible${ligne.stockDisponible > 1 ? "s" : ""}).`,
      };
    }
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
    return { ok: false, error: messageErreurCreerCommande(commandeError.message, lignesResolues) };
  }

  await annoterEbookClasses(commandeId as number, input.ebookClasses);

  // Signal de classement « commande » (poids 5), une ligne par produit.
  await journaliserCommande(lignesPourJournal(lignesResolues, input.attributions), {
    clientId: client.clientId,
  });

  // Commande en livraison 24h : prévenir automatiquement les fournisseurs
  // concernés (NOTIFICATIONS_FOURNISSEURS §2). Ne bloque pas la confirmation.
  if (input.modeLivraison === "24h") {
    await declencherPreparationsAuto(commandeId as number);
  }

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

// Origine publique du site, pour construire les URLs de retour passées à Wave.
async function origineSite(): Promise<string> {
  const configuree = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configuree) return configuree;
  // Repli dev (site lancé sur une IP réseau sans variable configurée).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

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
    localiteId: input.localiteId,
    lieuSpecialId: input.lieuSpecialId,
    localiteTexte: input.localiteTexte,
  });
  if (!resolu.ok) return { ok: false, error: resolu.error };
  const { zoneId, localiteId, lieuSpecialId, localiteNom, aConfirmer, lignesResolues, sousTotal, fraisLivraison, total } =
    resolu.data;

  if (!paiementAutorise("wave", total)) {
    return { ok: false, error: "Le paiement Wave n'est pas disponible pour cette commande." };
  }

  for (const ligne of lignesResolues) {
    if (ligne.stockDisponible < ligne.quantite) {
      return {
        ok: false,
        error: `Stock insuffisant pour "${ligne.nom}" (${ligne.stockDisponible} disponible${ligne.stockDisponible > 1 ? "s" : ""}).`,
      };
    }
  }

  // Une commande déjà créée pour cette référence (double clic, retour arrière) :
  // on ne recrée rien, on relance juste une session de paiement dessus.
  const existante = await getCommandeParReference(input.reference);
  if (existante) return relancerSessionPourCommande(existante);

  // Session Wave créée AVANT la commande : si Wave refuse, aucune commande ni
  // décrément de stock (rien à nettoyer). Si la commande échoue ensuite (course
  // sur le stock), la session Wave orpheline expire d'elle-même.
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
    return { ok: false, error: messageErreurCreerCommande(commandeError.message, lignesResolues) };
  }

  await annoterEbookClasses(commandeId as number, input.ebookClasses);

  // Signal de classement « commande » (poids 5). Enregistré à la création
  // (panier construit + kit choisi + checkout atteint) ; un paiement Wave
  // abandonné reste une exception, lissée par la fenêtre 90 j des affinités.
  await journaliserCommande(lignesPourJournal(lignesResolues, input.attributions), {
    clientId: client.clientId,
  });

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
