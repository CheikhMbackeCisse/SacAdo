"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { creerSessionWave, waveDisponible, waveEnModeSimulation } from "@/lib/wave/client";
import { jetonClient, verifierJetonClient } from "@/lib/client-auth";
import { declencherPreparationsAuto } from "@/lib/preparation-auto";
import { rendreModele } from "@/lib/messages/modeles";
import { origineSite } from "@/lib/site-url";
import { commandeModifiablePourAjout } from "@/lib/ajout/eligibilite";
import type { GroupeKitPanier, LignePanier } from "@/lib/local/panier";
import type { Commande, CommandeAjout, ModePaiement, Produit, ProduitVariante } from "@/lib/supabase/types";

// Ajouter des produits à une commande déjà passée, pas encore en livraison
// (PROMPT_CLIENT_V2 Lot 4, migration 0107) : pas de nouveaux frais de
// livraison (déjà comptés), paiement propre à l'ajout (Wave ou ajouté au
// montant dû à la livraison). Même esprit que lib/checkout/actions.ts : prix
// et stock toujours relus en base, jamais fait confiance côté client.

export type CommandeAjoutInfo = {
  commandeId: number;
  numero: number;
  modePaiement: ModePaiement;
  localiteNom: string | null;
  // Modes de paiement proposés pour CET ajout, déduits du mode de paiement de
  // la commande d'origine (CLAUDE_V2 Lot 4) : une commande payée à la
  // livraison ne propose que "livraison" pour l'ajout (pas de Wave imposé
  // après coup) ; une commande Wave propose Wave par défaut, ou la livraison.
  optionsPaiement: ModePaiement[];
};

// Lue par la bannière "mode ajout" (persistée côté client) et par la page
// /ajout : revalide à chaque fois que la commande est toujours modifiable
// (elle a pu passer "En livraison" entre-temps).
export async function getCommandeModifiable(
  commandeId: number,
  jeton: string,
): Promise<CommandeAjoutInfo | null> {
  const { data: commande } = await supabaseAdmin
    .from("commandes")
    .select("id, client_id, statut, mode_paiement, localite_nom")
    .eq("id", commandeId)
    .maybeSingle<Pick<Commande, "id" | "client_id" | "statut" | "mode_paiement" | "localite_nom">>();
  if (!commande || !verifierJetonClient(commande.client_id, jeton)) return null;
  if (!commandeModifiablePourAjout(commande.statut)) return null;

  return {
    commandeId: commande.id,
    numero: commande.id,
    modePaiement: commande.mode_paiement,
    localiteNom: commande.localite_nom,
    optionsPaiement: commande.mode_paiement === "wave" ? ["wave", "livraison"] : ["livraison"],
  };
}

// Pour la relance proactive au checkout ("Ajouter à votre commande en cours
// n°X ?", PROMPT_CLIENT_V2 Lot 4) : trouve la commande modifiable la plus
// récente pour ce numéro. Ne révèle qu'un id + un jeton fraîchement émis —
// jamais le contenu, le montant ou l'adresse — même niveau d'exposition que
// le nom déjà révélé pour un numéro existant (GROUPE_B §1).
export async function getCommandeModifiableParTelephone(
  telephone: string,
): Promise<{ commandeId: number; jeton: string } | null> {
  const numero = telephone.trim();
  if (!numero) return null;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("telephone", numero)
    .maybeSingle();
  if (!client) return null;

  const { data: commandes } = await supabaseAdmin
    .from("commandes")
    .select("id, statut")
    .eq("client_id", client.id)
    .order("date", { ascending: false })
    .limit(10);

  const modifiable = (commandes ?? []).find((c) => commandeModifiablePourAjout(c.statut as string));
  if (!modifiable) return null;

  return { commandeId: modifiable.id as number, jeton: jetonClient(client.id) };
}

type LigneAjoutResolue = {
  produitId: number;
  varianteId: number | null;
  quantite: number;
  prixUnitaire: number;
  groupe: GroupeKitPanier | null;
};

const LIGNES_MAX = 50;
const QUANTITE_MAX = 999;

