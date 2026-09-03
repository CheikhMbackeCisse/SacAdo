"use server";

import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUT_EN_ATTENTE_PAIEMENT } from "@/lib/commandes";
import type { StatutCommande } from "@/lib/supabase/types";

export type LigneVente = {
  commande_id: number;
  date: string;
  statut_commande: StatutCommande;
  produit_id: number;
  produit_nom: string;
  quantite: number;
  montant: number;
};

export type RecapVentes = {
  lignes: LigneVente[];
  totalQuantite: number;
  totalMontant: number;
  // Commission SacAdo / net vendeur : calculés au Lot 4 (règles par catégorie).
};

// Ventes brutes du vendeur : jointure commande_items -> produits (les miens).
// Pas encore de commission ni de reversement — Lot 4.
export async function getMesVentes(): Promise<RecapVentes> {
  const { userId } = await requireVendeur();

  const { data: mesProduits } = await supabaseAdmin
    .from("produits")
    .select("id, nom")
    .eq("vendeur_id", userId);

  const ids = (mesProduits ?? []).map((p) => p.id);
  if (ids.length === 0) return { lignes: [], totalQuantite: 0, totalMontant: 0 };

  const nomParId = new Map((mesProduits ?? []).map((p) => [p.id, p.nom as string]));

  // !inner + filtre : on exclut les commandes Wave pas encore payées.
  const { data: items } = await supabaseAdmin
    .from("commande_items")
    .select("commande_id, produit_id, quantite, prix_unitaire, commandes!inner(date, statut)")
    .in("produit_id", ids)
    .neq("commandes.statut", STATUT_EN_ATTENTE_PAIEMENT)
    .order("commande_id", { ascending: false });

  type Row = {
    commande_id: number;
    produit_id: number;
    quantite: number;
    prix_unitaire: number;
    commandes: { date: string; statut: StatutCommande } | { date: string; statut: StatutCommande }[] | null;
  };

  const lignes: LigneVente[] = ((items ?? []) as unknown as Row[]).map((row) => {
    const commande = Array.isArray(row.commandes) ? row.commandes[0] : row.commandes;
    return {
      commande_id: row.commande_id,
      date: commande?.date ?? "",
      statut_commande: commande?.statut ?? "recue",
      produit_id: row.produit_id,
      produit_nom: nomParId.get(row.produit_id) ?? "—",
      quantite: row.quantite,
      montant: row.quantite * row.prix_unitaire,
    };
  });

  return {
    lignes,
    totalQuantite: lignes.reduce((s, l) => s + l.quantite, 0),
    totalMontant: lignes.reduce((s, l) => s + l.montant, 0),
  };
}
