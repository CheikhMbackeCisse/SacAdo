"use server";

import { randomUUID } from "crypto";
import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estNombrePositifValide, texteNonVide } from "@/lib/admin/validation";
import { MAX_PHOTOS_PRODUIT } from "./produits-shared";
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
  // Galerie ordonnée : photos[0] = principale. 0 à 4 URLs.
  photos: string[];
  stock: number;
};

// Ne garde que des URLs http(s) non vides, dédoublonnées, plafonnées à 4.
function nettoyerPhotos(photos: string[]): string[] {
  const vues = new Set<string>();
  const propres: string[] = [];
  for (const p of photos) {
    const url = typeof p === "string" ? p.trim() : "";
    if (!/^https?:\/\//i.test(url) || vues.has(url)) continue;
    vues.add(url);
    propres.push(url);
    if (propres.length === MAX_PHOTOS_PRODUIT) break;
  }
  return propres;
}

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
  if (input.photos.length > MAX_PHOTOS_PRODUIT) {
    return `${MAX_PHOTOS_PRODUIT} photos maximum par produit.`;
  }
  return null;
}

function versColonnes(input: ProduitVendeurInput) {
  const photos = nettoyerPhotos(input.photos);
  return {
    nom: input.nom.trim(),
    description: input.description?.trim() || null,
    categorie_id: input.categorie_id,
    sous_categorie_id: input.sous_categorie_id,
    prix: Math.round(input.prix),
    delai: input.delai,
    photos,
    // Photo principale maintenue par le serveur = première de la galerie.
    photo: photos[0] ?? null,
    stock: Math.round(input.stock),
  };
}

// Retire `photos` d'un jeu de colonnes (repli si la migration 0019 n'est pas
// encore passée : Postgres renvoie 42703 « column does not exist »).
function sansColonnePhotos(colonnes: Record<string, unknown>): Record<string, unknown> {
  const reste = { ...colonnes };
  delete reste.photos;
  return reste;
}
const COLONNE_ABSENTE = "42703";

// La soumission (et chaque re-soumission) d'un produit ouvre une proposition de
// prix du vendeur : c'est le premier tour du fil de négociation. L'admin a alors
// la balle (accepter / contre-proposer / refuser).
async function ouvrirPropositionVendeur(produitId: number, prix: number): Promise<void> {
  // Toute proposition encore en_cours est dépassée par la nouvelle.
  await supabaseAdmin
    .from("negociation_propositions")
    .update({ statut: "refuse" })
    .eq("produit_id", produitId)
    .eq("statut", "en_cours");

  await supabaseAdmin.from("negociation_propositions").insert({
    produit_id: produitId,
    auteur: "vendeur",
    prix_propose: prix,
    statut: "en_cours",
  });
}

export async function creerMonProduit(
  input: ProduitVendeurInput,
): Promise<ActionResult & { id?: number }> {
  const { userId } = await requireVendeur();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const prix = Math.round(input.prix);
  const colonnes = {
    ...versColonnes(input),
    seuil_alerte: 5,
    vendeur_id: userId,
    statut_publication: "en_attente" as const,
    motif_refus: null,
  };
  let { data, error } = await supabaseAdmin
    .from("produits")
    .insert(colonnes)
    .select("id")
    .single();
  if (error?.code === COLONNE_ABSENTE) {
    ({ data, error } = await supabaseAdmin
      .from("produits")
      .insert(sansColonnePhotos(colonnes))
      .select("id")
      .single());
  }

  if (error || !data) return { ok: false, error: "Impossible d'enregistrer le produit." };

  await ouvrirPropositionVendeur(data.id, prix);
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

  const colonnes = {
    ...versColonnes(input),
    statut_publication: "en_attente" as const,
    motif_refus: null,
  };
  let { error } = await supabaseAdmin
    .from("produits")
    .update(colonnes)
    .eq("id", id)
    .eq("vendeur_id", userId);
  if (error?.code === COLONNE_ABSENTE) {
    ({ error } = await supabaseAdmin
      .from("produits")
      .update(sansColonnePhotos(colonnes))
      .eq("id", id)
      .eq("vendeur_id", userId));
  }

  if (error) return { ok: false, error: "Impossible de modifier le produit." };

  await ouvrirPropositionVendeur(id, Math.round(input.prix));
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

// Contrôle du contenu réel du fichier (AUDIT_SECURITE_3 F1) : le type MIME
// annoncé par le navigateur est falsifiable sur un appel direct. On lit les
// premiers octets ("magic bytes") pour confirmer que c'est bien un JPEG/PNG/WebP
// et refuser un fichier non-image (script, HTML, SVG…) déguisé en image.
function snifferImage(octets: Uint8Array): "jpg" | "png" | "webp" | null {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    return "jpg";
  }
  if (
    octets.length >= 8 &&
    octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47 &&
    octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a
  ) {
    return "png";
  }
  if (
    octets.length >= 12 &&
    octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46 && // "RIFF"
    octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50 // "WEBP"
  ) {
    return "webp";
  }
  return null;
}

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

  const buffer = await file.arrayBuffer();
  const typeReel = snifferImage(new Uint8Array(buffer.slice(0, 12)));
  if (!typeReel || typeReel !== ext) {
    return { ok: false, error: "Ce fichier n'est pas une image JPG, PNG ou WebP valide." };
  }

  const chemin = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("produits")
    .upload(chemin, buffer, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: "Le téléversement a échoué." };

  const { data } = supabaseAdmin.storage.from("produits").getPublicUrl(chemin);
  return { ok: true, url: data.publicUrl };
}