function panierValide(lignes: LignePanier[]): boolean {
  return (
    lignes.length > 0 &&
    lignes.length <= LIGNES_MAX &&
    lignes.every((l) => l.quantite >= 1 && l.quantite <= QUANTITE_MAX)
  );
}

// Prix relus en base — même garde que resoudreCommande (lib/checkout/actions.ts),
// mais sans livraison : un ajout ne recalcule ni zone ni frais, déjà comptés
// sur la commande d'origine.
async function resoudreLignesAjout(
  lignes: LignePanier[],
): Promise<{ ok: true; lignes: LigneAjoutResolue[]; sousTotal: number } | { ok: false; error: string }> {
  if (!panierValide(lignes)) return { ok: false, error: "Panier invalide." };

  const produitIds = [...new Set(lignes.map((l) => l.produitId))];
  const varianteIds = [...new Set(lignes.map((l) => l.varianteId).filter((v): v is number => v !== null))];

  const [produitsRes, variantesRes] = await Promise.all([
    supabaseAdmin.from("produits").select("*").in("id", produitIds),
    varianteIds.length > 0
      ? supabaseAdmin.from("produit_variantes").select("*").in("id", varianteIds)
      : Promise.resolve({ data: [] as ProduitVariante[], error: null }),
  ]);
  if (produitsRes.error || variantesRes.error) return { ok: false, error: "Une erreur est survenue, réessaie." };

  const produitsById = new Map<number, Produit>((produitsRes.data ?? []).map((p) => [p.id, p]));
  const variantesById = new Map<number, ProduitVariante>((variantesRes.data ?? []).map((v) => [v.id, v]));

  const resolues: LigneAjoutResolue[] = [];
  for (const ligne of lignes) {
    const produit = produitsById.get(ligne.produitId);
    if (!produit) return { ok: false, error: "Un produit n'existe plus." };
    if (produit.vendeur_id !== null && produit.statut_publication !== "publie") {
      return { ok: false, error: "Un produit n'est plus disponible à la vente." };
    }

    const variante = ligne.varianteId ? variantesById.get(ligne.varianteId) : null;
    if (ligne.varianteId && !variante) return { ok: false, error: "Une option choisie n'existe plus." };
    if (variante && variante.produit_id !== produit.id) {
      return { ok: false, error: "Cette option ne correspond pas à ce produit." };
    }

    resolues.push({
      produitId: produit.id,
      varianteId: variante?.id ?? null,
      quantite: ligne.quantite,
      prixUnitaire: variante?.prix ?? produit.prix,
      groupe: ligne.groupe ?? null,
    });
  }

  const sousTotal = resolues.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0);
  return { ok: true, lignes: resolues, sousTotal };
}

function lignesPourRpc(lignes: LigneAjoutResolue[]) {
  return lignes.map((l) => ({
    produit_id: l.produitId,
    variante_id: l.varianteId,
    quantite: l.quantite,
    prix_unitaire: l.prixUnitaire,
    kit_groupe_id: l.groupe?.id ?? null,
    kit_id: l.groupe?.kitId ?? null,
    kit_nom: l.groupe ? `${l.groupe.niveau} · ${l.groupe.gammeLabel}` : null,
    kit_classe: l.groupe?.niveau ?? null,
    kit_gamme: l.groupe?.gammeLabel ?? null,
    kit_beneficiaire_prenom: l.groupe?.beneficiairePrenom ?? null,
  }));
}

async function urlsRetourAjout(reference: string) {
  const base = await origineSite();
  const ref = encodeURIComponent(reference);
  return {
    successUrl: `${base}/ajout/confirmation?ref=${ref}`,
    errorUrl: `${base}/ajout/paiement-echoue?ref=${ref}`,
  };
}

async function figerPrixAchatAjout(ajoutId: number, lignes: LigneAjoutResolue[]): Promise<void> {
  const idsProduits = [...new Set(lignes.map((l) => l.produitId))];
  const { data: produits } = await supabaseAdmin
    .from("produits")
    .select("id, prix_achat")
    .in("id", idsProduits);
  for (const p of produits ?? []) {
    if (p.prix_achat == null || p.prix_achat <= 0) continue;
    await supabaseAdmin
      .from("commande_items")
      .update({ prix_achat_unitaire: p.prix_achat })
      .eq("ajout_id", ajoutId)
      .eq("produit_id", p.id)
      .is("prix_achat_unitaire", null);
  }
}

