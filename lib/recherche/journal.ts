import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normaliserTerme } from "./normaliser";

// Journalise une recherche qui n'a rien renvoyé (y compris après la passe
// tolérante aux fautes). Alimente l'écran admin « recherches sans résultat »,
// qui dit quels produits les clients cherchent et que SacAdo ne vend pas encore.
// Écriture via service_role : la table a la RLS active sans policy.
export async function journaliserRechercheVide(
  terme: string,
  utilisateurId?: string | null,
): Promise<void> {
  // Normalisé à l'écriture : sinon « Bic », « bic » et « BIC » comptent pour
  // trois termes distincts dans l'écran admin qui les classe par fréquence.
  const t = normaliserTerme(terme).slice(0, 120);
  if (t.length < 2) return;

  const { error } = await supabaseAdmin.from("recherches_sans_resultat").insert({
    terme: t,
    utilisateur_id: utilisateurId ?? null,
  });
  if (error) console.warn("journal recherche vide indisponible :", error.message);
}
