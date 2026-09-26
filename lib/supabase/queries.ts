import { supabase } from "./client";
import { slugify } from "@/lib/slug";
import { GAMME_ORDER } from "@/lib/gammes";
import { aplatirAttributs } from "@/lib/variantes";
import type {
  Categorie,
  DocumentApercu,
  Gamme,
  Kit,
  KitItem,
  Localite,
  LieuSpecial,
  Produit,
  SousCategorie,
  SousSousCategorie,
  VarianteAvecAttributs,
  Zone,
} from "./types";

const SELECT_VARIANTE = "*, variante_attributs(attribut_id, valeur, attributs(nom))";

// Colonnes produit exposées au storefront (client anon). Toutes SAUF
// `prix_achat` : le coût d'achat ne doit jamais transiter par l'API publique
// (il n'existe que pour la composante « marge » du score, calculée en base).
// L'admin lit l'intégralité via le service_role.
const COLONNES_PRODUIT_PUBLIC =
  "id,nom,categorie_id,sous_categorie_id,sous_sous_categorie_id,prix,delai,photo,photos,stock,seuil_alerte,statut,created_at,description,mots_cles,vendeur_id,statut_publication,motif_refus,commentaire_vendeur,publie_par,niveau,serie,matiere,type_ouvrage,auteur,editeur,edition,edition_statut,couverture_epreuves,ouvrage_id,guide_tailles,processeur,ram_go,stockage_go,type_stockage,taille_ecran,ecran_tactile,convertible,etat,garantie_mois,marque,est_kit,niveau_difficulte,notice_url,technologie,couleur_impression,compatibilite,score_global,photo_a_ameliorer" as const;

// Aplatit une réponse Supabase (avec ou sans jointure) en VarianteAvecAttributs.
function versVariantes(
  rows: unknown[] | null,
  avecJointure: boolean,
): VarianteAvecAttributs[] {
  return (rows ?? []).map((row) => ({
    ...(row as VarianteAvecAttributs),
    attributs: avecJointure ? aplatirAttributs(row as never) : [],
  }));
}

// Marques (maj-26-09 §4) : pas de table dédiée, `produits.marque` fait foi.
// Le slug est recalculé à la volée (comme les produits, lib/slug.ts), jamais
// stocké : une marque n'existe qu'à travers les produits qui la portent.
export type MarqueAvecCompte = { marque: string; count: number };

export async function getMarques(): Promise<MarqueAvecCompte[]> {
  const { data, error } = await supabase
    .from("produits")
    .select("marque")
    .eq("statut_publication", "publie")
    .not("marque", "is", null);
  if (error) throw error;
  const compte = new Map<string, number>();
  for (const row of data ?? []) {
    const m = row.marque as string;
    compte.set(m, (compte.get(m) ?? 0) + 1);
  }
  return [...compte.entries()]
    .map(([marque, count]) => ({ marque, count }))
    .sort((a, b) => a.marque.localeCompare(b.marque, "fr"));
}

// Résout un slug d'URL (/marques/[slug]) vers le nom exact de la marque —
// nécessite de reparcourir la liste (pas d'index sur un slug calculé).
export async function getMarqueBySlug(slug: string): Promise<string | null> {
  const marques = await getMarques();
  return marques.find((m) => slugify(m.marque) === slug)?.marque ?? null;
}

export async function getProduitsByMarque(
  marque: string,
  { offset = 0, limit = TAILLE_PAGE_CATEGORIE }: { offset?: number; limit?: number } = {},
): Promise<PageResultat<Produit>> {
  const { data, error, count } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC, { count: "exact" })
    .eq("marque", marque)
    .or(FILTRE_EDITION_AFFICHABLE)
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore, total: count ?? undefined };
}