async function notifierAjoutConfirme(commandeId: number, sousTotal: number): Promise<void> {
  try {
    const { data: modele } = await supabaseAdmin
      .from("modeles_messages")
      .select("titre, contenu")
      .eq("code", "commande_ajout")
      .eq("canal", "inbox")
      .eq("actif", true)
      .maybeSingle();
    if (!modele?.contenu) return;

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("client_id")
      .eq("id", commandeId)
      .maybeSingle();
    if (!commande) return;

    const montant = Math.round(sousTotal).toLocaleString("fr-FR");
    await supabaseAdmin.from("messages").insert({
      client_id: commande.client_id,
      type: "commande",
      titre: modele.titre ?? "Ajout à ta commande",
      corps: rendreModele(modele.contenu, { numero_commande: commandeId, montant }),
      lien: `/suivi/${commandeId}`,
    });
  } catch (e) {
    console.error("notifierAjoutConfirme a échoué", e);
  }
}

// Déclenche les fournisseurs pour les articles tout juste ajoutés, si la
// commande est en livraison 24h (idempotent par commande_item_id, voir
// lib/preparation-auto.ts — ne reprend jamais les lignes déjà demandées).
async function declencherPreparationAjout(commandeId: number): Promise<void> {
  await declencherPreparationsAuto(commandeId);
}

export type AjoutResult =
  | { ok: true; commandeId: number; waveLaunchUrl?: string }
  | { ok: false; error: string };

// Ajout payé à la livraison : validé tout de suite, s'ajoute au montant dû
// (ajouter_a_commande le fait en base, atomique avec la création des lignes).
export async function confirmerAjoutLivraison(
  commandeId: number,
  jeton: string,
  lignes: LignePanier[],
  reference: string,
): Promise<AjoutResult> {
  const info = await getCommandeModifiable(commandeId, jeton);
  if (!info) return { ok: false, error: "Cette commande ne peut plus être modifiée." };
  if (!info.optionsPaiement.includes("livraison")) {
    return { ok: false, error: "Le paiement à la livraison n'est pas disponible pour cet ajout." };
  }
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(reference)) return { ok: false, error: "Requête invalide." };

  const ip = await getClientIp();
  if (!(await verifierLimite(`ajout:${ip}`, 8, 600))) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const resolu = await resoudreLignesAjout(lignes);
  if (!resolu.ok) return { ok: false, error: resolu.error };

  const { data: ajoutId, error } = await supabaseAdmin.rpc("ajouter_a_commande", {
    p_commande_id: commandeId,
    p_reference: reference,
    p_mode_paiement: "livraison",
    p_sous_total: resolu.sousTotal,
    p_lignes: lignesPourRpc(resolu.lignes),
    p_wave_session_id: null,
  });
  if (error) return { ok: false, error: "Impossible d'ajouter ces produits." };

  await figerPrixAchatAjout(ajoutId as number, resolu.lignes);
  await notifierAjoutConfirme(commandeId, resolu.sousTotal);
  await declencherPreparationAjout(commandeId);

  return { ok: true, commandeId };
}

