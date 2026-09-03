"use server";

import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { regionLaPlusProche } from "@/lib/senegal-regions";
import { optionsPaiementPourTotal, paiementAutorise, type OptionsPaiement } from "@/lib/checkout/montants";
import { creerSessionWave, waveEnModeSimulation } from "@/lib/wave/client";
import type { LignePanier } from "@/lib/local/panier";
import type { Commande, ModeLivraison, Produit, ProduitVariante, Zone } from "@/lib/supabase/types";

const SEUIL_GRATUITE = 50000;

// Formats larges exprès (numéros sénégalais et internationaux varient), mais
// bornés : sert à rejeter du bruit random, pas à valider un vrai numéro.
const TELEPHONE_REGEX = /^[0-9+\s.-]{6,20}$/;
const NOM_MAX = 100;
const PRECISION_LIVREUR_MAX = 300;
const LIGNES_MAX = 50;
const QUANTITE_MAX = 999;

export type EnfantEbook = { kit: string; prenom: string };

export type CheckoutInput = {
  nom: string;
  telephone: string;
  // Point validé sur la carte. Le client ne choisit plus sa région : on la
  // déduit de ces coordonnées côté serveur, ce qui détermine le tarif de
  // livraison (toujours par zone) — CORRECTIONS_DIVERSES_V6 §2.
  lat: number;
  lng: number;
  // Champ libre facultatif : « portail bleu, 2e étage, appeler en arrivant ».
  precisionLivreur?: string | null;
  modeLivraison: ModeLivraison;
  // Généré une fois côté client (crypto.randomUUID()) au chargement du
  // checkout : permet à creer_commande() de rejouer un clic double ou une
  // requête retentée sans créer deux commandes (voir 0004_performance.sql).
  reference: string;
  // Prénom(s) d'enfant saisis à l'ajout d'un kit, pour personnaliser l'ebook.
  enfantsEbook?: EnfantEbook[];
};

const ENFANTS_MAX = 20;
const ENFANT_CHAMP_MAX = 80;

// "Awa — Kit CP Confort ; Momar — Kit 6e Essentiel" (ou null si rien de saisi).
function formaterEnfantsEbook(entrees: EnfantEbook[] | undefined): string | null {
  if (!entrees?.length) return null;
  const texte = entrees
    .slice(0, ENFANTS_MAX)
    .map((e) => ({
      kit: String(e.kit ?? "").trim().slice(0, ENFANT_CHAMP_MAX),
      prenom: String(e.prenom ?? "").trim().slice(0, ENFANT_CHAMP_MAX),
    }))
    .filter((e) => e.prenom)
    .map((e) => (e.kit ? `${e.prenom} — ${e.kit}` : e.prenom))
    .join(" ; ");
  return texte || null;
}

export type CheckoutResult = { ok: true; commandeId: number } | { ok: false; error: string };

type LigneResolue = {
  produitId: number;
  varianteId: number | null;
  quantite: number;
  prixUnitaire: number;
  nom: string;
  stockDisponible: number;
};

type CommandeResolue = {
  zone: Zone;
  regionNom: string;
  lignesResolues: LigneResolue[];
  sousTotal: number;
  fraisLivraison: number;
  total: number;
};

