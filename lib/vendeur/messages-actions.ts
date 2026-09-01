"use server";

import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MessageVendeur } from "@/lib/supabase/types";

export async function getMesMessages(): Promise<MessageVendeur[]> {
  const { userId } = await requireVendeur();
  const { data } = await supabaseAdmin
    .from("messages_vendeur")
    .select("*")
    .eq("vendeur_id", userId)
    .order("date", { ascending: false });
  return (data ?? []) as MessageVendeur[];
}

export async function getNbMessagesNonLus(): Promise<number> {
  const { userId } = await requireVendeur();
  const { count } = await supabaseAdmin
    .from("messages_vendeur")
    .select("*", { count: "exact", head: true })
    .eq("vendeur_id", userId)
    .eq("lu", false);
  return count ?? 0;
}

export async function marquerMessageVendeurLu(id: number): Promise<void> {
  const { userId } = await requireVendeur();
  // Le filtre sur vendeur_id empêche de toucher le message d'un autre vendeur.
  await supabaseAdmin
    .from("messages_vendeur")
    .update({ lu: true })
    .eq("id", id)
    .eq("vendeur_id", userId);
}
