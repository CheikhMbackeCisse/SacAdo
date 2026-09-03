import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EN_TETE_SIGNATURE, parseEvenementWave, verifierSignatureWave } from "@/lib/wave/webhook";

export const dynamic = "force-dynamic";

// Webhook de paiement Wave (INTEGRATION_WAVE.md, W4). SEULE source de vérité sur
// le paiement. Flux : vérifier la signature -> lire l'évènement -> déléguer à
// traiter_paiement_wave() (atomique + idempotent).
//
// Codes de réponse :
//   200 -> évènement traité (ou volontairement ignoré / déjà vu)
//   400 -> corps illisible
//   401 -> signature absente ou invalide
//   500 -> erreur interne -> Wave rejouera le webhook
export async function POST(request: NextRequest) {
  const corps = await request.text();
  const signature = request.headers.get(EN_TETE_SIGNATURE);

  if (!verifierSignatureWave(corps, signature)) {
    return Response.json({ error: "signature invalide" }, { status: 401 });
  }

  const evenement = parseEvenementWave(corps);
  if (!evenement) {
    return Response.json({ error: "payload illisible" }, { status: 400 });
  }

  // Évènement sans intérêt pour nous : on accuse réception sans rien faire.
  if (evenement.resultat === "autre") {
    return Response.json({ ok: true, resultat: "ignore" });
  }

  const { data, error } = await supabaseAdmin.rpc("traiter_paiement_wave", {
    p_event_id: evenement.id,
    p_reference: evenement.reference,
    p_session_id: evenement.sessionId,
    p_resultat: evenement.resultat,
    p_montant: evenement.montant,
  });

  if (error) {
    console.error("Webhook Wave: traiter_paiement_wave a échoué", error);
    return Response.json({ error: "erreur interne" }, { status: 500 });
  }

  console.log(`Webhook Wave: ${evenement.id} (${evenement.resultat}) -> ${data}`);
  return Response.json({ ok: true, resultat: data });
}
