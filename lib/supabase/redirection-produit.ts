import "server-only";
import { supabaseAdmin } from "./admin";

// Fiche produit archivée après une fusion de doublons (maj-26-09 §1, ex.
// "Boîte à goûter ronde") : on ne sert pas un 404 sec, on redirige vers le
// produit conservé. `getProduitById` (RLS anon) renvoie déjà null pour un
// produit archivé — on ne consulte le service_role que dans ce cas, jamais
// sur le chemin normal d'une fiche publiée.
export async function getRedirectionEquivalent(
  id: number,
): Promise<{ id: number; nom: string } | null> {
  const { data: archive } = await supabaseAdmin
    .from("produits")
    .select("statut_publication, equivalent_id")
    .eq("id", id)
    .maybeSingle();
  if (!archive || archive.statut_publication !== "archive" || !archive.equivalent_id) {
    return null;
  }

  const { data: cible } = await supabaseAdmin
    .from("produits")
    .select("id, nom")
    .eq("id", archive.equivalent_id)
    .eq("statut_publication", "publie")
    .maybeSingle();
  return cible;
}
