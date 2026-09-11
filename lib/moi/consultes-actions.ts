"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { identiteSession } from "@/lib/session-identite";

// « Déjà consultés » en base (migration 0064). Même identité que les favoris :
// session anonyme puis compte, sans rien à fournir côté appelant.

const CONSULTES_MAX = 20;

export type ConsulteAction = { id: number; date: string };

export async function getConsultesAction(): Promise<ConsulteAction[]> {
  const { sessionId, clientId } = await identiteSession();

  const table = clientId ? "consultes_compte" : "consultes_session";
  const colonne = clientId ? "client_id" : "session_id";
  const valeur = clientId ?? sessionId;
  if (!valeur) return [];

  const { data } = await supabaseAdmin
    .from(table)
    .select("produit_id, vu_le")
    .eq(colonne, valeur)
    .order("vu_le", { ascending: false })
    .limit(CONSULTES_MAX);

  return (data ?? []).map((r) => ({ id: r.produit_id as number, date: r.vu_le as string }));
}

export async function enregistrerConsulteAction(produitId: number): Promise<{ ok: boolean }> {
  if (!Number.isInteger(produitId) || produitId <= 0) return { ok: false };

  const { sessionId, clientId } = await identiteSession();
  if (!clientId && !sessionId) return { ok: false };

  const table = clientId ? "consultes_compte" : "consultes_session";
  const cle: Record<string, number | string> = clientId
    ? { client_id: clientId }
    : { session_id: sessionId as string };
  const onConflict = clientId ? "client_id,produit_id" : "session_id,produit_id";

  const { error } = await supabaseAdmin
    .from(table)
    .upsert({ ...cle, produit_id: produitId, vu_le: new Date().toISOString() }, { onConflict });
  return { ok: !error };
}
