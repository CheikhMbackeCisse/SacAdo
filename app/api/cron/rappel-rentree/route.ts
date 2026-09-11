import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifierEvenementClient } from "@/lib/messages/notifier-evenement";
import { origineSite } from "@/lib/site-url";
import { cycleDeNiveau } from "@/lib/niveau";

export const dynamic = "force-dynamic";

// Rappel de rentrée par bénéficiaire (TACHE_notifications_client.md §2). Un
// rappel par enfant, une seule fois par année scolaire (rappels_rentree_envoyes,
// migration 0067). Appelée par le pg_cron `drain_rappels_rentree` (8h) via
// pg_net — seulement quand la saison « Rentrée scolaire » est active (vérifié
// côté SQL avant d'appeler cette route) — jamais par un client.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_PUSH_SECRET) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  const annee = new Date().getUTCFullYear();

  const { data: beneficiaires, error } = await supabaseAdmin
    .from("beneficiaires")
    .select("id, compte_id, prenom, niveau")
    .eq("actif", true);

  if (error) {
    console.error("Rappel de rentrée : lecture échouée", error);
    return Response.json({ error: "lecture échouée" }, { status: 500 });
  }
  if (!beneficiaires || beneficiaires.length === 0) {
    return Response.json({ ok: true, envoyes: 0 });
  }

  const { data: dejaEnvoyes } = await supabaseAdmin
    .from("rappels_rentree_envoyes")
    .select("beneficiaire_id")
    .eq("annee", annee)
    .in(
      "beneficiaire_id",
      beneficiaires.map((b) => b.id as number),
    );
  const dejaSet = new Set((dejaEnvoyes ?? []).map((r) => r.beneficiaire_id as number));

  const origine = await origineSite();
  let envoyes = 0;

  for (const b of beneficiaires) {
    const id = b.id as number;
    if (dejaSet.has(id)) continue;

    const niveau = b.niveau as string | null;
    const cycle = niveau ? cycleDeNiveau(niveau) : null;
    const lien = cycle && niveau ? `${origine}/kits/${cycle}/${encodeURIComponent(niveau)}` : `${origine}/kits`;

    await notifierEvenementClient({
      clientId: b.compte_id as number,
      code: "rappel_rentree",
      variables: { prenom: (b.prenom as string) || "" },
      lien,
    });

    const { error: insertError } = await supabaseAdmin
      .from("rappels_rentree_envoyes")
      .insert({ beneficiaire_id: id, annee });
    if (!insertError) envoyes += 1;
  }

  return Response.json({ ok: true, envoyes });
}
