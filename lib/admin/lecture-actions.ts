"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Badges de nouveauté (PROMPT_ADMIN Lot 2, formule du badge Commandes mise à
// jour par PROMPT_ADMIN_V2 Lot 1) : combien de commandes à traiter le
// fondateur n'a pas encore vues depuis sa dernière visite de l'onglet.
// "Vu" = id <= dernier_id_vu (admin_etat_lecture, migration 0104).

type Section = "commandes";

// Commandes à traiter = à confirmer par appel + payées (ou confirmées) à
// préparer. 'paiement_en_attente' (Wave pas encore confirmé) ne compte pas :
// rien à faire tant que le webhook n'a pas tranché.
const STATUTS_PAR_SECTION: Record<Section, string[]> = {
  commandes: ["a_confirmer_appel", "recue"],
};

export type Badges = { commandes: number };

async function dernierIdVu(adminUserId: string, section: Section): Promise<number> {
  const { data } = await supabaseAdmin
    .from("admin_etat_lecture")
    .select("dernier_id_vu")
    .eq("admin_user_id", adminUserId)
    .eq("section", section)
    .maybeSingle();
  return data?.dernier_id_vu ?? 0;
}

async function compterNonVues(adminUserId: string, section: Section): Promise<number> {
  const vu = await dernierIdVu(adminUserId, section);
  const { count } = await supabaseAdmin
    .from("commandes")
    .select("id", { count: "exact", head: true })
    .in("statut", STATUTS_PAR_SECTION[section])
    .gt("id", vu);
  return count ?? 0;
}

export async function getBadges(): Promise<Badges> {
  const user = await requireAdmin();
  const commandes = await compterNonVues(user.id, "commandes");
  return { commandes };
}

export async function marquerSectionVue(section: Section): Promise<void> {
  const user = await requireAdmin();

  const [{ data: max }, vuActuel] = await Promise.all([
    supabaseAdmin
      .from("commandes")
      .select("id")
      .in("statut", STATUTS_PAR_SECTION[section])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    dernierIdVu(user.id, section),
  ]);

  // Jamais à la baisse : un id max plus petit (ex. plus aucune commande dans ce
  // statut) ne doit pas faire réapparaître comme "non vu" ce qui l'était déjà.
  const nouveauVu = Math.max(max?.id ?? 0, vuActuel);

  await supabaseAdmin.from("admin_etat_lecture").upsert(
    {
      admin_user_id: user.id,
      section,
      dernier_id_vu: nouveauVu,
      maj_le: new Date().toISOString(),
    },
    { onConflict: "admin_user_id,section" },
  );
}
