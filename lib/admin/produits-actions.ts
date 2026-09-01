"use server";

import { requireAdmin } from "./guard";
import { estNombrePositifValide, texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aplatirAttributs } from "@/lib/variantes";
import type { Delai, Produit, StatutProduit, VarianteAvecAttributs } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type PageAdmin<T> = { items: T[]; hasMore: boolean };

const TAILLE_PAGE_ADMIN = 50;

// Liste complète : utilisée pour le sélecteur "ajouter un article" d'un kit,
// où on a besoin de chercher parmi tous les produits. À revoir si le
// catalogue grossit beaucoup (passer à une recherche paginée côté serveur).
export async function getProduitsAdmin(): Promise<Produit[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("produits").select("*").order("nom", { ascending: true });
  return data ?? [];
}

// Liste paginée : utilisée par l'écran /admin/produits pour ne pas charger
// tout le catalogue d'un coup quand il grossit.
export async function getProduitsAdminPage(
  { offset = 0, limit = TAILLE_PAGE_ADMIN }: { offset?: number; limit?: number } = {},
): Promise<PageAdmin<Produit>> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export async function getProduitAdmin(id: number): Promise<Produit | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("produits").select("*").eq("id", id).maybeSingle();
  return data;
}

export type ProduitInput = {
  nom: string;
  categorie_id: number;
  sous_categorie_id: number | null;
  prix: number;
  delai: Delai;
  photo: string | null;
  stock: number;
  seuil_alerte: number;
  statut: StatutProduit;
};

function validerProduitInput(input: ProduitInput): string | null {
  if (!texteNonVide(input.nom, 200)) return "Le nom est requis.";
  if (!Number.isInteger(input.categorie_id)) return "La catégorie est requise.";
  if (input.sous_categorie_id !== null && !Number.isInteger(input.sous_categorie_id)) {
    return "Sous-catégorie invalide.";
  }
  if (!estNombrePositifValide(input.prix)) return "Le prix doit être un nombre positif.";
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (!estNombrePositifValide(input.seuil_alerte)) return "Le seuil d'alerte doit être un nombre positif.";
  return null;
}

export async function creerProduit(input: ProduitInput): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const erreur = validerProduitInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin.from("produits").insert(input).select().single();
  if (error || !data) return { ok: false, error: "Impossible de créer le produit." };
  return { ok: true, id: data.id };
}

export async function modifierProduit(id: number, input: ProduitInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerProduitInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("produits").update(input).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier le produit." };
  return { ok: true };
}

export async function supprimerProduit(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("produits").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "Impossible de supprimer : ce produit est utilisé dans une commande ou un kit.",
    };
  }
  return { ok: true };
}

const SELECT_VARIANTE_ADMIN = "*, variante_attributs(attribut_id, valeur, attributs(nom))";

export async function getVariantesAdmin(produitId: number): Promise<VarianteAvecAttributs[]> {
  await requireAdmin();
  const jointure = await supabaseAdmin
    .from("produit_variantes")
    .select(SELECT_VARIANTE_ADMIN)
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (!jointure.error) {
    return (jointure.data ?? []).map((row) => ({ ...row, attributs: aplatirAttributs(row) }));
  }
  // Repli si `variante_attributs` n'existe pas encore (migration 0022).
  const { data } = await supabaseAdmin
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  return (data ?? []).map((row) => ({ ...(row as VarianteAvecAttributs), attributs: [] }));
}

export type VarianteInput = {
  prix: number | null;
  stock: number;
  photo: string | null;
  // Au moins une paire attribut/valeur (Couleur=Bleu, Taille=M...).
  attributs: { attributId: number; valeur: string }[];
};

function validerVarianteInput(input: VarianteInput): string | null {
  const valides = input.attributs.filter((a) => a.attributId > 0 && a.valeur.trim());
  if (valides.length === 0) return "Ajoute au moins un attribut (ex. Couleur : Bleu).";
  const ids = valides.map((a) => a.attributId);
  if (new Set(ids).size !== ids.length) return "Un attribut est en double.";
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (input.prix !== null && !estNombrePositifValide(input.prix)) {
    return "Le prix doit être un nombre positif.";
  }
  return null;
}

async function ecrireAttributsVariante(
  varianteId: number,
  attributs: VarianteInput["attributs"],
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

export async function creerVariante(produitId: number, input: VarianteInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerVarianteInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin
    .from("produit_variantes")
    .insert({ produit_id: produitId, prix: input.prix, stock: input.stock, photo: input.photo })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Impossible de créer la variante." };

  if (!(await ecrireAttributsVariante(data.id, input.attributs))) {
    await supabaseAdmin.from("produit_variantes").delete().eq("id", data.id);
    return { ok: false, error: "Impossible d'enregistrer les attributs de la variante." };
  }
  return { ok: true };
}

export async function modifierVariante(id: number, input: VarianteInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerVarianteInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("produit_variantes")
    .update({ prix: input.prix, stock: input.stock, photo: input.photo })
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier la variante." };

  if (!(await ecrireAttributsVariante(id, input.attributs))) {
    return { ok: false, error: "Impossible d'enregistrer les attributs de la variante." };
  }
  return { ok: true };
}

export async function supprimerVariante(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("produit_variantes").delete().eq("id", id);
  if (error) {
    return { ok: false, error: "Impossible de supprimer : cette variante est référencée par une commande." };
  }
  return { ok: true };
}
