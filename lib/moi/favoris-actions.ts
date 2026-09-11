"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { identiteSession } from "@/lib/session-identite";

// Favoris en base (migration 0064, TACHE_notifications_client.md §2) : anonyme
// par session tant que le visiteur n'a pas commandé, puis unifié par compte —
// aucune identité à fournir, tout part du cookie de session.

export async function getFavorisAction(): Promise<number[]> {
  const { sessionId, clientId } = await identiteSession();

  if (clientId) {
    const { data } = await supabaseAdmin
      .from("favoris_compte")
      .select("produit_id")
      .eq("client_id", clientId);
    return (data ?? []).map((r) => r.produit_id as number);
  }
  if (!sessionId) return [];

  const { data } = await supabaseAdmin
    .from("favoris_session")
    .select("produit_id")
    .eq("session_id", sessionId);
  return (data ?? []).map((r) => r.produit_id as number);
}

export async function toggleFavoriAction(produitId: number): Promise<{ ok: boolean; actif: boolean }> {
  if (!Number.isInteger(produitId) || produitId <= 0) return { ok: false, actif: false };

  const { sessionId, clientId } = await identiteSession();
  if (!clientId && !sessionId) return { ok: false, actif: false };

  const table = clientId ? "favoris_compte" : "favoris_session";
  const cle: Record<string, number | string> = clientId
    ? { client_id: clientId }
    : { session_id: sessionId as string };

  const { data: existant } = await supabaseAdmin
    .from(table)
    .select("produit_id")
    .match({ ...cle, produit_id: produitId })
    .maybeSingle();

  if (existant) {
    const { error } = await supabaseAdmin.from(table).delete().match({ ...cle, produit_id: produitId });
    return { ok: !error, actif: Boolean(error) };
  }

  const { error } = await supabaseAdmin.from(table).insert({ ...cle, produit_id: produitId });
  return { ok: !error, actif: !error };
}
