"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GAMME_ORDER, isGamme } from "@/lib/gammes";
import { calculerPrixKit, ligneEstAffichable, type LigneKit } from "@/lib/kits";
import type { Cycle, Gamme, Kit, Produit } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export type MotifLigneCachee = "masque" | "rupture" | "sans_prix";

export type LigneCacheeAdmin = {
  libelle_besoin: string | null;
  produit_nom: string;
  motif: MotifLigneCachee;
};

export type KitAvecCompte = Kit & {
  nb_items_total: number;
  nb_items_affiches: number;
  prix_calcule: number;
  lignes_cachees: LigneCacheeAdmin[];
};

function motifLigneCachee(produit: { statut: string; statut_publication: string; prix: number }): MotifLigneCachee {
  if (produit.statut_publication !== "publie") return "masque";
  if (produit.statut === "epuise") return "rupture";
  return "sans_prix";
}

export async function getKitsAdmin(): Promise<KitAvecCompte[]> {
  await requireAdmin();
  const { data: kits } = await supabaseAdmin
    .from("kits")
    .select("*")
    .order("cycle", { ascending: true })
    .order("niveau", { ascending: true });
  if (!kits) return [];

  kits.sort(
    (a, b) =>
      a.cycle.localeCompare(b.cycle) ||
      a.niveau.localeCompare(b.niveau) ||
      GAMME_ORDER[a.gamme as Gamme] - GAMME_ORDER[b.gamme as Gamme],
  );

  const { data: items } = await supabaseAdmin
    .from("kit_items")
    .select("kit_id, quantite_defaut, coche_defaut, section, libelle_besoin, produit:produits(nom, prix, statut, statut_publication)");

  type ProduitLite = { nom: string; prix: number; statut: string; statut_publication: string };
  type Row = {
    kit_id: number;
    quantite_defaut: number;
    coche_defaut: boolean;
    section: string;
    libelle_besoin: string | null;
    produit: ProduitLite;
  };
  type RawRow = Omit<Row, "produit"> & { produit: ProduitLite | ProduitLite[] | null };
  const rows = ((items ?? []) as unknown as RawRow[])
    .map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      return produit ? { ...row, produit } : null;
    })
    .filter((r): r is Row => r !== null);

  const parKit = new Map<number, Row[]>();
  rows.forEach((row) => {
    parKit.set(row.kit_id, [...(parKit.get(row.kit_id) ?? []), row]);
  });

  return kits.map((kit) => {
    const lignes = parKit.get(kit.id) ?? [];
    const ligneKit: LigneKit[] = lignes.map((l) => ({
      item: {
        quantite_defaut: l.quantite_defaut,
        groupe_affichage: null,
        section: l.section as LigneKit["item"]["section"],
        coche_defaut: l.coche_defaut,
        ordre: 0,
      },
      produit: l.produit as unknown as Produit,
    }));

    const { total } = calculerPrixKit(ligneKit);
    const lignesPrincipales = lignes.filter((l) => l.section === "principal");
    const lignesCachees = lignesPrincipales.filter(
      (l) => !ligneEstAffichable(l.produit as unknown as Produit),
    );

    return {
      ...kit,
      nb_items_total: lignesPrincipales.length,
      nb_items_affiches: lignesPrincipales.length - lignesCachees.length,
      prix_calcule: total,
      lignes_cachees: lignesCachees.map((l) => ({
        libelle_besoin: l.libelle_besoin,
        produit_nom: l.produit.nom,
        motif: motifLigneCachee(l.produit),
      })),
    };
  });
}

export async function togglerStatutKit(id: number, statut: "masque" | "publie"): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("kits").update({ statut }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer le statut du kit." };
  return { ok: true };
}

export async function getKitAdmin(id: number): Promise<Kit | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("kits").select("*").eq("id", id).maybeSingle();
  return data;
}

export type KitInput = { cycle: Cycle; gamme: Gamme; niveau: string; nom: string };

export async function creerKit(input: KitInput): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  if (!texteNonVide(input.niveau, 50) || !texteNonVide(input.nom, 200)) {
    return { ok: false, error: "Niveau et nom sont requis." };
  }
  if (!isGamme(input.gamme)) {
    return { ok: false, error: "Gamme invalide." };
  }

  const { data, error } = await supabaseAdmin.from("kits").insert(input).select().single();
  if (error || !data) {
    return { ok: false, error: "Impossible de créer ce kit (cycle + niveau + gamme déjà utilisé ?)." };
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

  // Livres et annales (migration 0068, §3.5.3) : jamais une ancienne édition
  // dans un kit de classe.
  const { data: produit } = await supabaseAdmin
    .from("produits")
    .select("edition_statut")
    .eq("id", produitId)
    .maybeSingle();
  if (produit?.edition_statut === "ancienne") {
    return { ok: false, error: "Impossible d'ajouter une ancienne édition à un kit." };
  }

  // Ndayane Sport (TACHE_ndayane_sport_et_variantes.md §2.5) : un produit à
  // variantes (taille/couleur) ne peut pas entrer dans un kit par classe — on
  // ne sait pas quelle combinaison réserver pour la commande groupée.
  const { count } = await supabaseAdmin
    .from("produit_variantes")
    .select("id", { count: "exact", head: true })
    .eq("produit_id", produitId);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Impossible d'ajouter un produit à variantes (taille/couleur) à un kit." };
  }

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