export async function getCategories(): Promise<Categorie[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("actif", true)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategorieBySlug(slug: string): Promise<Categorie | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCategorieById(id: number): Promise<Categorie | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPopulaires(limit = 8, categorieId?: number): Promise<Produit[]> {
  let requete = supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .or(FILTRE_EDITION_AFFICHABLE)
    .order("id", { ascending: true })
    .limit(limit);
  if (categorieId != null) requete = requete.eq("categorie_id", categorieId);
  const { data, error } = await requete;
  if (error) throw error;
  return data ?? [];
}

// L'accueil classé (getAccueilProduits) vit dans lib/accueil.ts : il lit
// l'affinité de la personne via le service_role, ce que ce fichier — importé
// par des composants client — ne peut pas faire.

export type PageResultat<T> = { items: T[]; hasMore: boolean; total?: number };

export const TAILLE_PAGE_CATALOGUE = 200;

// Page d'une liste catégorie (maj-26-09 §6) : plus petite que
// TAILLE_PAGE_CATALOGUE (utilisée par la recherche) car les facettes sont
// maintenant appliquées ICI, côté requête, jamais en filtrant après coup le
// lot déjà chargé — une catégorie dépasse vite 200 articles (Livres : 316),
// et un filtre posé sur le seul lot chargé faisait "disparaître" des
// résultats tant que "Charger plus" n'avait pas atteint la bonne page (ex.
// filtres "3e"+"SVT" sur les livres).
export const TAILLE_PAGE_CATEGORIE = 60;
export type FiltresProduitsCategorie = {
  sousCategorieId?: number | null;
  sousSousCategorieId?: number | null;
  // Livres
  niveau?: string | null;
  serie?: string | null;
  matiere?: string | null;
  typeOuvrage?: string | null;
  // Ordinateurs / prix générique
  prixMin?: number | null;
  prixMax?: number | null;
  ramGo?: number | null;
  stockageGo?: number | null;
  tailleEcran?: number | null;
  ecranTactile?: boolean | null;
  marque?: string | null;
  // 'nom' (défaut, catalogue général) ; 'prix_asc'/'score_desc' (ordinateurs :
  // "Prix croissant" / "Pertinence") — doit être un tri serveur, pas un tri du
  // seul lot chargé, sinon incohérent d'une page "Charger plus" à l'autre.
  ordre?: "nom" | "prix_asc" | "score_desc";
};

export async function getProduitsByCategorie(
  categorieId: number,
  {
    offset = 0,
    limit = TAILLE_PAGE_CATEGORIE,
    sousCategorieId,
    sousSousCategorieId,
    niveau,
    serie,
    matiere,
    typeOuvrage,
    prixMin,
    prixMax,
    ramGo,
    stockageGo,
    tailleEcran,
    ecranTactile,
    marque,
    ordre = "nom",
  }: { offset?: number; limit?: number } & FiltresProduitsCategorie = {},
): Promise<PageResultat<Produit>> {
  let requete = supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC, { count: "exact" })
    .eq("categorie_id", categorieId)
    .or(FILTRE_EDITION_AFFICHABLE);
  if (sousCategorieId != null) requete = requete.eq("sous_categorie_id", sousCategorieId);
  if (sousSousCategorieId != null) requete = requete.eq("sous_sous_categorie_id", sousSousCategorieId);
  if (niveau) requete = requete.eq("niveau", niveau);
  // "S" (série générique) doit aussi remonter S1/S2 : géré par l'appelant en
  // repassant serie=null et en filtrant après coup dans ce cas précis, sinon
  // filtre exact.
  if (serie) requete = requete.eq("serie", serie);
  if (matiere) requete = requete.eq("matiere", matiere);
  if (typeOuvrage) requete = requete.eq("type_ouvrage", typeOuvrage);
  if (prixMin != null) requete = requete.gte("prix", prixMin);
  if (prixMax != null) requete = requete.lt("prix", prixMax);
  if (ramGo != null) requete = requete.eq("ram_go", ramGo);
  if (stockageGo != null) requete = requete.eq("stockage_go", stockageGo);
  if (tailleEcran != null) requete = requete.eq("taille_ecran", tailleEcran);
  if (ecranTactile != null) requete = requete.eq("ecran_tactile", ecranTactile);
  if (marque) requete = requete.eq("marque", marque);

  if (ordre === "prix_asc") requete = requete.order("prix", { ascending: true });
  else if (ordre === "score_desc") requete = requete.order("score_global", { ascending: false, nullsFirst: false });
  else requete = requete.order("nom", { ascending: true });

  // .range() est inclusif : on demande une ligne de plus que "limit" pour
  // savoir s'il reste une page suivante, sans requête de comptage séparée.
  const { data, error, count } = await requete.range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore, total: count ?? undefined };
}

