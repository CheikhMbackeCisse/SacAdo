"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifierJetonClient } from "@/lib/client-auth";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import type { Commande, Message } from "@/lib/supabase/types";

// clients/commandes/messages n'ont aucune policy publique (RLS, voir
// supabase/README.md) : ces lectures ne peuvent se faire que côté serveur,
// via service_role. Le numéro identifie le client, mais NE SUFFIT PAS : il faut
// aussi le jeton remis à la création d'une commande (AUDIT_SECURITE_2 C1).
async function getClientIdByTelephone(telephone: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("telephone", telephone.trim())
    .maybeSingle();
  return data?.id ?? null;
}

// Renvoie le client_id si le couple (téléphone, jeton) est valide, sinon null.
// Rate limit léger en plus : coupe un éventuel script qui tenterait des jetons.
async function clientAutorise(telephone: string, jeton: string): Promise<number | null> {
  const numero = telephone.trim();
  if (!numero || !jeton) return null;

  const ip = await getClientIp();
  if (!(await verifierLimite(`histo:${ip}`, 60, 300))) return null;

  const clientId = await getClientIdByTelephone(numero);
  if (!clientId || !verifierJetonClient(clientId, jeton)) return null;
  return clientId;
}

export async function getCommandesParTelephone(
  telephone: string,
  jeton: string,
): Promise<Commande[]> {
  const clientId = await clientAutorise(telephone, jeton);
  if (!clientId) return [];

  const { data, error } = await supabaseAdmin
    .from("commandes")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getMessagesParTelephone(
  telephone: string,
  jeton: string,
): Promise<Message[]> {
  const clientId = await clientAutorise(telephone, jeton);
  if (!clientId) return [];

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function marquerMessageLu(
  messageId: number,
  telephone: string,
  jeton: string,
): Promise<void> {
  const clientId = await clientAutorise(telephone, jeton);
  if (!clientId) return;

  // Le filtre sur client_id empêche de marquer comme lu un message qui
  // n'appartient pas au client vérifié, même en devinant un autre id.
  await supabaseAdmin.from("messages").update({ lu: true }).eq("id", messageId).eq("client_id", clientId);
}
