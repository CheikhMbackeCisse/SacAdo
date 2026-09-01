"use server";

import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aplatirAttributs } from "@/lib/variantes";
import { estNombrePositifValide } from "@/lib/admin/validation";
import { proposerAttribut } from "@/lib/admin/attributs-actions";
import type { ActionResult } from "./produits-actions";
import type { Attribut, VarianteAvecAttributs } from "@/lib/supabase/types";

const SELECT_VARIANTE = "*, variante_attributs(attribut_id, valeur, attributs(nom))";

export type VarianteVendeurInput = {
  prix: number | null;
  stock: number;
  photo: string | null;
  attributs: { attributId: number; valeur: string }[];
};

// Le produit appartient-il au vendeur connecté ?
async function produitDuVendeur(produitId: number, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("produits")
    .select("id")
    .eq("id", produitId)
    .eq("vendeur_id", userId)
    .maybeSingle();
  return !!data;
}

// Renvoie le produit_id si la variante appartient à un produit du vendeur.
async function produitIdSiDuVendeur(
  varianteId: number,
  userId: string,
): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("produit_variantes")
    .select("produit_id, produits(vendeur_id)")
    .eq("id", varianteId)
    .maybeSingle();
  if (!data) return null;
  const rel = data.produits as { vendeur_id: string | null } | { vendeur_id: string | null }[] | null;
  const vendeurId = Array.isArray(rel) ? rel[0]?.vendeur_id : rel?.vendeur_id;
  return vendeurId === userId ? (data.produit_id as number) : null;
}

function valider(input: VarianteVendeurInput): string | null {
  const pairs = input.attributs.filter((a) => a.attributId > 0 && a.valeur.trim());
  if (pairs.length === 0) return "Ajoute au moins un attribut (ex. Couleur : Bleu).";
  const ids = pairs.map((a) => a.attributId);
  if (new Set(ids).size !== ids.length) return "Un attribut est en double.";
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (input.prix !== null && !estNombrePositifValide(input.prix)) {
    return "Le prix doit être un nombre positif.";
  }
  return null;
}

async function ecrireAttributs(
  varianteId: number,
  attributs: VarianteVendeurInput["attributs"],
): Promise<boolean> {
  await supabaseAdmin.from("variante_attributs").delete().eq("variante_id", varianteId);
  const lignes = attributs
    .filter((a) => a.attributId > 0 && a.valeur.trim())
    .map((a) => ({
      variante_id: varianteId,
      attribut_id: a.attributId,
      valeur: a.valeur.trim().slice(0, 120),
    }));
  if (lignes.length === 0) return true;
  const { error } = await supabaseAdmin.from("variante_attributs").insert(lignes);
  return !error;
}

// Attributs utilisables tout de suite (validés). Le vendeur en propose d'autres
// via proposerMonAttribut → file de validation admin.
export async function getAttributsUtilisables(): Promise<Attribut[]> {
  await requireVendeur();
  const { data } = await supabaseAdmin
    .from("attributs")
    .select("*")
    .eq("statut", "valide")
    .order("nom", { ascending: true });
  return data ?? [];
}

// Proposition d'un nouvel attribut par le vendeur (statut 'propose').
export async function proposerMonAttribut(
  nom: string,
): Promise<ActionResult & { id?: number; dejaExistant?: boolean }> {
  const { userId } = await requireVendeur();
  return proposerAttribut(nom, userId);
}

export async function getMesVariantes(produitId: number): Promise<VarianteAvecAttributs[]> {
  const { userId } = await requireVendeur();
  if (!(await produitDuVendeur(produitId, userId))) return [];

  const jointure = await supabaseAdmin
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (!jointure.error) {
    return (jointure.data ?? []).map((row) => ({ ...row, attributs: aplatirAttributs(row) }));
  }
  const { data } = await supabaseAdmin
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  return (data ?? []).map((row) => ({ ...(row as VarianteAvecAttributs), attributs: [] }));
}

export async function creerMaVariante(
  produitId: number,
  input: VarianteVendeurInput,
): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  if (!(await produitDuVendeur(produitId, userId))) {
    return { ok: false, error: "Produit introuvable." };
  }
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin
    .from("produit_variantes")
    .insert({ produit_id: produitId, prix: input.prix, stock: input.stock, photo: input.photo })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Impossible de créer la variante." };

  if (!(await ecrireAttributs(data.id, input.attributs))) {
    await supabaseAdmin.from("produit_variantes").delete().eq("id", data.id);
    return { ok: false, error: "Impossible d'enregistrer les attributs." };
  }
  return { ok: true };
}

export async function modifierMaVariante(
  varianteId: number,
  input: VarianteVendeurInput,
): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  if ((await produitIdSiDuVendeur(varianteId, userId)) === null) {
    return { ok: false, error: "Variante introuvable." };
  }
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("produit_variantes")
    .update({ prix: input.prix, stock: input.stock, photo: input.photo })
    .eq("id", varianteId);
  if (error) return { ok: false, error: "Impossible de modifier la variante." };

  if (!(await ecrireAttributs(varianteId, input.attributs))) {
    return { ok: false, error: "Impossible d'enregistrer les attributs." };
  }
  return { ok: true };
}

export async function supprimerMaVariante(varianteId: number): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  if ((await produitIdSiDuVendeur(varianteId, userId)) === null) {
    return { ok: false, error: "Variante introuvable." };
  }
  const { error } = await supabaseAdmin
    .from("produit_variantes")
    .delete()
    .eq("id", varianteId);
  if (error) {
    return { ok: false, error: "Impossible : cette variante est référencée par une commande." };
  }
  return { ok: true };
}