function trierValeurs(valeurs: Iterable<string>): string[] {
  return [...new Set(valeurs)].sort((a, b) => a.localeCompare(b, "fr"));
}

export type FacettesLivres = { niveaux: string[]; series: string[]; matieres: string[]; types: string[] };

// Valeurs de facette calculées sur TOUTE la catégorie (pas sur la page
// chargée) : sinon les options du filtre elles-mêmes dépendent de ce qui est
// déjà chargé, même bug que le filtrage lui-même (maj-26-09 §6).
export async function getFacettesLivres(categorieId: number): Promise<FacettesLivres> {
  const { data, error } = await supabase
    .from("produits")
    .select("niveau, serie, matiere, type_ouvrage")
    .eq("categorie_id", categorieId)
    .or(FILTRE_EDITION_AFFICHABLE);
  if (error) throw error;
  const rows = data ?? [];
  return {
    niveaux: trierValeurs(rows.map((r) => r.niveau).filter((v): v is string => !!v)),
    series: trierValeurs(rows.map((r) => r.serie).filter((v): v is string => !!v)),
    matieres: trierValeurs(rows.map((r) => r.matiere).filter((v): v is string => !!v)),
    types: trierValeurs(rows.map((r) => r.type_ouvrage).filter((v): v is string => !!v)),
  };
}

export type FacettesOrdinateurs = { rams: string[]; stockages: string[]; ecrans: string[]; marques: string[] };

export async function getFacettesOrdinateurs(
  categorieId: number,
  sousCategorieId: number,
): Promise<FacettesOrdinateurs> {
  const { data, error } = await supabase
    .from("produits")
    .select("ram_go, stockage_go, taille_ecran, marque")
    .eq("categorie_id", categorieId)
    .eq("sous_categorie_id", sousCategorieId)
    .or(FILTRE_EDITION_AFFICHABLE);
  if (error) throw error;
  const rows = data ?? [];
  const triNumerique = (a: string, b: string) => parseFloat(a) - parseFloat(b);
  return {
    rams: [...new Set(rows.map((r) => (r.ram_go ? `${r.ram_go} Go` : null)).filter((v): v is string => !!v))].sort(triNumerique),
    stockages: [...new Set(rows.map((r) => (r.stockage_go ? `${r.stockage_go} Go` : null)).filter((v): v is string => !!v))].sort(triNumerique),
    ecrans: [...new Set(rows.map((r) => (r.taille_ecran ? `${r.taille_ecran} pouces` : null)).filter((v): v is string => !!v))].sort(triNumerique),
    marques: trierValeurs(rows.map((r) => r.marque).filter((v): v is string => !!v)),
  };
}

