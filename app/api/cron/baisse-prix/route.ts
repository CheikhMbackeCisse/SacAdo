import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifierEvenementClient } from "@/lib/messages/notifier-evenement";
import { origineSite } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Baisse de prix sur un produit consulté (TACHE_notifications_client.md §2).
// Une notification par (client, produit) — le modèle référence un prix précis,
// contrairement au retour en stock qui se regroupe. Le plafond commercial
// (2/mois, notifier-evenement.ts) empêche naturellement tout débordement.
// Appelée 1×/jour à 9h30 par le pg_cron `drain_baisses_prix` via pg_net
// (migration 0066) — jamais par un client.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_PUSH_SECRET) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  const { data: baisses, error } = await supabaseAdmin
    .from("baisses_prix")
    .select("id, produit_id, nouveau_prix")
    .eq("traite", false)
    .order("id", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("Drainage baisses de prix : lecture échouée", error);
    return Response.json({ error: "lecture échouée" }, { status: 500 });
  }
  if (!baisses || baisses.length === 0) {
    return Response.json({ ok: true, notifies: 0 });
  }

  // Dernier prix connu par produit (si plusieurs baisses du même produit dans
  // le lot, triées par id croissant : la dernière écrasant les précédentes).
  const dernierPrixParProduit = new Map<number, number>();
  for (const b of baisses) dernierPrixParProduit.set(b.produit_id as number, b.nouveau_prix as number);
  const produitIds = [...dernierPrixParProduit.keys()];

  const { data: vues } = await supabaseAdmin
    .from("consultes_compte")
    .select("client_id, produit_id")
    .in("produit_id", produitIds);

  const origine = await origineSite();
  let notifies = 0;

  for (const v of vues ?? []) {
    const produitId = v.produit_id as number;
    const prix = dernierPrixParProduit.get(produitId);
    if (prix == null) continue;

    await notifierEvenementClient({
      clientId: v.client_id as number,
      code: "baisse_prix",
      variables: { montant: Math.round(prix).toLocaleString("fr-FR") },
      lien: `${origine}/produit/${produitId}`,
    });
    notifies += 1;
  }

  await supabaseAdmin
    .from("baisses_prix")
    .update({ traite: true })
    .in(
      "id",
      baisses.map((b) => b.id as number),
    );

  return Response.json({ ok: true, notifies, produits: produitIds.length });
}
