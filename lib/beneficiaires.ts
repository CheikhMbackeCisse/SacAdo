import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Beneficiaire = {
  id: number;
  prenom: string;
  niveau: string | null;
  serie: string | null;
  etablissement: string | null;
  actif: boolean;
  cree_le: string;
};

// Bénéficiaires actifs d'un compte, du plus ancien au plus récent (ordre stable
// pour les puces de l'accueil et l'entrelacement).
export async function getBeneficiairesActifs(compteId: number): Promise<Beneficiaire[]> {
  const { data } = await supabaseAdmin
    .from("beneficiaires")
    .select("id, prenom, niveau, serie, etablissement, actif, cree_le")
    .eq("compte_id", compteId)
    .eq("actif", true)
    .order("cree_le", { ascending: true })
    .order("id", { ascending: true });
  return (data ?? []) as Beneficiaire[];
}

// Filtre une liste d'ids de bénéficiaires sur ceux qui appartiennent bien au
// compte et sont actifs (garde-fou avant d'écrire `evenements.beneficiaire_id`).
export async function idsBeneficiairesValides(
  compteId: number,
  ids: number[],
): Promise<Set<number>> {
  const propres = Array.from(new Set(ids.filter((n) => Number.isFinite(n) && n > 0)));
  if (propres.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from("beneficiaires")
    .select("id")
    .eq("compte_id", compteId)
    .eq("actif", true)
    .in("id", propres);
  return new Set((data ?? []).map((r) => r.id as number));
}