// Ajout payé d'avance par Wave : crée le lot d'ajout ('en_attente') + une
// session Wave, comme demarrerPaiementWave pour une commande. Le total de la
// commande n'augmente qu'au webhook (traiter_paiement_ajout_wave).
export async function demarrerAjoutWave(
  commandeId: number,
  jeton: string,
  lignes: LignePanier[],
  reference: string,
): Promise<AjoutResult> {
  const info = await getCommandeModifiable(commandeId, jeton);
  if (!info) return { ok: false, error: "Cette commande ne peut plus être modifiée." };
  if (!info.optionsPaiement.includes("wave") || !waveDisponible()) {
    return { ok: false, error: "Le paiement Wave n'est pas disponible pour cet ajout." };
  }
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(reference)) return { ok: false, error: "Requête invalide." };

  const ip = await getClientIp();
  if (!(await verifierLimite(`ajout:${ip}`, 8, 600))) {
    return { ok: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const resolu = await resoudreLignesAjout(lignes);
  if (!resolu.ok) return { ok: false, error: resolu.error };

  const existant = await getAjoutParReference(reference);
  if (existant) return relancerSessionAjout(existant);

  const { successUrl, errorUrl } = await urlsRetourAjout(reference);
  const session = await creerSessionWave({ montant: resolu.sousTotal, reference, successUrl, errorUrl });
  if (!session.ok) return { ok: false, error: session.error };

  const { data: ajoutId, error } = await supabaseAdmin.rpc("ajouter_a_commande", {
    p_commande_id: commandeId,
    p_reference: reference,
    p_mode_paiement: "wave",
    p_sous_total: resolu.sousTotal,
    p_lignes: lignesPourRpc(resolu.lignes),
    p_wave_session_id: session.session.id,
  });
  if (error) return { ok: false, error: "Impossible d'ajouter ces produits." };

  await figerPrixAchatAjout(ajoutId as number, resolu.lignes);

  return { ok: true, commandeId, waveLaunchUrl: session.session.waveLaunchUrl };
}

export async function reprendrePaiementAjoutWave(reference: string): Promise<AjoutResult> {
  const ajout = await getAjoutParReference(reference);
  if (!ajout) return { ok: false, error: "Ajout introuvable." };
  return relancerSessionAjout(ajout);
}

async function relancerSessionAjout(ajout: CommandeAjout): Promise<AjoutResult> {
  if (ajout.mode_paiement !== "wave" || ajout.statut_paiement === "payee") {
    return { ok: false, error: "Cet ajout ne peut plus être payé en ligne." };
  }

  const { successUrl, errorUrl } = await urlsRetourAjout(ajout.reference);
  const session = await creerSessionWave({ montant: ajout.sous_total, reference: ajout.reference, successUrl, errorUrl });
  if (!session.ok) return { ok: false, error: session.error };

  await supabaseAdmin
    .from("commande_ajouts")
    .update({ wave_session_id: session.session.id, statut_paiement: "en_attente" })
    .eq("id", ajout.id);

  return { ok: true, commandeId: ajout.commande_id, waveLaunchUrl: session.session.waveLaunchUrl };
}

export async function getAjoutParReference(reference: string): Promise<CommandeAjout | null> {
  const ref = reference.trim();
  if (!ref) return null;
  const { data } = await supabaseAdmin
    .from("commande_ajouts")
    .select("*")
    .eq("reference", ref)
    .maybeSingle<CommandeAjout>();
  return data ?? null;
}

// Rejoue le webhook Wave depuis la page de simulation (dev sans clé) — pendant
// de simulerPaiementWave (lib/checkout/actions.ts) pour un ajout.
export async function simulerPaiementAjoutWave(
  reference: string,
  issue: "paye" | "echoue",
): Promise<{ ok: true; resultat: string } | { ok: false; error: string }> {
  if (!waveEnModeSimulation()) {
    return { ok: false, error: "Simulation indisponible : Wave est configuré en mode réel." };
  }
  const ajout = await getAjoutParReference(reference);
  if (!ajout) return { ok: false, error: "Ajout introuvable." };

  const { data, error } = await supabaseAdmin.rpc("traiter_paiement_ajout_wave", {
    p_event_id: `sim_${issue}_${ajout.id}_${Date.now()}`,
    p_reference: reference,
    p_session_id: ajout.wave_session_id,
    p_resultat: issue,
    p_montant: issue === "paye" ? ajout.sous_total : null,
  });
  if (error) {
    console.error("Simulation webhook Wave (ajout): RPC échouée", error);
    return { ok: false, error: "La simulation a échoué." };
  }

  if (data === "ok_payee") {
    await notifierAjoutConfirme(ajout.commande_id, ajout.sous_total);
    await declencherPreparationAjout(ajout.commande_id);
  }
  return { ok: true, resultat: data as string };
}
