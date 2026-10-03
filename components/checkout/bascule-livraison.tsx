"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { basculerPaiementLivraison } from "@/lib/checkout/actions";
import { useIdentite } from "@/lib/local/identite";

// Bouton « Payer à la livraison à la place » (PROMPT_CLIENT_V2 Lot 1) :
// proposé sur une commande Wave abandonnée / échouée (écran paiement-echoue,
// « Mes commandes »). Reprend la même case à cocher obligatoire que le
// checkout — la commande n'est jamais basculée sans ce consentement. Le
// numéro affiché vient de l'identité mémorisée sur cet appareil (celui qui a
// servi à passer la commande).
export function BasculerLivraison({ reference }: { reference: string }) {
  const router = useRouter();
  const { identite } = useIdentite();
  const telephone = identite?.telephone ?? "ton numéro";
  const [ouvert, setOuvert] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex h-11 w-full items-center justify-center rounded-full border border-ink/15 text-sm font-medium text-ink"
      >
        Payer à la livraison à la place
      </button>
    );
  }

  const confirmer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await basculerPaiementLivraison(reference, consentement);
      if (!r.ok) {
        setErreur(r.error);
        setEnCours(false);
        return;
      }
      router.push(`/suivi/${r.commandeId}?t=${r.jeton}`);
    } catch {
      setErreur("La connexion a été interrompue. Réessaie.");
      setEnCours(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3">
      <p className="text-xs text-ink/70">
        Nous vous appellerons sur votre numéro WhatsApp pour confirmer la commande avant
        l&apos;envoi. Sans réponse, la commande ne sera pas expédiée.
      </p>
      <label className="flex items-start gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={consentement}
          onChange={(event) => setConsentement(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-brand"
        />
        <span>J&apos;ai compris, je serai joignable au {telephone}</span>
      </label>
      <button
        type="button"
        onClick={confirmer}
        disabled={!consentement || enCours}
        className="flex h-11 w-full items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
      >
        {enCours ? "Confirmation…" : "Confirmer le paiement à la livraison"}
      </button>
      {erreur && <p className="text-xs text-ink/80">{erreur}</p>}
    </div>
  );
}