export async function getSousCategoriesByCategorie(
  categorieId: number,
): Promise<SousCategorie[]> {
  const { data, error } = await supabase
    .from("sous_categories")
    .select("*")
    .eq("categorie_id", categorieId)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) {
    console.warn("sous_categories indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

// 3e niveau (optionnel). Renvoie [] si la sous-catégorie n'en a pas — c'est le
// signal que le formulaire produit n'affiche pas le 3e select (SOUS_SOUS_CATEGORIES.md §2).
// `console.warn` + [] tant que la migration 0030 n'est pas passée.
export async function getSousSousCategoriesBySousCategorie(
  sousCategorieId: number,
): Promise<SousSousCategorie[]> {
  const { data, error } = await supabase
    .from("sous_sous_categories")
    .select("*")
    .eq("sous_categorie_id", sousCategorieId)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) {
    console.warn("sous_sous_categories indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

export async function getProduitById(id: number): Promise<Produit | null> {
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Pour le sitemap (app/sitemap.ts) : juste de quoi construire l'URL, jamais
// un produit masqué (non publié) ou en rupture n'y figure.
export type ProduitPourSitemap = Pick<Produit, "id" | "nom">;

export async function getProduitsPubliesPourSitemap(): Promise<ProduitPourSitemap[]> {
  const { data, error } = await supabase
    .from("produits")
    .select("id, nom")
    .eq("statut_publication", "publie");
  if (error) throw error;
  return data ?? [];
}

// Livres et annales (migration 0068, §3.4) : les autres éditions publiées du
// même ouvrage, pour le bloc "Autres éditions disponibles" de la fiche produit.
export type EditionSoeur = Pick<Produit, "id" | "prix" | "edition" | "couverture_epreuves">;

export async function getAutresEditions(
  ouvrageId: number,
  produitIdActuel: number,
): Promise<EditionSoeur[]> {
  const { data, error } = await supabase
    .from("produits")
    .select("id, prix, edition, couverture_epreuves")
    .eq("ouvrage_id", ouvrageId)
    .eq("statut_publication", "publie")
    .neq("id", produitIdActuel);
  if (error) throw error;
  return data ?? [];
}

// Kit électronique (migration 0073) : composants pour le bloc "Ce que
// contient le kit" (TACHE_kits_impression_classement.md §A.6). Volontairement
// sans le prix du composant — "ne pas afficher le prix des composants pris
// séparément, la somme est proche du prix du kit et l'afficher invite à comparer."
export type ComposantKit = { id: number; nom: string; photo: string | null; quantite: number };

export async function getCompositionKit(kitId: number): Promise<ComposantKit[]> {
  // FK explicite : composition_kit référence produits deux fois (kit_id et
  // composant_id), PostgREST refuse de deviner laquelle utiliser sinon.
  const { data, error } = await supabase
    .from("composition_kit")
    .select("quantite, composant:produits!composition_kit_composant_id_fkey(id, nom, photo)")
    .eq("kit_id", kitId);
  if (error) throw error;
  type Row = { quantite: number; composant: { id: number; nom: string; photo: string | null } | { id: number; nom: string; photo: string | null }[] | null };
  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const composant = Array.isArray(row.composant) ? row.composant[0] : row.composant;
    return composant ? [{ ...composant, quantite: row.quantite }] : [];
  });
}

const COLONNES_DOCUMENT_APERCU =
  "id, titre, type, acces, apercu_url, nombre_pages, apercu_texte, materiel_supplementaire";

// Aperçu public des notices de montage d'un kit (migration 0077,
// TACHE_documents_telechargeables.md §5) : jamais `chemin_fichier`, colonne
// absente de cette liste — le fichier n'est accessible que via une server
// action authentifiée (lib/documents/actions.ts).
export async function getDocumentsApercu(produitId: number): Promise<DocumentApercu[]> {
  const { data, error } = await supabase
    .from("documents_produits")
    .select(`document:documents!inner(${COLONNES_DOCUMENT_APERCU})`)
    .eq("produit_id", produitId)
    .eq("documents.actif", true);
  if (error) throw error;
  type Row = { document: DocumentApercu | DocumentApercu[] | null };
  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const document = Array.isArray(row.document) ? row.document[0] : row.document;
    return document ? [document] : [];
  });
}

export async function getProduitsByIds(ids: number[]): Promise<Produit[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getVariantesByProduit(
  produitId: number,
): Promise<VarianteAvecAttributs[]> {
  const jointure = await supabase
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (!jointure.error) return versVariantes(jointure.data, true);

  // Repli si `variante_attributs` n'existe pas encore (migration 0022).
  const brut = await supabase
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (brut.error) throw brut.error;
  return versVariantes(brut.data, false);
}

// Variantes de plusieurs produits en un aller-retour (page kit : plusieurs
// lignes peuvent porter des variantes — ex. l'ardoise, en 4 couleurs).
export async function getVariantesByProduitIds(
  produitIds: number[],
): Promise<Map<number, VarianteAvecAttributs[]>> {
  const uniques = [...new Set(produitIds)];
  if (uniques.length === 0) return new Map();

  const jointure = await supabase
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .in("produit_id", uniques)
    .order("id", { ascending: true });
  const rows = !jointure.error
    ? versVariantes(jointure.data, true)
    : versVariantes(
        (await supabase.from("produit_variantes").select("*").in("produit_id", uniques).order("id", { ascending: true }))
          .data,
        false,
      );

  const parProduit = new Map<number, VarianteAvecAttributs[]>();
  rows.forEach((v) => {
    parProduit.set(v.produit_id, [...(parProduit.get(v.produit_id) ?? []), v]);
  });
  return parProduit;
}

export async function getVariantesByIds(ids: number[]): Promise<VarianteAvecAttributs[]> {
  if (ids.length === 0) return [];
  const jointure = await supabase
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .in("id", ids);
  if (!jointure.error) return versVariantes(jointure.data, true);

  const brut = await supabase.from("produit_variantes").select("*").in("id", ids);
  if (brut.error) throw brut.error;
  return versVariantes(brut.data, false);
}

export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("zones").select("*").order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Sert à peupler le sélecteur de localité du checkout (IMPLEMENTATION_TARIFS_LIVRAISON.md).
// Tolère la table absente (migration 0034 pas encore passée) : le checkout
// retombe alors sur la saisie libre "tarif à confirmer".
export async function getLocalites(): Promise<Localite[]> {
  const { data, error } = await supabase.from("localites").select("*").order("nom", { ascending: true });
  if (error) {
    console.warn("localites indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

export async function getLieuxSpeciaux(): Promise<LieuSpecial[]> {
  const { data, error } = await supabase.from("lieux_speciaux").select("*").order("nom", { ascending: true });
  if (error) {
    console.warn("lieux_speciaux indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

const SEUIL_LIVRAISON_GRATUITE_DEFAUT = 75000;

// Réglable en admin (table `parametres`) : repli sur la valeur par défaut si
// la ligne n'existe pas encore ou si elle est mal formée.
export async function getSeuilLivraisonGratuite(): Promise<number> {
  const { data, error } = await supabase
    .from("parametres")
    .select("valeur")
    .eq("cle", "seuil_livraison_gratuite")
    .maybeSingle();
  if (error || !data) return SEUIL_LIVRAISON_GRATUITE_DEFAUT;
  const valeur = Number(data.valeur);
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : SEUIL_LIVRAISON_GRATUITE_DEFAUT;
}

export async function getProduitsSimilaires(
  categorieId: number,
  excludeId: number,
  limit = 4,
): Promise<Produit[]> {
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .eq("categorie_id", categorieId)
    .neq("id", excludeId)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Sacs proposés dans le sélecteur du kit (KIT_AMELIORATIONS.md §3) : les
// sous-catégories "Sacs à dos" et "Sacs à roulettes" de "Cartables & sacs".
// Pas de cartables ici : le kit propose un SAC, distinct du cartable rigide.
const SLUGS_SOUS_CATEGORIES_SACS = ["sacs-a-dos", "sacs-a-roulettes"];

export async function getSacsDisponibles({
  offset = 0,
  limit = 5,
  excludeIds = [],
}: {
  offset?: number;
  limit?: number;
  excludeIds?: number[];
} = {}): Promise<PageResultat<Produit>> {
  const { data: sousCats, error: erreurSousCats } = await supabase
    .from("sous_categories")
    .select("id")
    .in("slug", SLUGS_SOUS_CATEGORIES_SACS);
  if (erreurSousCats) throw erreurSousCats;
  const sousCategorieIds = (sousCats ?? []).map((row) => row.id as number);
  if (sousCategorieIds.length === 0) return { items: [], hasMore: false };

  let requete = supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .in("sous_categorie_id", sousCategorieIds)
    .or(FILTRE_EDITION_AFFICHABLE);
  if (excludeIds.length > 0) requete = requete.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await requete
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

// Recherche produit v2 (migration 0041) : chaque mot tapé est obligatoire (ET),
// synonymes pris en compte, et chaque résultat est classé `nom` (la désignation
// contient les mots tapés) ou `categorie` (match seulement via la catégorie).
export type TypeResultat = "nom" | "categorie";
export type ProduitTrouve = Produit & { type_resultat: TypeResultat };

type LigneRechercheRpc = { id: number; type_resultat: TypeResultat; score: number };

export async function rechercherProduits(
  query: string,
  { limite = TAILLE_PAGE_CATALOGUE }: { limite?: number } = {},
): Promise<ProduitTrouve[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("rechercher_produits", {
    terme: trimmed,
    limite,
  });

  if (error) {
    // Repli tant que la migration 0041 n'est pas passée : ilike simple sur le nom.
    console.warn("rechercher_produits indisponible, repli ilike :", error.message);
    const repli = await supabase
      .from("produits")
      .select(COLONNES_PRODUIT_PUBLIC)
      .ilike("nom", `%${trimmed}%`)
      .order("nom", { ascending: true })
      .limit(limite);
    if (repli.error) throw repli.error;
    return (repli.data ?? []).map((p) => ({
      ...(p as Produit),
      type_resultat: "nom" as const,
    }));
  }

  const lignes = (data ?? []) as LigneRechercheRpc[];
  if (lignes.length === 0) return [];

  // La RPC ne renvoie qu'un sous-ensemble de colonnes : on ré-hydrate en Produit
  // complet (badge de délai, variantes, etc.) en préservant l'ordre du score.
  const produits = await getProduitsByIds(lignes.map((l) => l.id));
  const parId = new Map(produits.map((p) => [p.id, p]));
  return lignes
    .map((l) => {
      const p = parId.get(l.id);
      return p ? { ...p, type_resultat: l.type_resultat } : null;
    })
    .filter((p): p is ProduitTrouve => p !== null)
    .filter(estEditionAffichable);
}

// Livres et annales (migration 0068, §3.5.1) : une ancienne édition ne
// s'affiche jamais dans les listes/la recherche tant que son édition en
// vigueur existe (`ouvrage_id` partagé). Un produit sans `ouvrage_id` n'a
// pas de frère : toujours affiché.
//
// Filtre appliqué CÔTÉ REQUÊTE (PostgREST .or()) sur les listes paginées par
// `.range()` : le filtrer après coup en JS fausse `hasMore` (une page où la
// ligne exclue tombait dans la fenêtre récupérée se retrouvait avec moins de
// lignes que prévu, donnant l'impression à tort qu'il n'y avait pas de page
// suivante — des dizaines de produits devenaient alors invisibles).
const FILTRE_EDITION_AFFICHABLE = "edition_statut.neq.ancienne,ouvrage_id.is.null";

function estEditionAffichable(p: Produit): boolean {
  return !(p.edition_statut === "ancienne" && p.ouvrage_id !== null);
}

export type SuggestionProduit = Pick<Produit, "id" | "nom" | "photo" | "prix" | "statut">;
export type SuggestionCategorie = Pick<Categorie, "id" | "nom" | "slug">;
export type SuggestionSousCategorie = Pick<SousCategorie, "id" | "nom" | "slug"> & {
  categorie_slug: string;
  categorie_nom: string;
};
// 3e niveau (SOUS_SOUS_CATEGORIES.md §3) : porte aussi le chemin complet
// (slugs + noms de la catégorie et de la sous-catégorie parentes), nécessaire
// pour construire le lien /categorie/[slug]?sc=...&ssc=... et le sous-titre.
export type SuggestionSousSousCategorie = Pick<SousSousCategorie, "id" | "nom" | "slug"> & {
  sous_categorie_slug: string;
  sous_categorie_nom: string;
  categorie_slug: string;
  categorie_nom: string;
};
export type SuggestionsRecherche = {
  produits: SuggestionProduit[];
  categories: SuggestionCategorie[];
  sousCategories: SuggestionSousCategorie[];
  sousSousCategories: SuggestionSousSousCategorie[];
};

const SUGGESTIONS_VIDES: SuggestionsRecherche = {
  produits: [],
  categories: [],
  sousCategories: [],
  sousSousCategories: [],
};

export async function getSuggestionsRecherche(query: string): Promise<SuggestionsRecherche> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return SUGGESTIONS_VIDES;
  const { data, error } = await supabase.rpc("suggestions_recherche", { p_terme: trimmed });
  if (error) {
    console.warn("suggestions_recherche indisponible :", error.message);
    return SUGGESTIONS_VIDES;
  }
  const brut = (data ?? {}) as {
    produits?: SuggestionProduit[];
    categories?: SuggestionCategorie[];
    sous_categories?: SuggestionSousCategorie[];
    sous_sous_categories?: SuggestionSousSousCategorie[];
  };
  return {
    produits: brut.produits ?? [],
    categories: brut.categories ?? [],
    sousCategories: brut.sous_categories ?? [],
    sousSousCategories: brut.sous_sous_categories ?? [],
  };
}

// Toutes les sous-sous-catégories des sous-catégories données (utilisé par la
// page catégorie : elle connaît déjà ses sous-catégories, on récupère leur
// éventuel 3e niveau en un seul aller-retour). Tolère la table absente.
export async function getSousSousCategoriesBySousCategories(
  sousCategorieIds: number[],
): Promise<SousSousCategorie[]> {
  if (sousCategorieIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sous_sous_categories")
    .select("*")
    .in("sous_categorie_id", sousCategorieIds)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) {
    console.warn("sous_sous_categories indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

// `source_interne` et `manquants_connus` sont réservés à l'admin : jamais
// exposés côté client (Étape 4 du prompt), donc jamais dans ce select public.
const COLONNES_KIT_PUBLIC =
  "id,cycle,niveau,gamme,nom,created_at,slug,serie,ordre_gamme,description,description_si_aucune_cle_des_cracks,type_source,statut" as const;

// Les gammes disponibles pour une classe, triées Essentiel -> Complet -> Confort
// (ordre_gamme). Seuls les kits publiés sont visibles côté storefront —
// masqué = pas encore vérifié par l'admin après import.
export async function getKitsByCycleNiveau(cycle: string, niveau: string): Promise<Kit[]> {
  const { data, error } = await supabase
    .from("kits")
    .select(COLONNES_KIT_PUBLIC)
    .eq("cycle", cycle)
    .eq("niveau", niveau)
    .eq("statut", "publie");
  if (error) throw error;
  return (data ?? [])
    .map((k) => ({ ...k, source_interne: null, manquants_connus: [] }) as Kit)
    .sort((a, b) => GAMME_ORDER[a.gamme as Gamme] - GAMME_ORDER[b.gamme as Gamme]);
}

export async function getKitByCycleNiveauGamme(
  cycle: string,
  niveau: string,
  gamme: Gamme,
): Promise<Kit | null> {
  const { data, error } = await supabase
    .from("kits")
    .select(COLONNES_KIT_PUBLIC)
    .eq("cycle", cycle)
    .eq("niveau", niveau)
    .eq("gamme", gamme)
    .eq("statut", "publie")
    .maybeSingle();
  if (error) throw error;
  return data ? ({ ...data, source_interne: null, manquants_connus: [] } as Kit) : null;
}

// Classes de lycée pour lesquelles au moins un kit publié existe — sert à
// construire la navigation (Étape 4 : les séries à venir n'ont ni prix, ni
// bouton, ni lien vers un kit, donc on ne les mélange pas aux vraies données).
export async function getClassesLyceeAvecKits(): Promise<string[]> {
  const { data, error } = await supabase
    .from("kits")
    .select("niveau")
    .eq("cycle", "lycee")
    .eq("statut", "publie");
  if (error) throw error;
  return [...new Set((data ?? []).map((k) => k.niveau))];
}

export type KitItemAvecProduit = {
  id: number;
  quantite_defaut: number;
  libelle_besoin: string | null;
  groupe_affichage: string | null;
  section: KitItem["section"];
  coche_defaut: boolean;
  ordre: number;
  produit: Produit;
};

export async function getKitItemsAvecProduits(kitId: number): Promise<KitItemAvecProduit[]> {
  const { data, error } = await supabase
    .from("kit_items")
    .select(
      `id, quantite_defaut, libelle_besoin, groupe_affichage, section, coche_defaut, ordre, produit:produits(${COLONNES_PRODUIT_PUBLIC})`,
    )
    .eq("kit_id", kitId)
    .order("ordre", { ascending: true });
  if (error) throw error;

  // Sans schéma Database généré, supabase-js ne connaît pas la cardinalité de
  // la relation embarquée (produits ↔ kit_items) et type "produit" en any[] :
  // on gère les deux formes possibles au runtime plutôt que de forcer un cast.
  type RawRow = Omit<KitItemAvecProduit, "produit"> & { produit: Produit | Produit[] | null };
  const rows = (data ?? []) as unknown as RawRow[];

  return rows
    .map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      return produit ? { ...row, produit } : null;
    })
    .filter((row): row is KitItemAvecProduit => row !== null);
}
