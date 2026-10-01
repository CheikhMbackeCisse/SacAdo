import "server-only";
import * as XLSX from "xlsx";
import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ajouterKitItem,
  creerKit,
  modifierKitItem,
  modifierKitItemQuantite,
  retirerKitItem,
  togglerStatutKit,
  type KitItemPatch,
} from "./kits-actions";
import type { ActionResult } from "./produits-actions";
import type { Cycle, Gamme, SectionKitItem, StatutKit } from "@/lib/supabase/types";

// Import Excel du contenu des kits (PROMPT_ADMIN.md Lot 5), même format que
// l'export (app/admin/kits/export/route.ts). Deux passes : analyserImportKits
// calcule un diff en lecture seule (aperçu obligatoire avant d'écrire),
// appliquerImportKits rejoue le même calcul puis écrit — jamais de suppression
// de kit (CLAUDE.md §Règles), seulement un masquage si absent du fichier.

const LABELS_SECTION_INVERSE: Record<string, SectionKitItem> = {
  Principal: "principal",
  "Livres proposés": "livres_proposes",
  Option: "option",
};

type LigneImport = {
  cycle: Cycle;
  niveau: string;
  gamme: Gamme;
  nom: string;
  statut: StatutKit;
  produitNom: string;
  quantite: number;
  groupe: string | null;
  section: SectionKitItem;
  cocheDefaut: boolean;
  libelleBesoin: string | null;
};

function lireFichier(buffer: Buffer): LigneImport[] {
  const classeur = XLSX.read(buffer, { type: "buffer" });
  const feuille = classeur.Sheets[classeur.SheetNames[0]];
  const lignes = XLSX.utils.sheet_to_json<Record<string, string | number>>(feuille);

  const resultat: LigneImport[] = [];
  for (const l of lignes) {
    const produitNom = String(l["Produit"] ?? "").trim();
    if (!produitNom || produitNom === "(aucun article)") continue;
    resultat.push({
      cycle: String(l["Cycle"] ?? "").trim() as Cycle,
      niveau: String(l["Niveau"] ?? "").trim(),
      gamme: String(l["Gamme"] ?? "").trim() as Gamme,
      nom: String(l["Kit"] ?? "").trim(),
      statut: String(l["Statut"] ?? "").trim() === "Publié" ? "publie" : "masque",
      produitNom,
      quantite: Number(l["Quantité"]) || 1,
      groupe: String(l["Groupe"] ?? "").trim() || null,
      section: LABELS_SECTION_INVERSE[String(l["Section"] ?? "").trim()] ?? "principal",
      cocheDefaut: String(l["Coché par défaut"] ?? "").trim() === "Oui",
      libelleBesoin: String(l["Libellé besoin"] ?? "").trim() || null,
    });
  }
  return resultat;
}

type ItemExistant = {
  id: number;
  produit_id: number;
  produit_nom: string;
  quantite_defaut: number;
  groupe_affichage: string | null;
  section: SectionKitItem;
  coche_defaut: boolean;
  libelle_besoin: string | null;
};

type KitExistant = {
  id: number;
  cycle: Cycle;
  niveau: string;
  gamme: Gamme;
  nom: string;
  statut: StatutKit;
  items: ItemExistant[];
};

async function chargerEtat(): Promise<{ kits: KitExistant[]; produitsParNom: Map<string, number> }> {
  const { data: kits } = await supabaseAdmin
    .from("kits")
    .select("id, cycle, niveau, gamme, nom, statut");
  const { data: items } = await supabaseAdmin
    .from("kit_items")
    .select("id, kit_id, produit_id, quantite_defaut, groupe_affichage, section, coche_defaut, libelle_besoin, produit:produits(nom)");
  const { data: produits } = await supabaseAdmin.from("produits").select("id, nom");

  const produitsParNom = new Map<string, number>();
  for (const p of produits ?? []) produitsParNom.set(p.nom.trim(), p.id);

  type Row = Omit<ItemExistant, "produit_nom"> & {
    kit_id: number;
    produit: { nom: string } | { nom: string }[] | null;
  };
  const itemsParKit = new Map<number, ItemExistant[]>();
  for (const row of (items ?? []) as unknown as Row[]) {
    const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
    if (!produit) continue;
    const liste = itemsParKit.get(row.kit_id) ?? [];
    liste.push({
      id: row.id,
      produit_id: row.produit_id,
      produit_nom: produit.nom,
      quantite_defaut: row.quantite_defaut,
      groupe_affichage: row.groupe_affichage,
      section: row.section,
      coche_defaut: row.coche_defaut,
      libelle_besoin: row.libelle_besoin,
    });
    itemsParKit.set(row.kit_id, liste);
  }

  return {
    kits: (kits ?? []).map((k) => ({ ...k, items: itemsParKit.get(k.id) ?? [] })),
    produitsParNom,
  };
}

