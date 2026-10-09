import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGammeDef } from "@/lib/gammes";
import { calculerPrixKit, type LigneKit } from "@/lib/kits";
import type { Produit } from "@/lib/supabase/types";

// Export Excel des kits (PROMPT_EXPORTS_ET_CORRECTIONS.md Lot 1) : onglet
// "Kits" (un résumé par kit) + onglet "Contenu des kits" (une ligne par
// article), même format que scripts/exporter-kits-excel.mjs pour rester
// compatible avec le fichier `kits_sacado_final.xlsx` déjà connu du fondateur.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABELS_CYCLE: Record<string, string> = {
  prescolaire: "Préscolaire",
  elementaire: "Élémentaire",
  college: "Collège",
  lycee: "Lycée",
};

const LIBELLE_SECTION: Record<string, string> = {
  principal: "Principal",
  livres_proposes: "Livres proposés",
  option: "Option",
};

// Seul marqueur disponible à la lecture pour reconnaître les lignes "cahiers"
// (voir lib/kits.ts, GROUPE_CAHIERS).
const GROUPE_CAHIERS = "Cahiers";

type ProduitLite = { nom: string; prix: number; stock: number; statut_publication: string };
type ItemRow = {
  kit_id: number;
  produit_id: number;
  quantite_defaut: number;
  libelle_besoin: string | null;
  groupe_affichage: string | null;
  section: string;
  coche_defaut: boolean;
  ordre: number;
  produits: ProduitLite | ProduitLite[] | null;
};

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { data: kits } = await supabaseAdmin
    .from("kits")
    .select("id, cycle, niveau, gamme, nom, statut, description")
    .order("cycle")
    .order("niveau");

  // PostgREST tronque silencieusement un select() sans range() au-delà de
  // 1 000 lignes (même piège que getProduitsAdmin, cf. lib/admin/produits-
  // actions.ts) : kit_items dépasse largement ce seuil (2 700+ lignes), d'où
  // l'export arrêté à 1 000 lignes constaté. On pagine jusqu'à la dernière ligne.
  const TAILLE_PAGE = 1000;
  const items: ItemRow[] = [];
  for (let offset = 0; ; offset += TAILLE_PAGE) {
    const { data: page } = await supabaseAdmin
      .from("kit_items")
      .select(
        "kit_id, produit_id, quantite_defaut, libelle_besoin, groupe_affichage, section, coche_defaut, ordre, produits(nom, prix, stock, statut_publication)",
      )
      .order("ordre")
      .range(offset, offset + TAILLE_PAGE - 1);
    const lot = (page ?? []) as unknown as ItemRow[];
    items.push(...lot);
    if (lot.length < TAILLE_PAGE) break;
  }

  const itemsParKit = new Map<number, ItemRow[]>();
  for (const item of items) {
    const liste = itemsParKit.get(item.kit_id) ?? [];
    liste.push(item);
    itemsParKit.set(item.kit_id, liste);
  }

  const lignesKits: Record<string, string | number>[] = [];
  const lignesContenu: Record<string, string | number>[] = [];

  for (const kit of kits ?? []) {
    const contenu = itemsParKit.get(kit.id) ?? [];
    const cycleLabel = LABELS_CYCLE[kit.cycle] ?? kit.cycle;
    const gammeLabel = getGammeDef(kit.gamme)?.label ?? kit.gamme;

    const ligneKit: LigneKit[] = contenu
      .map((item) => {
        const produit = Array.isArray(item.produits) ? item.produits[0] : item.produits;
        if (!produit) return null;
        return {
          item: {
            quantite_defaut: item.quantite_defaut,
            coche_defaut: item.coche_defaut,
            section: item.section as LigneKit["item"]["section"],
            groupe_affichage: item.groupe_affichage,
            ordre: item.ordre,
          },
          produit: produit as unknown as Produit,
        };
      })
      .filter((l): l is LigneKit => l !== null);
    const { total: totalCoche } = calculerPrixKit(ligneKit);

    const nbCahiers = contenu
      .filter((item) => item.groupe_affichage === GROUPE_CAHIERS)
      .reduce((somme, item) => somme + item.quantite_defaut, 0);

    lignesKits.push({
      ID: kit.id,
      Cycle: cycleLabel,
      Classe: kit.niveau,
      Gamme: gammeLabel,
      Nom: kit.nom,
      Statut: kit.statut === "publie" ? "Publié" : "Masqué",
      Description: kit.description ?? "",
      "Nombre de lignes": contenu.length,
      "Nombre de cahiers": nbCahiers,
      "Total coché (FCFA)": totalCoche,
    });

    if (contenu.length === 0) {
      lignesContenu.push({
        Cycle: cycleLabel,
        Classe: kit.niveau,
        Gamme: gammeLabel,
        Kit: kit.nom,
        "ID kit": kit.id,
        Ordre: "",
        Groupe: "",
        "ID produit": "",
        Produit: "(aucun article)",
        Quantité: "",
        "Prix unitaire (FCFA)": "",
        Section: "",
        "Coché par défaut": "",
        "Libellé besoin": "",
        Stock: "",
        Visible: "",
      });
      continue;
    }
    for (const item of contenu) {
      const produit = Array.isArray(item.produits) ? item.produits[0] : item.produits;
      lignesContenu.push({
        Cycle: cycleLabel,
        Classe: kit.niveau,
        Gamme: gammeLabel,
        Kit: kit.nom,
        "ID kit": kit.id,
        Ordre: item.ordre,
        Groupe: item.groupe_affichage ?? "",
        "ID produit": item.produit_id,
        Produit: produit?.nom ?? `(produit ${item.produit_id} introuvable)`,
        Quantité: item.quantite_defaut,
        "Prix unitaire (FCFA)": produit?.prix ?? "",
        Section: LIBELLE_SECTION[item.section] ?? item.section,
        "Coché par défaut": item.coche_defaut ? "Oui" : "Non",
        "Libellé besoin": item.libelle_besoin ?? "",
        Stock: produit?.stock ?? "",
        Visible: produit ? (produit.statut_publication === "publie" ? "Oui" : "Non") : "",
      });
    }
  }

  const classeur = XLSX.utils.book_new();

  const feuilleKits = XLSX.utils.json_to_sheet(lignesKits);
  feuilleKits["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 32 },
    { wch: 10 },
    { wch: 42 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(classeur, feuilleKits, "Kits");

  const feuilleContenu = XLSX.utils.json_to_sheet(lignesContenu);
  feuilleContenu["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
    { wch: 8 },
    { wch: 8 },
    { wch: 16 },
    { wch: 10 },
    { wch: 42 },
    { wch: 9 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 },
    { wch: 8 },
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(classeur, feuilleContenu, "Contenu des kits");

  const buffer = XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sacado_kits_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
