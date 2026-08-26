"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Cycle, Kit } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export type KitAvecCompte = Kit & { nb_items: number };

export async function getKitsAdmin(): Promise<KitAvecCompte[]> {
  await requireAdmin();
  const { data: kits } = await supabaseAdmin
    .from("kits")
    .select("*")
    .order("cycle", { ascending: true })
    .order("niveau", { ascending: true });
  if (!kits) return [];

  const { data: items } = await supabaseAdmin.from("kit_items").select("kit_id");
  const comptes = new Map<number, number>();
  (items ?? []).forEach((item) => comptes.set(item.kit_id, (comptes.get(item.kit_id) ?? 0) + 1));

  return kits.map((kit) => ({ ...kit, nb_items: comptes.get(kit.id) ?? 0 }));
}

export async function getKitAdmin(id: number): Promise<Kit | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("kits").select("*").eq("id", id).maybeSingle();
  return data;
}

export type KitInput = { cycle: Cycle; niveau: string; nom: string };

export async function creerKit(input: KitInput): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  if (!texteNonVide(input.niveau, 50) || !texteNonVide(input.nom, 200)) {
    return { ok: false, error: "Niveau et nom sont requis." };
  }

  const { data, error } = await supabaseAdmin.from("kits").insert(input).select().single();
  if (error || !data) {
    return { ok: false, error: "Impossible de créer ce kit (cycle + niveau déjà utilisé ?)." };
  }
  return { ok: true, id: data.id };
}

export type KitItemAvecProduit = {
  id: number;
  produit_id: number;
  quantite_defaut: number;
  produit_nom: string;
  produit_prix: number;
};

export async function getKitItemsAdmin(kitId: number): Promise<KitItemAvecProduit[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("kit_items")
    .select("id, produit_id, quantite_defaut, produit:produits(nom, prix)")
    .eq("kit_id", kitId);
  if (error) return [];

  type Row = {
    id: number;
    produit_id: number;
    quantite_defaut: number;
    produit: { nom: string; prix: number } | { nom: string; prix: number }[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return rows
    .map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      if (!produit) return null;
      return {
        id: row.id,
        produit_id: row.produit_id,
        quantite_defaut: row.quantite_defaut,
        produit_nom: produit.nom,
        produit_prix: produit.prix,
      };
    })
    .filter((r): r is KitItemAvecProduit => r !== null);
}

function quantiteValide(quantite: number): boolean {
  return Number.isInteger(quantite) && quantite > 0 && quantite <= 999;
}

export async function ajouterKitItem(
  kitId: number,
  produitId: number,
  quantite: number,
): Promise<ActionResult> {
  await requireAdmin();
  if (!quantiteValide(quantite)) return { ok: false, error: "Quantité invalide." };

  const { error } = await supabaseAdmin
    .from("kit_items")
    .insert({ kit_id: kitId, produit_id: produitId, quantite_defaut: quantite });
  if (error) return { ok: false, error: "Impossible d'ajouter cet article (déjà présent ?)." };
  return { ok: true };
}

export async function modifierKitItemQuantite(id: number, quantite: number): Promise<ActionResult> {
  await requireAdmin();
  if (!quantiteValide(quantite)) return { ok: false, error: "Quantité invalide." };

  const { error } = await supabaseAdmin.from("kit_items").update({ quantite_defaut: quantite }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier la quantité." };
  return { ok: true };
}

export async function retirerKitItem(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("kit_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Impossible de retirer cet article." };
  return { ok: true };
}
