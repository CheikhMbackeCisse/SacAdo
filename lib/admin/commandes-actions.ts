"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Commande, CommandeItem, StatutCommande } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export type CommandeAvecClient = Commande & { client_nom: string; client_telephone: string };

type ClientJoint = { nom: string; telephone: string } | { nom: string; telephone: string }[] | null;

function mapCommandeRow(row: Commande & { client: ClientJoint }): CommandeAvecClient {
  const client = Array.isArray(row.client) ? row.client[0] : row.client;
  return {
    id: row.id,
    client_id: row.client_id,
    zone_id: row.zone_id,
    adresse: row.adresse,
    mode_livraison: row.mode_livraison,
    frais_livraison: row.frais_livraison,
    mode_paiement: row.mode_paiement,
    sous_total: row.sous_total,
    total: row.total,
    statut: row.statut,
    date: row.date,
    client_reference: row.client_reference,
    enfants_ebook: row.enfants_ebook,
    client_nom: client?.nom ?? "—",
    client_telephone: client?.telephone ?? "—",
  };
}

const TAILLE_PAGE_COMMANDES = 50;

// Liste paginée : utilisée par /admin/commandes pour ne pas charger tout
// l'historique d'un coup quand le volume de commandes grossit.
export async function getCommandesAdmin(
  statut?: StatutCommande,
  { offset = 0, limit = TAILLE_PAGE_COMMANDES }: { offset?: number; limit?: number } = {},
): Promise<{ items: CommandeAvecClient[]; hasMore: boolean }> {
  await requireAdmin();

  let query = supabaseAdmin
    .from("commandes")
    .select("*, client:clients(nom, telephone)")
    .order("date", { ascending: false })
    .range(offset, offset + limit);
  if (statut) query = query.eq("statut", statut);

  const { data, error } = await query;
  if (error) return { items: [], hasMore: false };

  const rows = (data ?? []) as unknown as (Commande & { client: ClientJoint })[];
  const hasMore = rows.length > limit;
  return { items: (hasMore ? rows.slice(0, limit) : rows).map(mapCommandeRow), hasMore };
}

export async function getCommandeAdmin(id: number): Promise<CommandeAvecClient | null> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("commandes")
    .select("*, client:clients(nom, telephone)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCommandeRow(data as unknown as Commande & { client: ClientJoint });
}

export async function changerStatutCommande(id: number, statut: StatutCommande): Promise<ActionResult> {
  await requireAdmin();
  // Le trigger DB (Lot 1) insère automatiquement le message de suivi côté client.
  const { error } = await supabaseAdmin.from("commandes").update({ statut }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer le statut." };
  return { ok: true };
}

export type CommandeItemAvecProduit = CommandeItem & { produit_nom: string };

export async function getCommandeItemsAdmin(commandeId: number): Promise<CommandeItemAvecProduit[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("commande_items")
    .select("*, produit:produits(nom)")
    .eq("commande_id", commandeId);
  if (error) return [];

  type Row = CommandeItem & { produit: { nom: string } | { nom: string }[] | null };
  const rows = (data ?? []) as unknown as Row[];

  return rows.map((row) => {
    const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
    return {
      id: row.id,
      commande_id: row.commande_id,
      produit_id: row.produit_id,
      variante_id: row.variante_id,
      quantite: row.quantite,
      prix_unitaire: row.prix_unitaire,
      produit_nom: produit?.nom ?? "Produit supprimé",
    };
  });
}
