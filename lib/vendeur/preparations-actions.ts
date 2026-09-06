"use server";

import { revalidatePath } from "next/cache";
import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chargerBonPreparation } from "@/lib/preparation-bon";
import type { DemandePreparation } from "@/lib/supabase/types";
import type { DemandePreparationDetail } from "@/lib/preparations";

export type MaPreparationResume = {
  id: number;
  statut: DemandePreparation["statut"];
  creeLe: string;
  prepareeLe: string | null;
  recupereeLe: string | null;
  nbArticles: number;
  nbClients: number;
};

export async function getMesPreparations(): Promise<MaPreparationResume[]> {
  const { userId } = await requireVendeur();

  const { data: demandesRows } = await supabaseAdmin
    .from("demandes_preparation")
    .select("*")
    .eq("vendeur_id", userId)
    .order("cree_le", { ascending: false })
    .limit(100);
  const demandes = (demandesRows ?? []) as DemandePreparation[];
  if (demandes.length === 0) return [];

  const { data: itemsRows } = await supabaseAdmin
    .from("demande_preparation_items")
    .select("demande_id, commande_id, quantite")
    .in(
      "demande_id",
      demandes.map((d) => d.id),
    );
  const parDemande = new Map<number, { articles: number; commandes: Set<number> }>();
  for (const it of (itemsRows ?? []) as { demande_id: number; commande_id: number; quantite: number }[]) {
    const e = parDemande.get(it.demande_id) ?? { articles: 0, commandes: new Set<number>() };
    e.articles += it.quantite;
    e.commandes.add(it.commande_id);
    parDemande.set(it.demande_id, e);
  }

  return demandes.map((d) => {
    const e = parDemande.get(d.id);
    return {
      id: d.id,
      statut: d.statut,
      creeLe: d.cree_le,
      prepareeLe: d.preparee_le,
      recupereeLe: d.recuperee_le ?? null,
      nbArticles: e?.articles ?? 0,
      nbClients: e?.commandes.size ?? 0,
    };
  });
}

export async function getNbPreparationsAPreparer(): Promise<number> {
  const { userId } = await requireVendeur();
  const { count, error } = await supabaseAdmin
    .from("demandes_preparation")
    .select("id", { count: "exact", head: true })
    .eq("vendeur_id", userId)
    .eq("statut", "a_preparer");
  return error ? 0 : (count ?? 0);
}

// Vérifie que la demande appartient bien au vendeur connecté.
async function demandeDuVendeur(id: number, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("demandes_preparation")
    .select("vendeur_id")
    .eq("id", id)
    .maybeSingle();
  return (data as { vendeur_id: string } | null)?.vendeur_id === userId;
}

export async function getMaPreparation(id: number): Promise<DemandePreparationDetail | null> {
  const { userId } = await requireVendeur();
  if (!(await demandeDuVendeur(id, userId))) return null;
  return chargerBonPreparation(id);
}

export type PreparationActionResult = { ok: true } | { ok: false; error: string };

export async function marquerMaPreparationPrete(id: number): Promise<PreparationActionResult> {
  const { userId } = await requireVendeur();
  if (!(await demandeDuVendeur(id, userId))) {
    return { ok: false, error: "Demande introuvable." };
  }

  const { error } = await supabaseAdmin
    .from("demandes_preparation")
    .update({ statut: "preparee", preparee_le: new Date().toISOString() })
    .eq("id", id)
    .eq("vendeur_id", userId)
    .neq("statut", "preparee");
  if (error) return { ok: false, error: "Impossible d'enregistrer. Réessaie." };

  revalidatePath("/vendeur/preparations");
  revalidatePath(`/vendeur/preparations/${id}`);
  revalidatePath("/admin/preparations");
  revalidatePath(`/admin/preparations/${id}`);
  return { ok: true };
}