export type DiffItem = {
  produitNom: string;
  avant?: { quantite: number; section: SectionKitItem; groupe: string | null; cocheDefaut: boolean; libelleBesoin: string | null };
  apres?: { quantite: number; section: SectionKitItem; groupe: string | null; cocheDefaut: boolean; libelleBesoin: string | null };
};

export type DiffKit = {
  cle: string;
  kitId: number | null;
  nom: string;
  nouveau: boolean;
  statutActuel: StatutKit | null;
  statutImporte: StatutKit;
  itemsAjoutes: DiffItem[];
  itemsModifies: DiffItem[];
  itemsRetires: DiffItem[];
  produitsIntrouvables: string[];
};

export type ApercuImport = {
  kits: DiffKit[];
  kitsAbsentsDuFichier: { id: number; nom: string }[];
  erreur?: string;
};

function regrouperImport(lignes: LigneImport[]): Map<string, LigneImport[]> {
  const parKit = new Map<string, LigneImport[]>();
  for (const l of lignes) {
    const cle = `${l.cycle}|${l.niveau}|${l.gamme}`;
    parKit.set(cle, [...(parKit.get(cle) ?? []), l]);
  }
  return parKit;
}

function egal(a: DiffItem["avant"], b: DiffItem["apres"]): boolean {
  if (!a || !b) return false;
  return (
    a.quantite === b.quantite &&
    a.section === b.section &&
    a.groupe === b.groupe &&
    a.cocheDefaut === b.cocheDefaut &&
    a.libelleBesoin === b.libelleBesoin
  );
}

async function calculerDiff(buffer: Buffer): Promise<ApercuImport> {
  const lignes = lireFichier(buffer);
  if (lignes.length === 0) {
    return { kits: [], kitsAbsentsDuFichier: [], erreur: "Fichier vide ou colonnes non reconnues." };
  }
  const { kits: kitsExistants, produitsParNom } = await chargerEtat();
  const parCle = new Map(kitsExistants.map((k) => [`${k.cycle}|${k.niveau}|${k.gamme}`, k]));
  const importGroupe = regrouperImport(lignes);

  const diffKits: DiffKit[] = [];
  for (const [cle, lignesKit] of importGroupe) {
    const existant = parCle.get(cle);
    const premiere = lignesKit[0];
    const produitsIntrouvables = lignesKit
      .map((l) => l.produitNom)
      .filter((nom) => !produitsParNom.has(nom));

    const itemsExistantsParNom = new Map((existant?.items ?? []).map((i) => [i.produit_nom, i]));
    const nomsImportes = new Set(lignesKit.map((l) => l.produitNom));

    const itemsAjoutes: DiffItem[] = [];
    const itemsModifies: DiffItem[] = [];
    for (const l of lignesKit) {
      const apres = {
        quantite: l.quantite,
        section: l.section,
        groupe: l.groupe,
        cocheDefaut: l.cocheDefaut,
        libelleBesoin: l.libelleBesoin,
      };
      const existantItem = itemsExistantsParNom.get(l.produitNom);
      if (!existantItem) {
        itemsAjoutes.push({ produitNom: l.produitNom, apres });
      } else {
        const avant = {
          quantite: existantItem.quantite_defaut,
          section: existantItem.section,
          groupe: existantItem.groupe_affichage,
          cocheDefaut: existantItem.coche_defaut,
          libelleBesoin: existantItem.libelle_besoin,
        };
        if (!egal(avant, apres)) itemsModifies.push({ produitNom: l.produitNom, avant, apres });
      }
    }
    const itemsRetires: DiffItem[] = (existant?.items ?? [])
      .filter((i) => !nomsImportes.has(i.produit_nom))
      .map((i) => ({
        produitNom: i.produit_nom,
        avant: {
          quantite: i.quantite_defaut,
          section: i.section,
          groupe: i.groupe_affichage,
          cocheDefaut: i.coche_defaut,
          libelleBesoin: i.libelle_besoin,
        },
      }));

    diffKits.push({
      cle,
      kitId: existant?.id ?? null,
      nom: premiere.nom,
      nouveau: !existant,
      statutActuel: existant?.statut ?? null,
      statutImporte: premiere.statut,
      itemsAjoutes,
      itemsModifies,
      itemsRetires,
      produitsIntrouvables,
    });
  }

  const kitsAbsentsDuFichier = kitsExistants
    .filter((k) => !importGroupe.has(`${k.cycle}|${k.niveau}|${k.gamme}`) && k.statut !== "masque")
    .map((k) => ({ id: k.id, nom: k.nom }));

  return { kits: diffKits, kitsAbsentsDuFichier };
}

