"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { regionLaPlusProche } from "@/lib/senegal-regions";
import type { LignePanier } from "@/lib/local/panier";
import type { ModeLivraison, Produit, ProduitVariante } from "@/lib/supabase/types";

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
  const nom = input.nom.trim();
  const telephone = input.telephone.trim();
  const precisionLivreur = (input.precisionLivreur ?? "").trim() || null;

  if (lignes.length === 0) return { ok: false, error: "Ton panier est vide." };
  if (!nom || !telephone) {
    return { ok: false, error: "Merci de renseigner ton nom et ton téléphone." };
  }
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    return { ok: false, error: "Confirme le lieu de livraison sur la carte." };
  }
  if (nom.length > NOM_MAX || (precisionLivreur?.length ?? 0) > PRECISION_LIVREUR_MAX) {
    return { ok: false, error: "Un des champs est trop long." };
  }
  if (!TELEPHONE_REGEX.test(telephone)) {
    return { ok: false, error: "Numéro de téléphone invalide." };
  }
  if (lignes.length > LIGNES_MAX || lignes.some((l) => l.quantite < 1 || l.quantite > QUANTITE_MAX)) {
    return { ok: false, error: "Panier invalide." };
  }
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(input.reference)) {
    return { ok: false, error: "Requête invalide." };
  }

  const ip = await getClientIp();
  const autorise = await verifierLimite(`commande:${ip}`, 8, 600);
  if (!autorise) {
    return { ok: false, error: "Trop de commandes envoyées d'un coup. Réessaie dans quelques minutes." };
  }

  const produitIds = [...new Set(lignes.map((l) => l.produitId))];
  const varianteIds = [...new Set(lignes.map((l) => l.varianteId).filter((v): v is number => v !== null))];

  // Région déduite du point de livraison (jamais depuis le client) → zone/tarif.
  const regionNom = regionLaPlusProche(input.lat, input.lng);

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

  type LigneResolue = {
    produitId: number;
    varianteId: number | null;
    quantite: number;
    prixUnitaire: number;
    nom: string;
  };
  const lignesResolues: LigneResolue[] = [];

  for (const ligne of lignes) {
    const produit = produitsById.get(ligne.produitId);
    if (!produit) return { ok: false, error: "Un produit du panier n'existe plus." };

    const variante = ligne.varianteId ? variantesById.get(ligne.varianteId) : null;
    if (ligne.varianteId && !variante) {
      return { ok: false, error: "Une option choisie n'existe plus." };
    }

    const stockDisponible = variante ? variante.stock : produit.stock;
    if (stockDisponible < ligne.quantite) {
      return {
        ok: false,
        error: `Stock insuffisant pour "${produit.nom}" (${stockDisponible} disponible${stockDisponible > 1 ? "s" : ""}).`,
      };
    }

    lignesResolues.push({
      produitId: produit.id,
      varianteId: variante?.id ?? null,
      quantite: ligne.quantite,
      prixUnitaire: variante?.prix ?? produit.prix,
      nom: produit.nom,
    });
  }

  const sousTotal = lignesResolues.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0);
  const fraisLivraison =
    sousTotal >= SEUIL_GRATUITE ? 0 : input.modeLivraison === "24h" ? zone.tarif_24h : zone.tarif_6j;
  const total = sousTotal + fraisLivraison;

  // Client retrouvé par téléphone (identifiant unique), sinon créé ; la zone
  // connue est mise à jour à chaque commande. Le conflit sur la contrainte
  // unique (deux commandes du même nouveau client à la même seconde) est géré
  // en relisant le client au lieu d'échouer.
  const { data: clientExistant, error: clientReadError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("telephone", telephone)
    .maybeSingle();
  if (clientReadError) return { ok: false, error: "Une erreur est survenue, réessaie." };

  // Dernière position mémorisée pour pré-remplir la prochaine commande.
  const positionClient = {
    derniere_lat: input.lat,
    derniere_lng: input.lng,
    derniere_precision_livreur: precisionLivreur,
  };

  let clientId: number;
  if (clientExistant) {
    clientId = clientExistant.id;
    await supabaseAdmin
      .from("clients")
      .update({ nom, zone_id: zone.id, ...positionClient })
      .eq("id", clientId);
  } else {
    const { data: nouveauClient, error: clientInsertError } = await supabaseAdmin
      .from("clients")
      .insert({ nom, telephone, zone_id: zone.id, ...positionClient })
      .select()
      .single();

    if (clientInsertError || !nouveauClient) {
      // Conflit probable sur la contrainte unique telephone (double clic /
      // deux onglets) : le client vient d'être créé entre-temps, on le relit.
      const { data: retente } = await supabaseAdmin
        .from("clients")
        .select("*")
        .eq("telephone", telephone)
        .maybeSingle();
      if (!retente) return { ok: false, error: "Impossible de créer ton profil client." };
      clientId = retente.id;
    } else {
      clientId = nouveauClient.id;
    }
  }

  const { data: commandeId, error: commandeError } = await supabaseAdmin.rpc("creer_commande", {
    p_client_id: clientId,
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
    p_lignes: lignesResolues.map((l) => ({
      produit_id: l.produitId,
      variante_id: l.varianteId,
      quantite: l.quantite,
      prix_unitaire: l.prixUnitaire,
    })),
  });

  if (commandeError) {
    const match = /STOCK_INSUFFISANT:(\d+)/.exec(commandeError.message);
    if (match) {
      const produitId = Number(match[1]);
      const nomProduit = lignesResolues.find((l) => l.produitId === produitId)?.nom ?? "un article";
      return {
        ok: false,
        error: `Stock insuffisant pour "${nomProduit}" — quelqu'un d'autre vient de le commander. Retire-le ou ajuste la quantité.`,
      };
    }
    return { ok: false, error: "Impossible de créer la commande." };
  }

  // Annotation non critique (perso ebook) : posée après coup pour ne pas
  // toucher à la fonction atomique creer_commande. Idempotent si la requête
  // est rejouée (même valeur réécrite).
  const enfantsEbook = formaterEnfantsEbook(input.enfantsEbook);
  if (enfantsEbook) {
    await supabaseAdmin
      .from("commandes")
      .update({ enfants_ebook: enfantsEbook })
      .eq("id", commandeId as number);
  }

  return { ok: true, commandeId: commandeId as number };
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
