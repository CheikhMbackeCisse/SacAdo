"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CanalJournal, StatutJournal } from "@/lib/messages/journal";

// Tableau de bord notifications (TACHE_notifications_client.md §9), sur 7 jours.

const CANAUX: CanalJournal[] = ["push", "whatsapp", "inbox"];
const STATUTS: StatutJournal[] = ["envoye", "echec", "differe", "bloque_preference"];

export type StatsCanal = { canal: CanalJournal } & Record<StatutJournal, number>;

export type StatsNotifications = {
  depuisLe: string;
  parCanal: StatsCanal[];
  tauxEchecPush: number | null; // null = aucun envoi push sur la période
  totalBloquePreference: number;
};

function bucketVide(canal: CanalJournal): StatsCanal {
  return { canal, envoye: 0, echec: 0, differe: 0, bloque_preference: 0 };
}

export async function getStatsNotifications(): Promise<StatsNotifications> {
  await requireAdmin();

  const depuisLe = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("journal_notifications")
    .select("canal, statut")
    .gte("cree_le", depuisLe)
    .limit(10000);

  const rows = (data ?? []) as { canal: CanalJournal; statut: StatutJournal }[];

  const parCanalMap = new Map<CanalJournal, StatsCanal>(CANAUX.map((c) => [c, bucketVide(c)]));
  for (const r of rows) {
    const bucket = parCanalMap.get(r.canal);
    if (bucket && STATUTS.includes(r.statut)) bucket[r.statut] += 1;
  }

  const push = parCanalMap.get("push")!;
  const totalPushTraites = push.envoye + push.echec;

  return {
    depuisLe,
    parCanal: CANAUX.map((c) => parCanalMap.get(c)!),
    tauxEchecPush: totalPushTraites > 0 ? push.echec / totalPushTraites : null,
    totalBloquePreference: rows.filter((r) => r.statut === "bloque_preference").length,
  };
}
