import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { VENDEUR_SACADO_ID } from "@/lib/vendeurs/constants";
import type { Produit } from "@/lib/supabase/types";

// Export Excel de tous les produits (PROMPT_EXPORTS_ET_CORRECTIONS.md Lot 1),
// quels que soient les filtres de l'écran /admin/produits.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAILLE_PAGE = 1000;

const LIBELLE_STATUT: Record<string, string> = {
  dispo: "Disponible",
  sur_commande: "Sur commande",
  epuise: "Épuisé",
};

const LIBELLE_DELAI: Record<string, string> = {
  "24h": "24h",
  "6j": "6 jours",
};

// Supabase/PostgREST tronque silencieusement un select au-delà de 1 000
// lignes sans .range() (voir le commentaire de rechercherProduitsAdmin dans
// lib/admin/produits-actions.ts) : on pagine nous-mêmes pour ne jamais perdre
// de produits dans l'export.
async function recupererToutesLesLignes<T>(
  requete: (offset: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const lignes: T[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await requete(offset);
    const page = data ?? [];
    lignes.push(...page);
    if (page.length < TAILLE_PAGE) break;
    offset += TAILLE_PAGE;
  }
  return lignes;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }

  const [{ data: categories }, { data: sousCategories }, { data: sousSousCategories }, { data: vendeurs }] =
    await Promise.all([
      supabaseAdmin.from("categories").select("id, nom"),
      supabaseAdmin.from("sous_categories").select("id, nom"),
      supabaseAdmin.from("sous_sous_categories").select("id, nom"),
      supabaseAdmin.from("vendeurs").select("id, nom_boutique"),
    ]);

  const [produits, varianteRows, kitItemRows] = await Promise.all([
    recupererToutesLesLignes<Produit>((offset) =>
      supabaseAdmin
        .from("produits")
        .select("*")
        .order("id", { ascending: true })
        .range(offset, offset + TAILLE_PAGE - 1),
    ),
    recupererToutesLesLignes<{ produit_id: number }>((offset) =>
      supabaseAdmin.from("produit_variantes").select("produit_id").range(offset, offset + TAILLE_PAGE - 1),
    ),
    recupererToutesLesLignes<{ produit_id: number }>((offset) =>
      supabaseAdmin.from("kit_items").select("produit_id").range(offset, offset + TAILLE_PAGE - 1),
    ),
  ]);

  const nomCategorie = new Map((categories ?? []).map((c) => [c.id, c.nom]));
  const nomSousCategorie = new Map((sousCategories ?? []).map((c) => [c.id, c.nom]));
  const nomSousSousCategorie = new Map((sousSousCategories ?? []).map((c) => [c.id, c.nom]));
  const nomVendeur = new Map((vendeurs ?? []).map((v) => [v.id, v.nom_boutique]));

  const nbVariantesParProduit = new Map<number, number>();
  for (const v of varianteRows) nbVariantesParProduit.set(v.produit_id, (nbVariantesParProduit.get(v.produit_id) ?? 0) + 1);

  const nbKitsParProduit = new Map<number, number>();
  for (const k of kitItemRows) nbKitsParProduit.set(k.produit_id, (nbKitsParProduit.get(k.produit_id) ?? 0) + 1);

  const lignes = produits.map((p) => {
    const nbImages = p.photos && p.photos.length > 0 ? p.photos.length : p.photo ? 1 : 0;
    const premiereImage = p.photos?.[0] ?? p.photo ?? "";
    const fournisseur =
      p.vendeur_id === VENDEUR_SACADO_ID ? "SacAdo" : p.vendeur_id ? nomVendeur.get(p.vendeur_id) ?? "" : "";

    return {
      ID: p.id,
      Nom: p.nom,
      Marque: p.marque ?? "",
      Fournisseur: fournisseur,
      "Catégorie": nomCategorie.get(p.categorie_id) ?? "",
      "Sous-catégorie": p.sous_categorie_id ? nomSousCategorie.get(p.sous_categorie_id) ?? "" : "",
      "Classement secondaire": p.sous_sous_categorie_id ? nomSousSousCategorie.get(p.sous_sous_categorie_id) ?? "" : "",
      "Prix d'achat (FCFA)": p.prix_achat ?? "",
      "Prix de vente (FCFA)": p.prix,
      "Marge (FCFA)": p.prix_achat != null ? p.prix - p.prix_achat : "",
      Stock: p.stock,
      Statut: LIBELLE_STATUT[p.statut] ?? p.statut,
      Visible: p.statut_publication === "publie" ? "Oui" : "Non",
      "Délai": LIBELLE_DELAI[p.delai] ?? p.delai,
      Variantes: nbVariantesParProduit.get(p.id) ?? 0,
      "Options payantes": p.personnalisable ? "Oui" : "Non",
      "Nombre d'images": nbImages,
      "Première image": premiereImage,
      "Mots-clés": p.mots_cles ?? "",
      "Nombre de kits": nbKitsParProduit.get(p.id) ?? 0,
      "Dernière modification": p.updated_at ? new Date(p.updated_at).toLocaleDateString("fr-FR") : "",
    };
  });

  const feuille = XLSX.utils.json_to_sheet(lignes);
  feuille["!cols"] = [
    { wch: 6 },
    { wch: 36 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 13 },
    { wch: 9 },
    { wch: 9 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 50 },
    { wch: 30 },
    { wch: 12 },
    { wch: 16 },
  ];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Produits");
  const buffer = XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sacado_produits_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
