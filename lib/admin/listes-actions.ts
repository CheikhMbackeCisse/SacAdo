"use server";

import crypto from "crypto";
import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculerPrixListe, type LigneListe } from "@/lib/listes";
import { ligneEstAffichable } from "@/lib/kits";
import { motifLigneCachee, type LigneCacheeAdmin } from "./motif-ligne-cachee";
import type { Liste, Produit, StatutListe } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

// Code court de l'URL publique /liste/[code] : alphabet sans caractères
// ambigus (0/o, 1/l/i exclus), 10 caractères. Collision extrêmement
// improbable (32^10) mais vérifiée quand même à la création (unique_violation
// Postgres, code 23505).
const ALPHABET_CODE = "abcdefghjkmnpqrstuvwxyz23456789";

function genererCodeListe(): string {
  const octets = crypto.randomBytes(10);
  return Array.from(octets, (b) => ALPHABET_CODE[b % ALPHABET_CODE.length]).join("");
}

function quantiteValide(quantite: number): boolean {
  return Number.isInteger(quantite) && quantite > 0 && quantite <= 999;
}

export type ListeAvecCompte = Liste & {
  nb_items: number;
  prix_calcule: number;
  lignes_cachees: LigneCacheeAdmin[];
};

export type FiltresListesAdmin = { statut?: StatutListe };

type ProduitLite = { nom: string; prix: number; statut: string; statut_publication: string };
type ListeItemRow = { liste_id: number; quantite_defaut: number; coche_defaut: boolean; produit: ProduitLite };
type ListeItemRawRow = Omit<ListeItemRow, "produit"> & { produit: ProduitLite | ProduitLite[] | null };

export async function getListesAdmin(filtres: FiltresListesAdmin = {}): Promise<ListeAvecCompte[]> {
  await requireAdmin();
  let requete = supabaseAdmin.from("listes").select("*").order("created_at", { ascending: false });
  if (filtres.statut) requete = requete.eq("statut", filtres.statut);
  const { data: listes } = await requete;
  if (!listes || listes.length === 0) return [];

  const { data: itemsBruts } = await supabaseAdmin
    .from("liste_items")
    .select("liste_id, quantite_defaut, coche_defaut, produit:produits(nom, prix, statut, statut_publication)")
    .in(
      "liste_id",
      listes.map((l) => l.id),
    );

  const rows = ((itemsBruts ?? []) as unknown as ListeItemRawRow[])
    .map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      return produit ? { ...row, produit } : null;
    })
    .filter((r): r is ListeItemRow => r !== null);

  const parListe = new Map<number, ListeItemRow[]>();
  rows.forEach((row) => {
    parListe.set(row.liste_id, [...(parListe.get(row.liste_id) ?? []), row]);
  });

  return listes.map((liste) => {
    const lignesBrutes = parListe.get(liste.id) ?? [];
    const lignes: LigneListe[] = lignesBrutes.map((l) => ({
      item: { quantite_defaut: l.quantite_defaut, coche_defaut: l.coche_defaut, ordre: 0 },
      produit: l.produit as unknown as Produit,
    }));

    const { total } = calculerPrixListe(lignes);
    const lignesCachees = lignesBrutes.filter((l) => !ligneEstAffichable(l.produit as unknown as Produit));

    return {
      ...liste,
      nb_items: lignesBrutes.length,
      prix_calcule: total,
      lignes_cachees: lignesCachees.map((l) => ({
        libelle_besoin: null,
        produit_nom: l.produit.nom,
        motif: motifLigneCachee(l.produit),
      })),
    };
  });
}

export async function getListeAdmin(id: number): Promise<Liste | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("listes").select("*").eq("id", id).maybeSingle();
  return data;
}

export type ListeInput = { titre: string; description?: string | null };

export async function creerListe(input: ListeInput): Promise<ActionResult & { id?: number; code?: string }> {
  await requireAdmin();
  if (!texteNonVide(input.titre, 200)) {
    return { ok: false, error: "Le titre est requis." };
  }

  for (let essai = 0; essai < 5; essai++) {
    const code = genererCodeListe();
    const { data, error } = await supabaseAdmin
      .from("listes")
      .insert({ code, titre: input.titre.trim(), description: input.description?.trim() || null })
      .select()
      .single();
    if (!error && data) return { ok: true, id: data.id, code: data.code };
    // 23505 = unique_violation (collision de code, improbable) : on retente
    // avec un nouveau code plutôt que d'échouer.
    if (error?.code !== "23505") {
      return { ok: false, error: "Impossible de créer cette liste." };
    }
  }
  return { ok: false, error: "Impossible de générer un lien unique, réessayez." };
}

