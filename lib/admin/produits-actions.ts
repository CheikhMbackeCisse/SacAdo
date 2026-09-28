"use server";

import { randomUUID } from "crypto";
import { requireAdmin } from "./guard";
import { estNombrePositifValide, texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aplatirAttributs } from "@/lib/variantes";
import { VENDEUR_SACADO_ID } from "@/lib/vendeurs/constants";
import { TYPES_IMAGE, TAILLE_MAX_PHOTO, snifferImage } from "@/lib/images/sniff";
import type { Delai, Produit, StatutProduit, StatutPublication, VarianteAvecAttributs } from "@/lib/supabase/types";

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

export type TriProduitsAdmin = "nom" | "prix" | "stock" | "date";
export type FiltresProduitsAdmin = {
  q?: string;
  categorieId?: number;
  sousCategorieId?: number;
  vendeurId?: string | "sacado";
  statutPublication?: StatutPublication;
  stock?: "rupture" | "en_stock";
  sansImage?: boolean;
  sansSousCategorie?: boolean;
  tri?: TriProduitsAdmin;
};

// Liste paginée et filtrée : utilisée par l'écran /admin/produits pour ne
// jamais charger tout le catalogue d'un coup. Une seule requête Supabase
// (le texte de recherche passe par `recherche_texte`, déjà indexé en gin_trgm
// pour la recherche client — migration 0041/0094).
export async function getProduitsAdminPage(
  { offset = 0, limit = TAILLE_PAGE_ADMIN }: { offset?: number; limit?: number } = {},
  filtres: FiltresProduitsAdmin = {},
): Promise<PageAdmin<Produit>> {
  await requireAdmin();
  let query = supabaseAdmin.from("produits").select("*");

  if (filtres.q && filtres.q.trim()) {
    const { data: normalise } = await supabaseAdmin.rpc("normaliser_recherche", { texte: filtres.q.trim() });
    const mots = (normalise ?? filtres.q.trim().toLowerCase()).split(/\s+/).filter(Boolean);
    for (const mot of mots) {
      query = query.ilike("recherche_texte", `%${mot}%`);
    }
  }
  if (filtres.categorieId) query = query.eq("categorie_id", filtres.categorieId);
  if (filtres.sousCategorieId) query = query.eq("sous_categorie_id", filtres.sousCategorieId);
  if (filtres.vendeurId === "sacado") query = query.eq("vendeur_id", VENDEUR_SACADO_ID);
  else if (filtres.vendeurId) query = query.eq("vendeur_id", filtres.vendeurId);
  if (filtres.statutPublication) query = query.eq("statut_publication", filtres.statutPublication);
  if (filtres.stock === "rupture") query = query.eq("statut", "epuise");
  else if (filtres.stock === "en_stock") query = query.neq("statut", "epuise");
  if (filtres.sansImage) query = query.is("photo", null);
  if (filtres.sansSousCategorie) query = query.is("sous_categorie_id", null);

  const colonneTri: Record<TriProduitsAdmin, string> = {
    nom: "nom",
    prix: "prix",
    stock: "stock",
    date: "created_at",
  };
  const tri = filtres.tri ?? "nom";
  query = query
    .order(colonneTri[tri], { ascending: tri !== "date" })
    .range(offset, offset + limit);

  const { data } = await query;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

// Nombre de kits qui utilisent chaque produit de la page affichée (pour la
// colonne « kits »). Une seule requête groupée par ids, pas une par ligne.
export async function getNbKitsParProduit(produitIds: number[]): Promise<Map<number, number>> {
  await requireAdmin();
  const compte = new Map<number, number>();
  if (produitIds.length === 0) return compte;
  const { data } = await supabaseAdmin.from("kit_items").select("produit_id").in("produit_id", produitIds);
  for (const row of data ?? []) {
    compte.set(row.produit_id, (compte.get(row.produit_id) ?? 0) + 1);
  }
  return compte;
}

// Édition rapide en ligne (prix de vente + stock), sans ouvrir la fiche
// complète. Reste séparé de `modifierProduit` pour ne pas exiger tous les
// champs obligatoires du formulaire complet.
export async function modifierPrixStock(
  id: number,
  { prix, stock }: { prix: number; stock: number },
): Promise<ActionResult> {
  await requireAdmin();
  if (!estNombrePositifValide(prix)) return { ok: false, error: "Le prix doit être un nombre positif." };
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: "Le stock doit être un entier positif." };
  const { error } = await supabaseAdmin.from("produits").update({ prix, stock }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Vendeurs à proposer dans le filtre : uniquement ceux qui ont au moins un
// produit (inutile de lister toute la table `vendeurs`).
export async function getVendeursPourFiltre(): Promise<{ id: string; nom: string }[]> {
  await requireAdmin();
  const { data: produits } = await supabaseAdmin
    .from("produits")
    .select("vendeur_id")
    .not("vendeur_id", "is", null);
  const ids = [...new Set((produits ?? []).map((p) => p.vendeur_id as string).filter((id) => id !== VENDEUR_SACADO_ID))];
  if (ids.length === 0) return [];
  const { data: vendeurs } = await supabaseAdmin.from("vendeurs").select("id, nom_boutique").in("id", ids);
  return (vendeurs ?? [])
    .map((v) => ({ id: v.id, nom: v.nom_boutique }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
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
  // 3e niveau, optionnel (SOUS_SOUS_CATEGORIES.md). Renseigné seulement si la
  // sous-catégorie choisie en propose.
  sous_sous_categorie_id: number | null;
  prix: number;
  // Prix d'achat FCFA (migration 0046) : facultatif. Sert à la composante
  // « marge » du score de classement. null = coût inconnu (neutre).
  prix_achat: number | null;
  delai: Delai;
  photo: string | null;
  // Galerie ordonnée (migration 0019), jusqu'à 4 photos. `photo` doit rester
  // synchronisé à `photos[0]` par l'appelant (comme côté vendeur).
  photos: string[];
  stock: number;
  seuil_alerte: number;
  statut: StatutProduit;
  // Mots-clés de recherche (migration 0041). Le trigger `maj_index_recherche`
  // les recopie dans `recherche_texte` : un produit devient trouvable par ces
  // mots sans que sa désignation change.
  mots_cles: string | null;
  // Guide des tailles (migration 0069) : affiche le tableau standard sur la fiche.
  guide_tailles: boolean;
  // Mise en avant sur l'accueil (migration 0097).
  mise_en_avant: boolean;
};

const LONGUEUR_MAX_MOTS_CLES = 500;

function validerProduitInput(input: ProduitInput): string | null {
  if (!texteNonVide(input.nom, 200)) return "Le nom est requis.";
  if (!Number.isInteger(input.categorie_id)) return "La catégorie est requise.";
  if (input.sous_categorie_id !== null && !Number.isInteger(input.sous_categorie_id)) {
    return "Sous-catégorie invalide.";
  }
  if (input.sous_sous_categorie_id !== null && !Number.isInteger(input.sous_sous_categorie_id)) {
    return "Sous-sous-catégorie invalide.";
  }
  if (!estNombrePositifValide(input.prix)) return "Le prix doit être un nombre positif.";
  if (input.prix_achat !== null && !estNombrePositifValide(input.prix_achat)) {
    return "Le prix d'achat doit être un nombre positif.";
  }
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (!estNombrePositifValide(input.seuil_alerte)) return "Le seuil d'alerte doit être un nombre positif.";
  if (input.mots_cles !== null && input.mots_cles.length > LONGUEUR_MAX_MOTS_CLES) {
    return `Les mots-clés font au plus ${LONGUEUR_MAX_MOTS_CLES} caractères.`;
  }
  return null;
}

// Postgres 42703 = « column does not exist » : repli tant que la migration 0030
// (colonne sous_sous_categorie_id) n'est pas passée en prod.
const COLONNE_ABSENTE = "42703";
// Postgres 23503 = violation de clé étrangère : repli tant que la migration 0036
// (vendeur « SacAdo ») n'est pas passée en prod.
const FK_ABSENTE = "23503";
function sansSousSousCategorie(input: ProduitInput): Omit<ProduitInput, "sous_sous_categorie_id"> {
  const reste: Partial<ProduitInput> = { ...input };
  delete reste.sous_sous_categorie_id;
  return reste as Omit<ProduitInput, "sous_sous_categorie_id">;
}

// Repli tant que la migration 0069 (colonne guide_tailles) n'est pas passée en prod.
function sansGuideTailles<T extends { guide_tailles?: boolean }>(input: T): Omit<T, "guide_tailles"> {
  const reste: Partial<T> = { ...input };
  delete reste.guide_tailles;
  return reste as Omit<T, "guide_tailles">;
}

// Repli tant que la migration 0097 (colonne mise_en_avant) n'est pas passée en prod.
function sansMiseEnAvant<T extends { mise_en_avant?: boolean }>(input: T): Omit<T, "mise_en_avant"> {
  const reste: Partial<T> = { ...input };
  delete reste.mise_en_avant;
  return reste as Omit<T, "mise_en_avant">;
}

export async function creerProduit(input: ProduitInput): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const erreur = validerProduitInput(input);
  if (erreur) return { ok: false, error: erreur };

  // Produit publié par l'admin : rattaché au vendeur « SacAdo », en ligne direct.
  const avecVendeur = { ...input, vendeur_id: VENDEUR_SACADO_ID, publie_par: "admin" as const };

  let { data, error } = await supabaseAdmin.from("produits").insert(avecVendeur).select().single();
  if (error?.code === COLONNE_ABSENTE || error?.code === FK_ABSENTE) {
    // Migration 0036 pas encore passée : on retombe sur l'ancien comportement.
    ({ data, error } = await supabaseAdmin.from("produits").insert(input).select().single());
  }
  if (error?.code === COLONNE_ABSENTE) {
    ({ data, error } = await supabaseAdmin
      .from("produits")
      .insert(sansSousSousCategorie(input))
      .select()
      .single());
  }
  if (error?.code === COLONNE_ABSENTE) {
    ({ data, error } = await supabaseAdmin
      .from("produits")
      .insert(sansGuideTailles(sansSousSousCategorie(input)))
      .select()
      .single());
  }
  if (error?.code === COLONNE_ABSENTE) {
    ({ data, error } = await supabaseAdmin
      .from("produits")
      .insert(sansMiseEnAvant(sansGuideTailles(sansSousSousCategorie(input))))
      .select()
      .single());
  }
  if (error || !data) return { ok: false, error: "Impossible de créer le produit." };
  return { ok: true, id: data.id };
}

export async function modifierProduit(id: number, input: ProduitInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerProduitInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data: avant } = await supabaseAdmin.from("produits").select("prix").eq("id", id).maybeSingle();

  let { error } = await supabaseAdmin.from("produits").update(input).eq("id", id);
  if (error?.code === COLONNE_ABSENTE) {
    ({ error } = await supabaseAdmin
      .from("produits")
      .update(sansSousSousCategorie(input))
      .eq("id", id));
  }
  if (error?.code === COLONNE_ABSENTE) {
    ({ error } = await supabaseAdmin
      .from("produits")
      .update(sansGuideTailles(sansSousSousCategorie(input)))
      .eq("id", id));
  }
  if (error?.code === COLONNE_ABSENTE) {
    ({ error } = await supabaseAdmin
      .from("produits")
      .update(sansMiseEnAvant(sansGuideTailles(sansSousSousCategorie(input))))
      .eq("id", id));
  }
  if (error) return { ok: false, error: "Impossible de modifier le produit." };
  if (avant && avant.prix !== input.prix) await enregistrerHistoriquePrix(id, avant.prix, input.prix);
  return { ok: true };
}

// N'échoue jamais la modification en cours si la table (migration 0097)
// n'existe pas encore.
async function enregistrerHistoriquePrix(produitId: number, ancienPrix: number, nouveauPrix: number) {
  await supabaseAdmin
    .from("historique_prix_produits")
    .insert({ produit_id: produitId, ancien_prix: ancienPrix, nouveau_prix: nouveauPrix });
}

export async function getHistoriquePrix(
  produitId: number,
): Promise<{ ancien_prix: number; nouveau_prix: number; modifie_le: string }[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("historique_prix_produits")
    .select("ancien_prix, nouveau_prix, modifie_le")
    .eq("produit_id", produitId)
    .order("modifie_le", { ascending: false })
    .limit(20);
  return data ?? [];
}

// Téléversement de photo côté admin (équivalent de `televerserPhoto` côté
// vendeur, lib/vendeur/produits-actions.ts) : même bucket "produits", même
// contrôle de type par signature de fichier (F1, audit sécurité #3).
export async function televerserPhotoAdmin(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (file.size > TAILLE_MAX_PHOTO) return { ok: false, error: "Image trop lourde (3 Mo maximum)." };
  const ext = TYPES_IMAGE[file.type];
  if (!ext) return { ok: false, error: "Format accepté : JPG, PNG ou WebP." };

  const buffer = await file.arrayBuffer();
  const typeReel = snifferImage(new Uint8Array(buffer.slice(0, 12)));
  if (!typeReel || typeReel !== ext) {
    return { ok: false, error: "Ce fichier n'est pas une image JPG, PNG ou WebP valide." };
  }

  const chemin = `admin/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("produits")
    .upload(chemin, buffer, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Le téléversement a échoué." };

  const { data } = supabaseAdmin.storage.from("produits").getPublicUrl(chemin);
  return { ok: true, url: data.publicUrl };
}

// Publication d'un produit géré par l'admin (import fournisseur, catalogue
// SacAdo en propre). Distinct du circuit marketplace (negociation-actions.ts,
// statuts 'negociation'/'refuse') : ici on bascule seulement entre
// 'en_attente' et 'publie'. Garde-fous TACHE_yuupee_integration_complete.md §7 :
// jamais de photo manquante, de prix manquant, ni de prix_a_verifier actif.
// Pas de garde sur `unite_vente` : PROMPT_integration_LPD.md (version corrigée)
// fixe cette valeur à 'unite' pour tout le catalogue LPD — décision commerciale,
// pas une donnée manquante — et précise explicitement qu'elle ne doit jamais
// bloquer la publication.
export async function basculerPublication(id: number, publier: boolean): Promise<ActionResult> {
  await requireAdmin();

  if (publier) {
    const { data: produit } = await supabaseAdmin
      .from("produits")
      .select("photo, prix, prix_a_verifier")
      .eq("id", id)
      .maybeSingle();
    if (!produit) return { ok: false, error: "Produit introuvable." };
    if (!produit.photo) return { ok: false, error: "Impossible de publier : aucune photo." };
    if (!estNombrePositifValide(produit.prix)) return { ok: false, error: "Impossible de publier : prix invalide." };
    if (produit.prix_a_verifier) {
      return { ok: false, error: "Impossible de publier : prix à vérifier (voir /admin/prix-a-verifier)." };
    }
  }

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: publier ? "publie" : "en_attente" })
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer le statut de publication." };
  return { ok: true };
}

export async function basculerMiseEnAvant(id: number, miseEnAvant: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("produits").update({ mise_en_avant: miseEnAvant }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer la mise en avant." };
  return { ok: true };
}

// --- Actions en masse (ADMIN.md Lot 1) ---------------------------------

export type ActionMasse =
  | { type: "prix_montant"; montant: number }
  | { type: "prix_pourcentage"; pourcentage: number }
  | { type: "publier" }
  | { type: "masquer" }
  | { type: "categorie"; categorieId: number; sousCategorieId: number | null };

export async function appliquerActionMasse(
  produitIds: number[],
  action: ActionMasse,
): Promise<ActionResult & { nb?: number }> {
  await requireAdmin();
  if (produitIds.length === 0) return { ok: false, error: "Aucun produit sélectionné." };

  if (action.type === "publier" || action.type === "masquer") {
    const { error } = await supabaseAdmin
      .from("produits")
      .update({ statut_publication: action.type === "publier" ? "publie" : "en_attente" })
      .in("id", produitIds);
    if (error) return { ok: false, error: "Impossible de changer la publication." };
    return { ok: true, nb: produitIds.length };
  }

  if (action.type === "categorie") {
    const { error } = await supabaseAdmin
      .from("produits")
      .update({ categorie_id: action.categorieId, sous_categorie_id: action.sousCategorieId })
      .in("id", produitIds);
    if (error) return { ok: false, error: "Impossible de changer la catégorie." };
    return { ok: true, nb: produitIds.length };
  }

  // Changement de prix : lu-modifié-écrit par produit (le montant/pourcentage
  // s'applique au prix courant de chacun, qui diffère d'un produit à l'autre),
  // avec trace dans l'historique des prix comme pour une modification simple.
  const { data: produits } = await supabaseAdmin.from("produits").select("id, prix").in("id", produitIds);
  if (!produits) return { ok: false, error: "Produits introuvables." };

  for (const produit of produits) {
    const nouveauPrix =
      action.type === "prix_montant"
        ? Math.max(0, produit.prix + action.montant)
        : Math.max(0, Math.round(produit.prix * (1 + action.pourcentage / 100)));
    if (nouveauPrix === produit.prix) continue;
    const { error } = await supabaseAdmin.from("produits").update({ prix: nouveauPrix }).eq("id", produit.id);
    if (!error) await enregistrerHistoriquePrix(produit.id, produit.prix, nouveauPrix);
  }
  return { ok: true, nb: produits.length };
}

// Écran /admin/prix-a-verifier (TACHE_yuupee_integration_complete.md §5/§7).
export async function getProduitsAVerifier(): Promise<Produit[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .eq("prix_a_verifier", true)
    .order("nom", { ascending: true });
  return data ?? [];
}

// L'admin corrige le prix ou la catégorie depuis la fiche produit, puis lève
// le doute ici. Ne republie pas tout seul : juste une insertion normale dans
// le circuit de publication habituel (basculerPublication).
export async function leverPrixAVerifier(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("produits").update({ prix_a_verifier: false }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de lever le doute sur ce produit." };
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
