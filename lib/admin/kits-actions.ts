"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GAMME_ORDER, isGamme } from "@/lib/gammes";
import { calculerPrixKit, ligneEstAffichable, type LigneKit } from "@/lib/kits";
import type { Cycle, Gamme, Kit, Produit, SectionKitItem } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";
import { filtrerKitsAdmin } from "./kits-filtrage";

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
  // Vrai si, pour cette classe (cycle+niveau), le prix Essentiel < Complet <
  // Confort n'est pas respecté — signalé en rouge dans la liste (ADMIN.md Lot 2).
  ordre_prix_invalide: boolean;
};

export type FiltresKitsAdmin = {
  cycle?: Cycle;
  niveau?: string;
  gamme?: Gamme;
  statut?: "masque" | "publie";
};

function motifLigneCachee(produit: { statut: string; statut_publication: string; prix: number }): MotifLigneCachee {
  if (produit.statut_publication !== "publie") return "masque";
  if (produit.statut === "epuise") return "rupture";
  return "sans_prix";
}

type ProduitLite = { nom: string; prix: number; statut: string; statut_publication: string };
type KitItemRow = {
  kit_id: number;
  quantite_defaut: number;
  coche_defaut: boolean;
  section: string;
  libelle_besoin: string | null;
  produit: ProduitLite;
};
type KitItemRawRow = Omit<KitItemRow, "produit"> & { produit: ProduitLite | ProduitLite[] | null };

const SELECT_KIT_ITEMS_AVEC_PRODUIT =
  "kit_id, quantite_defaut, coche_defaut, section, libelle_besoin, produit:produits(nom, prix, statut, statut_publication)";

