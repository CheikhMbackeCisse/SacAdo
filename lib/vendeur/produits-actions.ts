"use server";

import { randomUUID } from "crypto";
import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estNombrePositifValide, texteNonVide } from "@/lib/admin/validation";
import type { Categorie, Commission, Delai, Produit, SousCategorie } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Référentiel catégories + sous-catégories (lecture publique, mais on passe par
// service_role pour rester cohérent avec le reste de l'espace vendeur).
export async function getReferentiel(): Promise<{
  categories: Categorie[];
  sousCategories: SousCategorie[];
  commissions: Commission[];
}> {
  await requireVendeur();
  const [cats, sousCats, commissions] = await Promise.all([
    supabaseAdmin.from("categories").select("*").eq("actif", true).order("ordre").order("nom"),
    supabaseAdmin.from("sous_categories").select("*").order("ordre").order("nom"),
    supabaseAdmin.from("commissions").select("*"),
  ]);
  return {
    categories: cats.data ?? [],
    sousCategories: sousCats.data ?? [],
    commissions: commissions.data ?? [],
  };
}

export async function getMesProduits(): Promise<Produit[]> {
  const { userId } = await requireVendeur();
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .eq("vendeur_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMonProduit(id: number): Promise<Produit | null> {
  const { userId } = await requireVendeur();
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .eq("id", id)
    .eq("vendeur_id", userId)
    .maybeSingle();
  return data;
}

export type ProduitVendeurInput = {
  nom: string;
  description: string | null;
  categorie_id: number;
  sous_categorie_id: number | null;
  prix: number;
  delai: Delai;
  photo: string | null;
  stock: number;
};

function valider(input: ProduitVendeurInput): string | null {
  if (!texteNonVide(input.nom, 200)) return "Le nom est requis.";
  if (!Number.isInteger(input.categorie_id) || input.categorie_id <= 0) {
    return "La catégorie est requise.";
  }
  if (input.sous_categorie_id !== null && !Number.isInteger(input.sous_categorie_id)) {
    return "Sous-catégorie invalide.";
  }
  if (!estNombrePositifValide(input.prix) || input.prix === 0) {
    return "Le prix doit être un nombre positif.";
  }
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (input.description !== null && input.description.length > 2000) {
    return "La description est trop longue (2000 caractères maximum).";
  }
  return null;
}

function versColonnes(input: ProduitVendeurInput) {
  return {
    nom: input.nom.trim(),
    description: input.description?.trim() || null,
    categorie_id: input.categorie_id,
    sous_categorie_id: input.sous_categorie_id,
    prix: Math.round(input.prix),
    delai: input.delai,
    photo: input.photo?.trim() || null,
    stock: Math.round(input.stock),
  };
}

export async function creerMonProduit(
  input: ProduitVendeurInput,
): Promise<ActionResult & { id?: number }> {
  const { userId } = await requireVendeur();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin
    .from("produits")
    .insert({
      ...versColonnes(input),
      seuil_alerte: 5,
      vendeur_id: userId,
      statut_publication: "en_attente",
      motif_refus: null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Impossible d'enregistrer le produit." };
  return { ok: true, id: data.id };
}

// Toute modification de fond repasse le produit en file de modération.
export async function modifierMonProduit(
  id: number,
  input: ProduitVendeurInput,
): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("produits")
    .update({
      ...versColonnes(input),
      statut_publication: "en_attente",
      motif_refus: null,
    })
    .eq("id", id)
    .eq("vendeur_id", userId);

  if (error) return { ok: false, error: "Impossible de modifier le produit." };
  return { ok: true };
}

// Mise à jour du stock seule : ne renvoie pas le produit en modération.
export async function mettreAJourStock(id: number, stock: number): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  if (!estNombrePositifValide(stock)) return { ok: false, error: "Stock invalide." };

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ stock: Math.round(stock) })
    .eq("id", id)
    .eq("vendeur_id", userId);

  if (error) return { ok: false, error: "Impossible de mettre à jour le stock." };
  return { ok: true };
}

export async function supprimerMonProduit(id: number): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  const { error } = await supabaseAdmin
    .from("produits")
    .delete()
    .eq("id", id)
    .eq("vendeur_id", userId);

  if (error) {
    return { ok: false, error: "Suppression impossible : ce produit est lié à une commande." };
  }
  return { ok: true };
}

const TYPES_IMAGE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TAILLE_MAX_PHOTO = 3 * 1024 * 1024; // 3 Mo

export async function televerserPhoto(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { userId } = await requireVendeur();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier reçu." };
  }
  if (file.size > TAILLE_MAX_PHOTO) {
    return { ok: false, error: "Image trop lourde (3 Mo maximum)." };
  }
  const ext = TYPES_IMAGE[file.type];
  if (!ext) return { ok: false, error: "Format accepté : JPG, PNG ou WebP." };

  const chemin = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("produits")
    .upload(chemin, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: "Le téléversement a échoué." };

  const { data } = supabaseAdmin.storage.from("produits").getPublicUrl(chemin);
  return { ok: true, url: data.publicUrl };
}
