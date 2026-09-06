"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estVendeurSacAdo } from "@/lib/vendeurs/constants";
import { chargerBonPreparation } from "@/lib/preparation-bon";
import {
  un,
  labelsVariantes,
  lignesEnAttente,
  creerDemandePourVendeur,
} from "@/lib/preparation-creer";
import type { ActionResult } from "./produits-actions";
import type { DemandePreparation, StatutDemandePreparation } from "@/lib/supabase/types";
import type { GroupeClient, LigneTotal, DemandePreparationDetail } from "@/lib/preparations";

export type VendeurEnAttente = {
  vendeurId: string;
  nom: string;
  nbArticles: number;
  nbCommandes: number;
};

// Vendeurs (= fournisseurs) qui ont au moins un article à préparer non encore
// inclus dans une demande. Sert à l'écran « Nouvelle demande ».
export async function getVendeursAvecArticlesEnAttente(): Promise<VendeurEnAttente[]> {
  await requireAdmin();

  const { data: produitsRows } = await supabaseAdmin
    .from("produits")
    .select("id, vendeur_id")
    .not("vendeur_id", "is", null);
  const vendeurParProduit = new Map<number, string>();
  for (const p of (produitsRows ?? []) as { id: number; vendeur_id: string }[]) {
    if (!estVendeurSacAdo(p.vendeur_id)) vendeurParProduit.set(p.id, p.vendeur_id);
  }

  const lignes = await lignesEnAttente([...vendeurParProduit.keys()]);

  const agg = new Map<string, { articles: number; commandes: Set<number> }>();
  for (const l of lignes) {
    const vendeurId = vendeurParProduit.get(l.produit_id);
    if (!vendeurId) continue;
    const e = agg.get(vendeurId) ?? { articles: 0, commandes: new Set<number>() };
    e.articles += l.quantite;
    e.commandes.add(l.commande_id);
    agg.set(vendeurId, e);
  }
  if (agg.size === 0) return [];

  const { data: vendeursRows } = await supabaseAdmin
    .from("vendeurs")
    .select("id, nom_boutique")
    .in("id", [...agg.keys()]);
  const nomParVendeur = new Map(
    ((vendeursRows ?? []) as { id: string; nom_boutique: string }[]).map((v) => [v.id, v.nom_boutique]),
  );

  return [...agg.entries()]
    .map(([vendeurId, e]) => ({
      vendeurId,
      nom: nomParVendeur.get(vendeurId) ?? "Vendeur",
      nbArticles: e.articles,
      nbCommandes: e.commandes.size,
    }))
    .sort((a, b) => b.nbArticles - a.nbArticles);
}

// `ArticleAPreparer`, `GroupeClient`, `LigneTotal`, `DemandePreparationDetail`
// vivent dans `@/lib/preparations` (partagés avec le bon de préparation public).

export type ApercuPreparation = {
  vendeurId: string;
  vendeurNom: string;
  groupes: GroupeClient[];
  totaux: LigneTotal[];
  nbArticles: number;
};

// Construit l'aperçu (regroupé par client + total) des articles à préparer pour
// un vendeur — sans rien enregistrer.
async function construireApercu(vendeurId: string): Promise<ApercuPreparation | null> {
  const { data: vendeur } = await supabaseAdmin
    .from("vendeurs")
    .select("id, nom_boutique")
    .eq("id", vendeurId)
    .maybeSingle();
  if (!vendeur || estVendeurSacAdo(vendeurId)) return null;

  const { data: produitsRows } = await supabaseAdmin
    .from("produits")
    .select("id, nom, photo")
    .eq("vendeur_id", vendeurId);
  const produits = (produitsRows ?? []) as { id: number; nom: string; photo: string | null }[];
  const produitParId = new Map(produits.map((p) => [p.id, p]));

  const lignes = await lignesEnAttente(produits.map((p) => p.id));
  const labels = await labelsVariantes(lignes.map((l) => l.variante_id).filter((v): v is number => v != null));

  const groupesParCommande = new Map<number, GroupeClient>();
  const totaux = new Map<string, LigneTotal>();
  let nbArticles = 0;

  for (const l of lignes) {
    const produit = produitParId.get(l.produit_id);
    const commande = un(l.commande);
    const produitNom = produit?.nom ?? "Article";
    const varianteLabel = l.variante_id != null ? (labels.get(l.variante_id) ?? null) : null;

    let groupe = groupesParCommande.get(l.commande_id);
    if (!groupe) {
      groupe = {
        commandeId: l.commande_id,
        clientNom: un(commande?.client)?.nom ?? "Client",
        modeLivraison: commande?.mode_livraison ?? null,
        zoneNom: un(commande?.zone)?.nom ?? null,
        articles: [],
      };
      groupesParCommande.set(l.commande_id, groupe);
    }
    groupe.articles.push({
      produitNom,
      varianteLabel,
      produitPhoto: produit?.photo ?? null,
      quantite: l.quantite,
    });

    const cle = `${produitNom}|${varianteLabel ?? ""}`;
    const t = totaux.get(cle) ?? { produitNom, varianteLabel, quantite: 0 };
    t.quantite += l.quantite;
    totaux.set(cle, t);
    nbArticles += l.quantite;
  }

  return {
    vendeurId,
    vendeurNom: vendeur.nom_boutique,
    groupes: [...groupesParCommande.values()].sort((a, b) => a.clientNom.localeCompare(b.clientNom)),
    totaux: [...totaux.values()].sort((a, b) => a.produitNom.localeCompare(b.produitNom)),
    nbArticles,
  };
}