// Calcule total/nb affichés/lignes cachées pour chaque kit à partir de ses
// lignes déjà chargées, puis signale les classes (cycle+niveau) dont l'ordre
// de prix Essentiel < Complet < Confort n'est pas respecté. Factorisé hors de
// getKitsAdmin pour être réutilisable sur un sous-ensemble de kits
// (getTotauxGammesClasse) sans recharger tout le catalogue à chaque fois
// (PROMPT_ADMIN_KITS_PRODUITS.md lot 5).
function annoterKits(kits: Kit[], itemsBruts: KitItemRawRow[]): KitAvecCompte[] {
  const rows = itemsBruts
    .map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      return produit ? { ...row, produit } : null;
    })
    .filter((r): r is KitItemRow => r !== null);

  const parKit = new Map<number, KitItemRow[]>();
  rows.forEach((row) => {
    parKit.set(row.kit_id, [...(parKit.get(row.kit_id) ?? []), row]);
  });

  const avecTotal = kits.map((kit) => {
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

  // Une classe (cycle+niveau) est invalide si le prix Essentiel > Complet, ou
  // Complet > Confort (quand les deux existent).
  const parClasse = new Map<string, typeof avecTotal>();
  avecTotal.forEach((k) => {
    const cle = `${k.cycle}|${k.niveau}`;
    parClasse.set(cle, [...(parClasse.get(cle) ?? []), k]);
  });
  const classesInvalides = new Set<string>();
  parClasse.forEach((kitsDeLaClasse, cle) => {
    const prixParGamme = new Map(kitsDeLaClasse.map((k) => [k.gamme, k.prix_calcule]));
    const essentiel = prixParGamme.get("essentiel");
    const complet = prixParGamme.get("complet");
    const confort = prixParGamme.get("confort");
    if (
      (essentiel != null && complet != null && essentiel > complet) ||
      (complet != null && confort != null && complet > confort)
    ) {
      classesInvalides.add(cle);
    }
  });

  return avecTotal.map((k) => ({
    ...k,
    ordre_prix_invalide: classesInvalides.has(`${k.cycle}|${k.niveau}`),
  }));
}

export async function getKitsAdmin(filtres: FiltresKitsAdmin = {}): Promise<KitAvecCompte[]> {
  await requireAdmin();
  // Toujours chargés sans filtre : le signalement "ordre de prix invalide"
  // compare les 3 gammes d'une classe, y compris celles masquées par les
  // filtres d'affichage.
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

  const { data: items } = await supabaseAdmin.from("kit_items").select(SELECT_KIT_ITEMS_AVEC_PRODUIT);

  return filtrerKitsAdmin(annoterKits(kits, (items ?? []) as unknown as KitItemRawRow[]), filtres);
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

// « Dupliquer un kit existant » (ADMIN.md Lot 2) : copie le kit (nouvelle
// gamme/nom) et toutes ses lignes, pour partir du Complet et faire le Confort.
export async function dupliquerKit(
  kitSourceId: number,
  cible: { gamme: Gamme; nom: string },
): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const { data: source } = await supabaseAdmin.from("kits").select("*").eq("id", kitSourceId).maybeSingle();
  if (!source) return { ok: false, error: "Kit source introuvable." };

  const { data: kitCree, error } = await supabaseAdmin
    .from("kits")
    .insert({ cycle: source.cycle, niveau: source.niveau, gamme: cible.gamme, nom: cible.nom })
    .select()
    .single();
  if (error || !kitCree) {
    return { ok: false, error: "Impossible de créer le kit (cycle + niveau + gamme déjà utilisé ?)." };
  }

  const { data: items } = await supabaseAdmin
    .from("kit_items")
    .select("produit_id, quantite_defaut, libelle_besoin, groupe_affichage, section, coche_defaut, ordre")
    .eq("kit_id", kitSourceId);
  if (items && items.length > 0) {
    await supabaseAdmin
      .from("kit_items")
      .insert(items.map((it) => ({ ...it, kit_id: kitCree.id })));
  }

  return { ok: true, id: kitCree.id };
}

// Rappel des totaux des deux autres gammes de la même classe (ADMIN.md Lot 2 :
// « total en direct, avec le rappel des totaux des deux autres gammes »).
// Appelée à chaque ouverture de l'éditeur de kit : ne charge plus tout le
// catalogue (kits + kit_items de TOUS les kits via getKitsAdmin) pour
// n'afficher que 2-3 totaux de la même classe — seulement les kits de ce
// cycle+niveau, et seulement leurs lignes (PROMPT_ADMIN_KITS_PRODUITS.md lot
// 5 : c'était la requête dominante derrière la lenteur de cette page).
export async function getTotauxGammesClasse(
  cycle: Cycle,
  niveau: string,
  excluKitId: number,
): Promise<{ gamme: Gamme; nom: string; prix_calcule: number }[]> {
  await requireAdmin();
  const { data: kits } = await supabaseAdmin.from("kits").select("*").eq("cycle", cycle).eq("niveau", niveau);
  if (!kits || kits.length === 0) return [];

  const idsKits = kits.map((k) => k.id);
  const { data: items } = await supabaseAdmin
    .from("kit_items")
    .select(SELECT_KIT_ITEMS_AVEC_PRODUIT)
    .in("kit_id", idsKits);

  return annoterKits(kits, (items ?? []) as unknown as KitItemRawRow[])
    .filter((k) => k.id !== excluKitId)
    .map((k) => ({ gamme: k.gamme, nom: k.nom, prix_calcule: k.prix_calcule }));
}

export type KitItemAvecProduit = {
  id: number;
  produit_id: number;
  quantite_defaut: number;
  produit_nom: string;
  produit_prix: number;
  produit_photo: string | null;
  libelle_besoin: string | null;
  groupe_affichage: string | null;
  section: SectionKitItem;
  coche_defaut: boolean;
  ordre: number;
};

export async function getKitItemsAdmin(kitId: number): Promise<KitItemAvecProduit[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("kit_items")
    .select(
      "id, produit_id, quantite_defaut, libelle_besoin, groupe_affichage, section, coche_defaut, ordre, produit:produits(nom, prix, photo)",
    )
    .eq("kit_id", kitId)
    .order("ordre", { ascending: true });
  if (error) return [];

  type Row = {
    id: number;
    produit_id: number;
    quantite_defaut: number;
    libelle_besoin: string | null;
    groupe_affichage: string | null;
    section: SectionKitItem;
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
        produit_nom: produit.nom,
        produit_prix: produit.prix,
        produit_photo: produit.photo,
        libelle_besoin: row.libelle_besoin,
        groupe_affichage: row.groupe_affichage,
        section: row.section,
        coche_defaut: row.coche_defaut,
        ordre: row.ordre,
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

  const { count: nbExistants } = await supabaseAdmin
    .from("kit_items")
    .select("id", { count: "exact", head: true })
    .eq("kit_id", kitId);

  const { error } = await supabaseAdmin
    .from("kit_items")
    .insert({ kit_id: kitId, produit_id: produitId, quantite_defaut: quantite, ordre: nbExistants ?? 0 });
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

export type KitItemPatch = {
  libelle_besoin?: string | null;
  groupe_affichage?: string | null;
  section?: SectionKitItem;
  coche_defaut?: boolean;
};

export async function modifierKitItem(id: number, patch: KitItemPatch): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("kit_items").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cet article." };
  return { ok: true };
}

// Remplacer le produit d'une ligne (produit épuisé) en gardant ses réglages
// (quantité, section, groupe, libellé, coché) : même garde-fous que l'ajout.
export async function remplacerKitItemProduit(id: number, nouveauProduitId: number): Promise<ActionResult> {
  await requireAdmin();

  const { data: produit } = await supabaseAdmin
    .from("produits")
    .select("edition_statut")
    .eq("id", nouveauProduitId)
    .maybeSingle();
  if (produit?.edition_statut === "ancienne") {
    return { ok: false, error: "Impossible d'utiliser une ancienne édition dans un kit." };
  }
  const { count } = await supabaseAdmin
    .from("produit_variantes")
    .select("id", { count: "exact", head: true })
    .eq("produit_id", nouveauProduitId);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Impossible d'utiliser un produit à variantes (taille/couleur) dans un kit." };
  }

  const { error } = await supabaseAdmin.from("kit_items").update({ produit_id: nouveauProduitId }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de remplacer cet article (déjà présent dans le kit ?)." };
  return { ok: true };
}

// Monter/descendre une ligne : permute sa position dans la liste affichée
// (déjà triée par `ordre`) puis réécrit `ordre` = position pour tous les
// items du kit. Ne suppose pas des valeurs `ordre` distinctes au départ (les
// lignes ajoutées via ajouterKitItem partagent parfois le même 0).
export async function deplacerKitItem(kitId: number, idsOrdonnes: number[], id: number, direction: -1 | 1): Promise<ActionResult> {
  await requireAdmin();
  const index = idsOrdonnes.indexOf(id);
  const cible = index + direction;
  if (index === -1 || cible < 0 || cible >= idsOrdonnes.length) return { ok: true };

  const reordonnes = [...idsOrdonnes];
  [reordonnes[index], reordonnes[cible]] = [reordonnes[cible], reordonnes[index]];

  const erreurs = await Promise.all(
    reordonnes.map((itemId, ordre) =>
      supabaseAdmin.from("kit_items").update({ ordre }).eq("id", itemId).eq("kit_id", kitId),
    ),
  );
  if (erreurs.some((r) => r.error)) return { ok: false, error: "Impossible de réordonner." };
  return { ok: true };
}

// Glisser-déposer (PROMPT_ADMIN_KITS_PRODUITS.md lot 2) : reçoit l'ordre final
// complet des ids (déjà réordonné côté client) et réécrit `ordre` pour tous.
export async function reordonnerKitItems(kitId: number, idsOrdonnes: number[]): Promise<ActionResult> {
  await requireAdmin();
  const erreurs = await Promise.all(
    idsOrdonnes.map((itemId, ordre) =>
      supabaseAdmin.from("kit_items").update({ ordre }).eq("id", itemId).eq("kit_id", kitId),
    ),
  );
  if (erreurs.some((r) => r.error)) return { ok: false, error: "Impossible de réordonner." };
  return { ok: true };
}

// --- Changements en masse (ADMIN.md Lot 2) -----------------------------

// Liste des kits utilisant un produit — sert d'aperçu avant de valider un
// remplacement global.
export async function getKitsUtilisantProduit(produitId: number): Promise<{ id: number; nom: string }[]> {
  await requireAdmin();
  const { data: items } = await supabaseAdmin
    .from("kit_items")
    .select("kit_id")
    .eq("produit_id", produitId);
  const kitIds = [...new Set((items ?? []).map((i) => i.kit_id))];
  if (kitIds.length === 0) return [];
  const { data: kits } = await supabaseAdmin.from("kits").select("id, nom").in("id", kitIds);
  return kits ?? [];
}

// Remplace un produit par un autre dans tous les kits où il apparaît (produit
// épuisé/retiré du catalogue). Si le kit contient déjà le nouveau produit, la
// ligne de l'ancien est simplement retirée (pas de doublon).
export async function remplacerProduitPartout(
  ancienProduitId: number,
  nouveauProduitId: number,
): Promise<ActionResult & { nb?: number }> {
  await requireAdmin();
  if (ancienProduitId === nouveauProduitId) return { ok: false, error: "Choisir un produit différent." };

  const { data: produit } = await supabaseAdmin
    .from("produits")
    .select("edition_statut")
    .eq("id", nouveauProduitId)
    .maybeSingle();
  if (produit?.edition_statut === "ancienne") {
    return { ok: false, error: "Impossible d'utiliser une ancienne édition dans un kit." };
  }
  const { count } = await supabaseAdmin
    .from("produit_variantes")
    .select("id", { count: "exact", head: true })
    .eq("produit_id", nouveauProduitId);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Impossible d'utiliser un produit à variantes (taille/couleur) dans un kit." };
  }

  const { data: lignes } = await supabaseAdmin
    .from("kit_items")
    .select("id, kit_id")
    .eq("produit_id", ancienProduitId);
  if (!lignes || lignes.length === 0) return { ok: true, nb: 0 };

  const { data: lignesExistantes } = await supabaseAdmin
    .from("kit_items")
    .select("kit_id")
    .eq("produit_id", nouveauProduitId)
    .in(
      "kit_id",
      lignes.map((l) => l.kit_id),
    );
  const kitsAvecNouveauDeja = new Set((lignesExistantes ?? []).map((l) => l.kit_id));

  const aSupprimer = lignes.filter((l) => kitsAvecNouveauDeja.has(l.kit_id)).map((l) => l.id);
  const aRemplacer = lignes.filter((l) => !kitsAvecNouveauDeja.has(l.kit_id)).map((l) => l.id);

  if (aSupprimer.length > 0) {
    await supabaseAdmin.from("kit_items").delete().in("id", aSupprimer);
  }
  if (aRemplacer.length > 0) {
    await supabaseAdmin.from("kit_items").update({ produit_id: nouveauProduitId }).in("id", aRemplacer);
  }
  return { ok: true, nb: lignes.length };
}

// Mosaïque d'images du kit (migration 0090) : jusqu'à 4 ids produits, choisis
// parmi les articles du kit.
export async function modifierImagesMosaique(kitId: number, produitIds: number[]): Promise<ActionResult> {
  await requireAdmin();
  if (produitIds.length > 4) return { ok: false, error: "4 images maximum." };
  const { error } = await supabaseAdmin
    .from("kits")
    .update({ images_mosaique: produitIds.length > 0 ? produitIds : null })
    .eq("id", kitId);
  if (error) return { ok: false, error: "Impossible d'enregistrer la mosaïque." };
  return { ok: true };
}