export async function analyserImportKits(buffer: Buffer): Promise<ApercuImport> {
  await requireAdmin();
  return calculerDiff(buffer);
}

export async function appliquerImportKits(buffer: Buffer): Promise<ActionResult & { resume?: string }> {
  await requireAdmin();
  const apercu = await calculerDiff(buffer);
  if (apercu.erreur) return { ok: false, error: apercu.erreur };

  let kitsCrees = 0;
  let itemsEcrits = 0;
  let itemsRetires = 0;
  let kitsMasques = 0;

  const { produitsParNom } = await chargerEtat();

  for (const diff of apercu.kits) {
    if (diff.produitsIntrouvables.length > 0) continue; // ce kit est ignoré, signalé dans le résumé

    let kitId = diff.kitId;
    if (!kitId) {
      const [cycle, niveau, gamme] = diff.cle.split("|") as [Cycle, string, Gamme];
      const cree = await creerKit({ cycle, gamme, niveau, nom: diff.nom });
      if (!cree.ok || !cree.id) continue;
      kitId = cree.id;
      kitsCrees += 1;
    } else if (diff.statutActuel !== diff.statutImporte) {
      await togglerStatutKit(kitId, diff.statutImporte);
    }

    // Relu une seule fois par kit : les items ajoutés plus bas n'ont pas besoin
    // d'être relus individuellement, on suit juste les ids via produit_id.
    const { kits: etatCourant } = await chargerEtat();
    const itemParNom = new Map((etatCourant.find((k) => k.id === kitId)?.items ?? []).map((i) => [i.produit_nom, i]));

    for (const item of [...diff.itemsAjoutes, ...diff.itemsModifies]) {
      const produitId = produitsParNom.get(item.produitNom);
      if (!produitId || !item.apres) continue;

      const existant = itemParNom.get(item.produitNom);
      const patch: KitItemPatch = {
        section: item.apres.section,
        groupe_affichage: item.apres.groupe,
        coche_defaut: item.apres.cocheDefaut,
        libelle_besoin: item.apres.libelleBesoin,
      };
      if (!existant) {
        const ajout = await ajouterKitItem(kitId, produitId, item.apres.quantite);
        if (ajout.ok) {
          const { kits: relu } = await chargerEtat();
          const nouveauItem = relu.find((k) => k.id === kitId)?.items.find((i) => i.produit_id === produitId);
          if (nouveauItem) await modifierKitItem(nouveauItem.id, patch);
          itemsEcrits += 1;
        }
      } else {
        if (existant.quantite_defaut !== item.apres.quantite) {
          await modifierKitItemQuantite(existant.id, item.apres.quantite);
        }
        await modifierKitItem(existant.id, patch);
        itemsEcrits += 1;
      }
    }

    for (const item of diff.itemsRetires) {
      const existant = itemParNom.get(item.produitNom);
      if (existant) {
        await retirerKitItem(existant.id);
        itemsRetires += 1;
      }
    }
  }

  for (const kit of apercu.kitsAbsentsDuFichier) {
    await togglerStatutKit(kit.id, "masque");
    kitsMasques += 1;
  }

  const kitsIgnores = apercu.kits.filter((k) => k.produitsIntrouvables.length > 0).length;
  const resume = `${kitsCrees} kit(s) créé(s), ${itemsEcrits} ligne(s) ajoutée(s)/modifiée(s), ${itemsRetires} ligne(s) retirée(s), ${kitsMasques} kit(s) masqué(s) (absents du fichier)${
    kitsIgnores > 0 ? `, ${kitsIgnores} kit(s) ignoré(s) (produit introuvable)` : ""
  }.`;
  return { ok: true, resume };
}