export async function getApercuPreparation(vendeurId: string): Promise<ApercuPreparation | null> {
  await requireAdmin();
  return construireApercu(vendeurId);
}

// --- Création d'une demande -------------------------------------------------

export async function creerDemandePreparation(
  vendeurId: string,
  note?: string,
): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const res = await creerDemandePourVendeur(vendeurId, "manuel", { note });
  return res.ok ? { ok: true, id: res.id } : { ok: false, error: res.error };
}

// L'admin marque la demande comme récupérée (livreur passé chez le fournisseur).
export async function marquerDemandeRecuperee(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("demandes_preparation")
    .update({ recuperee_le: new Date().toISOString() })
    .eq("id", id)
    .is("recuperee_le", null);
  if (error) return { ok: false, error: "Impossible d'enregistrer." };
  return { ok: true };
}

// --- Consultation des demandes ---------------------------------------------

export type DemandePreparationResume = {
  id: number;
  vendeurId: string;
  vendeurNom: string;
  statut: StatutDemandePreparation;
  declenchement: DemandePreparation["declenchement"];
  creeLe: string;
  prepareeLe: string | null;
  recupereeLe: string | null;
  nbArticles: number;
  nbClients: number;
};

export async function listerDemandesPreparation(): Promise<DemandePreparationResume[]> {
  await requireAdmin();

  const { data: demandesRows } = await supabaseAdmin
    .from("demandes_preparation")
    .select("*")
    .order("cree_le", { ascending: false })
    .limit(200);
  const demandes = (demandesRows ?? []) as DemandePreparation[];
  if (demandes.length === 0) return [];

  const ids = demandes.map((d) => d.id);
  const { data: itemsRows } = await supabaseAdmin
    .from("demande_preparation_items")
    .select("demande_id, commande_id, quantite")
    .in("demande_id", ids);
  const parDemande = new Map<number, { articles: number; commandes: Set<number> }>();
  for (const it of (itemsRows ?? []) as { demande_id: number; commande_id: number; quantite: number }[]) {
    const e = parDemande.get(it.demande_id) ?? { articles: 0, commandes: new Set<number>() };
    e.articles += it.quantite;
    e.commandes.add(it.commande_id);
    parDemande.set(it.demande_id, e);
  }

  const vendeurIds = [...new Set(demandes.map((d) => d.vendeur_id))];
  const { data: vendeursRows } = await supabaseAdmin
    .from("vendeurs")
    .select("id, nom_boutique")
    .in("id", vendeurIds);
  const nomParVendeur = new Map(
    ((vendeursRows ?? []) as { id: string; nom_boutique: string }[]).map((v) => [v.id, v.nom_boutique]),
  );

  return demandes.map((d) => {
    const e = parDemande.get(d.id);
    return {
      id: d.id,
      vendeurId: d.vendeur_id,
      vendeurNom: nomParVendeur.get(d.vendeur_id) ?? "Vendeur",
      statut: d.statut,
      declenchement: d.declenchement,
      creeLe: d.cree_le,
      prepareeLe: d.preparee_le,
      recupereeLe: d.recuperee_le ?? null,
      nbArticles: e?.articles ?? 0,
      nbClients: e?.commandes.size ?? 0,
    };
  });
}

export async function getDemandePreparation(id: number): Promise<DemandePreparationDetail | null> {
  await requireAdmin();
  return chargerBonPreparation(id);
}

export async function supprimerDemandePreparation(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("demandes_preparation").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
