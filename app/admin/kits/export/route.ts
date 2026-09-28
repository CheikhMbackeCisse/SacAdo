import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Export Excel du contenu de tous les kits (ADMIN.md Lot 2), même format que
// scripts/exporter-kits-excel.mjs — pour rester compatible avec le fichier
// `kits_sacado_final.xlsx` déjà connu du fondateur.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIBELLE_SECTION: Record<string, string> = {
  principal: "Principal",
  livres_proposes: "Livres proposés",
  option: "Option",
};

type Produit = { nom: string; prix: number };
type ItemRow = {
  kit_id: number;
  produit_id: number;
  quantite_defaut: number;
  libelle_besoin: string | null;
  groupe_affichage: string | null;
  section: string;
  coche_defaut: boolean;
  produits: Produit | Produit[] | null;
};

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { data: kits } = await supabaseAdmin
    .from("kits")
    .select("id, cycle, niveau, gamme, nom, statut")
    .order("cycle")
    .order("niveau");
  const { data: items } = await supabaseAdmin
    .from("kit_items")
    .select(
      "kit_id, produit_id, quantite_defaut, libelle_besoin, groupe_affichage, section, coche_defaut, ordre, produits(nom, prix)",
    )
    .order("ordre");

  const itemsParKit = new Map<number, ItemRow[]>();
  for (const item of (items ?? []) as unknown as ItemRow[]) {
    const liste = itemsParKit.get(item.kit_id) ?? [];
    liste.push(item);
    itemsParKit.set(item.kit_id, liste);
  }

  const lignes: Record<string, string | number>[] = [];
  for (const kit of kits ?? []) {
    const contenu = itemsParKit.get(kit.id) ?? [];
    if (contenu.length === 0) {
      lignes.push({
        Cycle: kit.cycle,
        Niveau: kit.niveau,
        Gamme: kit.gamme,
        Kit: kit.nom,
        Statut: kit.statut === "publie" ? "Publié" : "Masqué",
        Groupe: "",
        Produit: "(aucun article)",
        Quantité: "",
        "Prix unitaire (FCFA)": "",
        Section: "",
        "Coché par défaut": "",
        "Libellé besoin": "",
      });
      continue;
    }
    for (const item of contenu) {
      const produit = Array.isArray(item.produits) ? item.produits[0] : item.produits;
      lignes.push({
        Cycle: kit.cycle,
        Niveau: kit.niveau,
        Gamme: kit.gamme,
        Kit: kit.nom,
        Statut: kit.statut === "publie" ? "Publié" : "Masqué",
        Groupe: item.groupe_affichage ?? "",
        Produit: produit?.nom ?? `(produit ${item.produit_id} introuvable)`,
        Quantité: item.quantite_defaut,
        "Prix unitaire (FCFA)": produit?.prix ?? "",
        Section: LIBELLE_SECTION[item.section] ?? item.section,
        "Coché par défaut": item.coche_defaut ? "Oui" : "Non",
        "Libellé besoin": item.libelle_besoin ?? "",
      });
    }
  }

  const feuille = XLSX.utils.json_to_sheet(lignes);
  feuille["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
    { wch: 10 },
    { wch: 16 },
    { wch: 42 },
    { wch: 9 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
  ];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Contenu des kits");
  const buffer = XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kits_sacado_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