// Prix, zone et frais recalculés EN BASE (jamais depuis le client) à partir du
// panier et du point de livraison. Partagé par passerCommande() (création) et
// getOptionsPaiement() (règle du seuil de paiement) pour qu'un seul et même
// total serve à décider et à facturer. Ne fait pas le contrôle de stock dur :
// il expose stockDisponible par ligne, l'appelant décide quoi en faire.
async function resoudreCommande(
  lignes: LignePanier[],
  params: { lat: number; lng: number; modeLivraison: ModeLivraison },
): Promise<{ ok: true; data: CommandeResolue } | { ok: false; error: string }> {
  const produitIds = [...new Set(lignes.map((l) => l.produitId))];
  const varianteIds = [...new Set(lignes.map((l) => l.varianteId).filter((v): v is number => v !== null))];

  // Région déduite du point de livraison (jamais depuis le client) → zone/tarif.
  const regionNom = regionLaPlusProche(params.lat, params.lng);

  const [produitsRes, variantesRes, zoneRes] = await Promise.all([
    supabaseAdmin.from("produits").select("*").in("id", produitIds),
    varianteIds.length > 0
      ? supabaseAdmin.from("produit_variantes").select("*").in("id", varianteIds)
      : Promise.resolve({ data: [] as ProduitVariante[], error: null }),
    supabaseAdmin.from("zones").select("*").eq("nom", regionNom).maybeSingle(),
  ]);

  if (produitsRes.error || variantesRes.error || zoneRes.error) {
    return { ok: false, error: "Une erreur est survenue, réessaie." };
  }
  const zone = zoneRes.data;
  if (!zone) {
    return { ok: false, error: "Impossible de déterminer la zone de livraison. Repositionne l'épingle." };
  }

  const produitsById = new Map<number, Produit>((produitsRes.data ?? []).map((p) => [p.id, p]));
  const variantesById = new Map<number, ProduitVariante>((variantesRes.data ?? []).map((v) => [v.id, v]));

  const lignesResolues: LigneResolue[] = [];
  for (const ligne of lignes) {
    const produit = produitsById.get(ligne.produitId);
    if (!produit) return { ok: false, error: "Un produit du panier n'existe plus." };

    const variante = ligne.varianteId ? variantesById.get(ligne.varianteId) : null;
    if (ligne.varianteId && !variante) {
      return { ok: false, error: "Une option choisie n'existe plus." };
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
  const fraisLivraison =
    sousTotal >= SEUIL_GRATUITE ? 0 : params.modeLivraison === "24h" ? zone.tarif_24h : zone.tarif_6j;

  return {
    ok: true,
    data: { zone, regionNom, lignesResolues, sousTotal, fraisLivraison, total: sousTotal + fraisLivraison },
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
  | ({ ok: true } & OptionsPaiement)
  | { ok: false; error: string };

// Règle du seuil de paiement (INTEGRATION_WAVE.md, lot W2) : le checkout appelle
// cette action pour savoir quels modes de paiement proposer. Le total est
// recalculé ici — un client qui trafique son panier ne peut pas contourner
// l'obligation de payer Wave au-dessus de 10 000 FCFA.
export async function getOptionsPaiement(
  lignes: LignePanier[],
  params: { lat: number; lng: number; modeLivraison: ModeLivraison },
): Promise<OptionsPaiementResult> {
  if (!panierValide(lignes)) return { ok: false, error: "Panier invalide." };
  if (!coordonneesValides(params.lat, params.lng)) {
    return { ok: false, error: "Confirme le lieu de livraison sur la carte." };
  }

  const resolu = await resoudreCommande(lignes, params);
  if (!resolu.ok) return { ok: false, error: resolu.error };

  return { ok: true, ...optionsPaiementPourTotal(resolu.data.total) };
}

// Validation commune du formulaire de checkout (livraison comme Wave).
function validerCheckout(input: CheckoutInput, lignes: LignePanier[]): string | null {
  const nom = input.nom.trim();
  const telephone = input.telephone.trim();
  const precisionLivreur = (input.precisionLivreur ?? "").trim();

  if (lignes.length === 0) return "Ton panier est vide.";
  if (!nom || !telephone) return "Merci de renseigner ton nom et ton téléphone.";
  if (!coordonneesValides(input.lat, input.lng)) {
    return "Confirme le lieu de livraison sur la carte.";
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
async function trouverOuCreerClient(params: {
  nom: string;
  telephone: string;
  zoneId: number;
  lat: number;
  lng: number;
  precisionLivreur: string | null;
}): Promise<{ ok: true; clientId: number } | { ok: false; error: string }> {
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
    await supabaseAdmin
      .from("clients")
      .update({ nom: params.nom, zone_id: params.zoneId, ...position })
      .eq("id", clientExistant.id);
    return { ok: true, clientId: clientExistant.id };
  }

  const { data: nouveauClient, error: clientInsertError } = await supabaseAdmin
    .from("clients")
    .insert({ nom: params.nom, telephone: params.telephone, zone_id: params.zoneId, ...position })
    .select()
    .single();

  if (clientInsertError || !nouveauClient) {
    const { data: retente } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("telephone", params.telephone)
      .maybeSingle();
    if (!retente) return { ok: false, error: "Impossible de créer ton profil client." };
    return { ok: true, clientId: retente.id };
  }
  return { ok: true, clientId: nouveauClient.id };
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

// Annotation non critique (perso ebook) : posée après coup pour ne pas toucher à
// la fonction atomique creer_commande. Idempotent si la requête est rejouée.
async function annoterEnfantsEbook(commandeId: number, enfants: EnfantEbook[] | undefined) {
  const texte = formaterEnfantsEbook(enfants);
  if (texte) {
    await supabaseAdmin.from("commandes").update({ enfants_ebook: texte }).eq("id", commandeId);
  }
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
    lat: input.lat,
    lng: input.lng,
    modeLivraison: input.modeLivraison,
  });
  if (!resolu.ok) return { ok: false, error: resolu.error };
  const { zone, lignesResolues, sousTotal, fraisLivraison, total } = resolu.data;

  // Au-dessus du seuil, le paiement à la livraison n'est plus permis
  // (INTEGRATION_WAVE.md, W2). Contrôle serveur : le client a beau envoyer
  // "livraison", on refuse. Le checkout bascule alors sur demarrerPaiementWave.
  if (!paiementAutorise("livraison", total)) {
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
    zoneId: zone.id,
    lat: input.lat,
    lng: input.lng,
    precisionLivreur,
  });
  if (!client.ok) return { ok: false, error: client.error };

  const { data: commandeId, error: commandeError } = await supabaseAdmin.rpc("creer_commande", {
    p_client_id: client.clientId,
    p_zone_id: zone.id,
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
  });

  if (commandeError) {
    return { ok: false, error: messageErreurCreerCommande(commandeError.message, lignesResolues) };
  }

  await annoterEnfantsEbook(commandeId as number, input.enfantsEbook);
  return { ok: true, commandeId: commandeId as number };
}

// ---------------------------------------------------------------------------
// Paiement Wave (INTEGRATION_WAVE.md, W3)
// ---------------------------------------------------------------------------

export type PaiementWaveResult =
  | { ok: true; waveLaunchUrl: string; commandeId: number }
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

  const precisionLivreur = (input.precisionLivreur ?? "").trim() || null;

  const ip = await getClientIp();
  const autorise = await verifierLimite(`commande:${ip}`, 8, 600);
  if (!autorise) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const resolu = await resoudreCommande(lignes, {
    lat: input.lat,
    lng: input.lng,
    modeLivraison: input.modeLivraison,
  });
  if (!resolu.ok) return { ok: false, error: resolu.error };
  const { zone, lignesResolues, sousTotal, fraisLivraison, total } = resolu.data;

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
    zoneId: zone.id,
    lat: input.lat,
    lng: input.lng,
    precisionLivreur,
  });
  if (!client.ok) return { ok: false, error: client.error };

  const { data: commandeId, error: commandeError } = await supabaseAdmin.rpc("creer_commande", {
    p_client_id: client.clientId,
    p_zone_id: zone.id,
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
  });

  if (commandeError) {
    return { ok: false, error: messageErreurCreerCommande(commandeError.message, lignesResolues) };
  }

  await annoterEnfantsEbook(commandeId as number, input.enfantsEbook);
  return { ok: true, waveLaunchUrl: session.session.waveLaunchUrl, commandeId: commandeId as number };
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

  return { ok: true, waveLaunchUrl: session.session.waveLaunchUrl, commandeId: commande.id };
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
  return { ok: true, resultat: data as string };
}

export type DernierePosition = {
  lat: number;
  lng: number;
  precisionLivreur: string | null;
};

// Dernière position validée par le client (via son numéro) pour pré-remplir le
// checkout. clients n'a aucune policy publique → lecture service_role seule.
export async function getDernierePosition(telephone: string): Promise<DernierePosition | null> {
  const numero = telephone.trim();
  if (!numero) return null;
  const { data } = await supabaseAdmin
    .from("clients")
    .select("derniere_lat, derniere_lng, derniere_precision_livreur")
    .eq("telephone", numero)
    .maybeSingle();

  if (!data || data.derniere_lat == null || data.derniere_lng == null) return null;
  return {
    lat: data.derniere_lat,
    lng: data.derniere_lng,
    precisionLivreur: data.derniere_precision_livreur ?? null,
  };
}
