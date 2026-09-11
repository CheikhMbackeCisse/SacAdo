import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { envoyerPushClient } from "@/lib/push";
import { journaliserNotification } from "@/lib/messages/journal";

export const dynamic = "force-dynamic";

// Drainage des push différés pendant les heures calmes (TACHE_notifications_client.md
// §7). Appelée à 7h (heure de Dakar) par le pg_cron `drain_push_differes` via
// pg_net (migration 0061) — jamais directement par un client.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_PUSH_SECRET) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  const { data: differes, error } = await supabaseAdmin
    .from("push_differes")
    .select("id, client_id, commande_id, code_modele, titre, corps, url")
    .is("envoye_le", null)
    .order("cree_le", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Drainage push différés : lecture échouée", error);
    return Response.json({ error: "lecture échouée" }, { status: 500 });
  }

  let traites = 0;
  for (const d of differes ?? []) {
    const resultat = await envoyerPushClient(d.client_id as number, {
      title: d.titre as string,
      body: d.corps as string,
      url: d.url as string,
    });
    await supabaseAdmin
      .from("push_differes")
      .update({ envoye_le: new Date().toISOString() })
      .eq("id", d.id as number);

    if (resultat.abonnements > 0) {
      await journaliserNotification({
        clientId: d.client_id as number,
        commandeId: (d.commande_id as number | null) ?? null,
        canal: "push",
        type: (d.code_modele as string | null) ?? "inconnu",
        statut: resultat.echecs >= resultat.abonnements ? "echec" : "envoye",
        detail: "différé (heures calmes)",
      });
    }
    traites += 1;
  }

  return Response.json({ ok: true, traites });
}
