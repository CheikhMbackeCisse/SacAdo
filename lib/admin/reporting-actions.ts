"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Commande, Produit } from "@/lib/supabase/types";

export type DashboardStats = {
  caDuJour: number;
  nbCommandesDuJour: number;
  panierMoyenDuJour: number;
  topProduits: { nom: string; quantite: number }[];
  alertesStock: Produit[];
};

function debutJournee(): string {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  return debut.toISOString();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();

  const [{ data: commandesDuJour }, { data: items }, { data: produits }] = await Promise.all([
    supabaseAdmin.from("commandes").select("total").gte("date", debutJournee()),
    supabaseAdmin.from("commande_items").select("quantite, produit:produits(nom)"),
    supabaseAdmin.from("produits").select("*"),
  ]);

  const commandes = commandesDuJour ?? [];
  const caDuJour = commandes.reduce((sum, c) => sum + c.total, 0);
  const nbCommandesDuJour = commandes.length;
  const panierMoyenDuJour = nbCommandesDuJour > 0 ? Math.round(caDuJour / nbCommandesDuJour) : 0;

  type ItemRow = { quantite: number; produit: { nom: string } | { nom: string }[] | null };
  const parProduit = new Map<string, number>();
  ((items ?? []) as unknown as ItemRow[]).forEach((item) => {
    const produit = Array.isArray(item.produit) ? item.produit[0] : item.produit;
    const nom = produit?.nom ?? "Produit supprimé";
    parProduit.set(nom, (parProduit.get(nom) ?? 0) + item.quantite);
  });
  const topProduits = [...parProduit.entries()]
    .map(([nom, quantite]) => ({ nom, quantite }))
    .sort((a, b) => b.quantite - a.quantite)
    .slice(0, 5);

  const alertesStock = (produits ?? []).filter((p) => p.stock <= p.seuil_alerte);

  return { caDuJour, nbCommandesDuJour, panierMoyenDuJour, topProduits, alertesStock };
}

export type VenteAgregee = { produitId: number; nom: string; quantiteVendue: number };

export async function getArticlesVendus(): Promise<VenteAgregee[]> {
  await requireAdmin();

  const { data: items } = await supabaseAdmin
    .from("commande_items")
    .select("produit_id, quantite, produit:produits(nom)");

  type Row = { produit_id: number; quantite: number; produit: { nom: string } | { nom: string }[] | null };
  const parProduit = new Map<number, VenteAgregee>();

  ((items ?? []) as unknown as Row[]).forEach((row) => {
    const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
    const nom = produit?.nom ?? "Produit supprimé";
    const existant = parProduit.get(row.produit_id);
    if (existant) {
      existant.quantiteVendue += row.quantite;
    } else {
      parProduit.set(row.produit_id, { produitId: row.produit_id, nom, quantiteVendue: row.quantite });
    }
  });

  return [...parProduit.values()].sort((a, b) => b.quantiteVendue - a.quantiteVendue);
}

export type ClientAvecCommandes = {
  id: number;
  nom: string;
  telephone: string;
  commandes: Commande[];
  totalDepense: number;
};

export async function chercherClientParTelephone(telephone: string): Promise<ClientAvecCommandes | null> {
  await requireAdmin();

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("telephone", telephone.trim())
    .maybeSingle();
  if (!client) return null;

  const { data: commandes } = await supabaseAdmin
    .from("commandes")
    .select("*")
    .eq("client_id", client.id)
    .order("date", { ascending: false });

  const liste = commandes ?? [];
  const totalDepense = liste.reduce((sum, c) => sum + c.total, 0);

  return { id: client.id, nom: client.nom, telephone: client.telephone, commandes: liste, totalDepense };
}
