"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Badges de nouveauté (PROMPT_ADMIN Lot 2) : combien de commandes/livraisons
// le fondateur n'a pas encore vues depuis sa dernière visite de l'onglet.
// "Vu" = id <= dernier_id_vu (admin_etat_lecture, migration 0104).

type Section = "commandes" | "livraisons";

const STATUT_PAR_SECTION: Record<Section, string> = {
  commandes: "recue",
  livraisons: "livraison",
};

export type Badges = { commandes: number; livraisons: number };

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
    .eq("statut", STATUT_PAR_SECTION[section])
    .gt("id", vu);
  return count ?? 0;
}

export async function getBadges(): Promise<Badges> {
  const user = await requireAdmin();
  const [commandes, livraisons] = await Promise.all([
    compterNonVues(user.id, "commandes"),
    compterNonVues(user.id, "livraisons"),
  ]);
  return { commandes, livraisons };
}

export async function marquerSectionVue(section: Section): Promise<void> {
  const user = await requireAdmin();

  const [{ data: max }, vuActuel] = await Promise.all([
    supabaseAdmin
      .from("commandes")
      .select("id")
      .eq("statut", STATUT_PAR_SECTION[section])
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
