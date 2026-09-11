import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifierEvenementClient } from "@/lib/messages/notifier-evenement";
import { origineSite } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Favori de retour en stock, regroupé par client (TACHE_notifications_client.md
// §7 : « une seule notification qui les regroupe »). Appelée 1×/jour à 9h par le
// pg_cron `drain_retours_stock` via pg_net (migration 0065) — jamais par un client.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_PUSH_SECRET) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  const { data: retours, error } = await supabaseAdmin
    .from("retours_stock")
    .select("id, produit_id")
    .eq("traite", false)
    .limit(2000);

  if (error) {
    console.error("Drainage retours stock : lecture échouée", error);
    return Response.json({ error: "lecture échouée" }, { status: 500 });
  }
  if (!retours || retours.length === 0) {
    return Response.json({ ok: true, clients: 0 });
  }

  const produitIds = [...new Set(retours.map((r) => r.produit_id as number))];

  const { data: favoris } = await supabaseAdmin
    .from("favoris_compte")
    .select("client_id, produit_id")
    .in("produit_id", produitIds);

  const parClient = new Map<number, number[]>();
  for (const f of favoris ?? []) {
    const clientId = f.client_id as number;
    const liste = parClient.get(clientId) ?? [];
    liste.push(f.produit_id as number);
    parClient.set(clientId, liste);
  }

  const origine = await origineSite();

  for (const [clientId, produitIdsClient] of parClient) {
    const { data: produits } = await supabaseAdmin
      .from("produits")
      .select("id, nom")
      .in("id", produitIdsClient);
    const noms = (produits ?? []).map((p) => p.nom as string);
    const lien =
      produitIdsClient.length === 1 ? `${origine}/produit/${produitIdsClient[0]}` : `${origine}/favoris`;

    await notifierEvenementClient({
      clientId,
      code: "favori_restock",
      variables: { articles: noms.join(", ") },
      lien,
    });
  }

  await supabaseAdmin
    .from("retours_stock")
    .update({ traite: true })
    .in(
      "id",
      retours.map((r) => r.id as number),
    );

  return Response.json({ ok: true, clients: parClient.size, produits: produitIds.length });
}
