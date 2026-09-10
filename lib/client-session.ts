import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifierJetonClient } from "@/lib/client-auth";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";

// Résout le client_id à partir du couple (téléphone, jeton) — le jeton est
// remis à la création d'une commande (AUDIT_SECURITE_2 C1). Le numéro seul ne
// suffit jamais. Rate limit léger par IP pour couper un script qui devine.
export async function clientIdAutorise(
  telephone: string,
  jeton: string,
): Promise<number | null> {
  const numero = (telephone ?? "").trim();
  if (!numero || !jeton) return null;

  const ip = await getClientIp();
  if (!(await verifierLimite(`histo:${ip}`, 60, 300))) return null;

  const { data } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("telephone", numero)
    .maybeSingle();
  const id = (data?.id ?? null) as number | null;
  if (!id || !verifierJetonClient(id, jeton)) return null;
  return id;
}