export async function modifierListe(
  id: number,
  patch: { titre?: string; description?: string | null },
): Promise<ActionResult> {
  await requireAdmin();
  if (patch.titre !== undefined && !texteNonVide(patch.titre, 200)) {
    return { ok: false, error: "Le titre est requis." };
  }
  const { error } = await supabaseAdmin
    .from("listes")
    .update({
      ...(patch.titre !== undefined ? { titre: patch.titre.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cette liste." };
  return { ok: true };
}

export async function togglerStatutListe(id: number, statut: StatutListe): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("listes").update({ statut }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer le statut de la liste." };
  return { ok: true };
}

export async function supprimerListe(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("listes").delete().eq("id", id);
  if (error) return { ok: false, error: "Impossible de supprimer cette liste." };
  return { ok: true };
}

export type ListeItemAvecProduitAdmin = {
  id: number;
  produit_id: number;
  quantite_defaut: number;
  coche_defaut: boolean;
  ordre: number;
  produit_nom: string;
  produit_prix: number;
  produit_photo: string | null;
};

export async function getListeItemsAdmin(listeId: number): Promise<ListeItemAvecProduitAdmin[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("liste_items")
    .select("id, produit_id, quantite_defaut, coche_defaut, ordre, produit:produits(nom, prix, photo)")
    .eq("liste_id", listeId)
    .order("ordre", { ascending: true });
  if (error) return [];

  type Row = {
    id: number;
    produit_id: number;
    quantite_defaut: number;
    coche_defaut: boolean;
    ordre: number;
    produit: { nom: string; prix: number; photo: string | null } | { nom: string; prix: number; photo: string | null }[] | null;
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
        coche_defaut: row.coche_defaut,
        ordre: row.ordre,
        produit_nom: produit.nom,
        produit_prix: produit.prix,
        produit_photo: produit.photo,
      };
    })
    .filter((r): r is ListeItemAvecProduitAdmin => r !== null);
}

export async function ajouterListeItem(listeId: number, produitId: number, quantite: number): Promise<ActionResult> {
  await requireAdmin();
  if (!quantiteValide(quantite)) return { ok: false, error: "Quantité invalide." };

  // Livres et annales (migration 0068) : jamais une ancienne édition — même
  // garde-fou que les kits. Contrairement aux kits, une liste personnalisée
  // accepte les produits à variantes (pas de bénéficiaire à qui réserver une
  // combinaison précise : le client choisit sa variante sur la page publique).
  const { data: produit } = await supabaseAdmin
    .from("produits")
    .select("edition_statut")
    .eq("id", produitId)
    .maybeSingle();
  if (produit?.edition_statut === "ancienne") {
    return { ok: false, error: "Impossible d'ajouter une ancienne édition à une liste." };
  }

  const { count: nbExistants } = await supabaseAdmin
    .from("liste_items")
    .select("id", { count: "exact", head: true })
    .eq("liste_id", listeId);

  const { error } = await supabaseAdmin
    .from("liste_items")
    .insert({ liste_id: listeId, produit_id: produitId, quantite_defaut: quantite, ordre: nbExistants ?? 0 });
  if (error) return { ok: false, error: "Impossible d'ajouter cet article (déjà présent ?)." };
  return { ok: true };
}

export async function modifierListeItemQuantite(id: number, quantite: number): Promise<ActionResult> {
  await requireAdmin();
  if (!quantiteValide(quantite)) return { ok: false, error: "Quantité invalide." };
  const { error } = await supabaseAdmin.from("liste_items").update({ quantite_defaut: quantite }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier la quantité." };
  return { ok: true };
}

export async function modifierListeItemCocheDefaut(id: number, cocheDefaut: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("liste_items").update({ coche_defaut: cocheDefaut }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cet article." };
  return { ok: true };
}

export async function retirerListeItem(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("liste_items").delete().eq("id", id);
  if (error) return { ok: false, error: "Impossible de retirer cet article." };
  return { ok: true };
}

// Glisser-déposer : reçoit l'ordre final complet des ids et réécrit `ordre`
// en une seule transaction via la RPC remplacer_liste_items (migration 0121),
// plutôt qu'en N updates séquentiels comme reordonnerKitItems.
export async function reordonnerListeItems(listeId: number, idsOrdonnes: number[]): Promise<ActionResult> {
  await requireAdmin();
  const { data: items, error: erreurLecture } = await supabaseAdmin
    .from("liste_items")
    .select("id, produit_id, quantite_defaut, coche_defaut")
    .eq("liste_id", listeId);
  if (erreurLecture || !items) return { ok: false, error: "Impossible de réordonner." };

  const parId = new Map(items.map((it) => [it.id, it]));
  const payload = idsOrdonnes
    .map((id, ordre) => {
      const it = parId.get(id);
      if (!it) return null;
      return { produit_id: it.produit_id, quantite_defaut: it.quantite_defaut, coche_defaut: it.coche_defaut, ordre };
    })
    .filter((it): it is NonNullable<typeof it> => it !== null);

  const { error } = await supabaseAdmin.rpc("remplacer_liste_items", { p_liste_id: listeId, p_items: payload });
  if (error) return { ok: false, error: "Impossible de réordonner." };
  return { ok: true };
}
