"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Commande, Message } from "@/lib/supabase/types";

// clients/commandes/messages n'ont aucune policy publique (RLS, voir
// supabase/README.md) : ces lectures ne peuvent se faire que côté serveur,
// via service_role, identifiées par le numéro de téléphone du client.
async function getClientIdByTelephone(telephone: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("telephone", telephone.trim())
    .maybeSingle();
  return data?.id ?? null;
}

export async function getCommandesParTelephone(telephone: string): Promise<Commande[]> {
  const clientId = await getClientIdByTelephone(telephone);
  if (!clientId) return [];

  const { data, error } = await supabaseAdmin
    .from("commandes")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getMessagesParTelephone(telephone: string): Promise<Message[]> {
  const clientId = await getClientIdByTelephone(telephone);
  if (!clientId) return [];

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function marquerMessageLu(messageId: number, telephone: string): Promise<void> {
  const clientId = await getClientIdByTelephone(telephone);
  if (!clientId) return;

  // Le filtre sur client_id empêche de marquer comme lu un message qui
  // n'appartient pas au téléphone fourni, même en devinant un autre id.
  await supabaseAdmin.from("messages").update({ lu: true }).eq("id", messageId).eq("client_id", clientId);
}
