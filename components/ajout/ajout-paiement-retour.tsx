"use client";

import { useEffect, useRef, useState } from "react";
import { useAjoutMode } from "@/lib/local/ajout-mode";
import { useKitsPanier } from "@/lib/local/kits-panier";
import { reprendrePaiementAjoutWave, simulerPaiementAjoutWave } from "@/lib/ajout/actions";

// Pendants de components/checkout/paiement-retour.tsx pour le paiement Wave
// d'un AJOUT (PROMPT_CLIENT_V2 Lot 4) : même logique, données plus légères
// (pas de "nomEnregistre", pas de carte).

// Le panier d'ajout n'est vidé qu'au retour dans l'app après le paiement : la
// commande_ajouts existe déjà en base (stock décrémenté), le panier local n'a
// plus lieu d'être. Sort aussi du mode ajout.
export function ViderPanierAjoutAuMontage() {
  const { sortir } = useAjoutMode();
  const { vider: viderKits } = useKitsPanier();
  const fait = useRef(false);

  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    viderKits();
    sortir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function SimulationBoutonsAjout({ reference }: { reference: string }) {
  const [enCours, setEnCours] = useState<"paye" | "echoue" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const simuler = async (issue: "paye" | "echoue") => {
    setEnCours(issue);
    setError(null);
    try {
      const r = await simulerPaiementAjoutWave(reference, issue);
      if (!r.ok) {
        setError(r.error ?? "La simulation a échoué.");
        setEnCours(null);
        return;
      }
      const ref = encodeURIComponent(reference);
      window.location.href =
        issue === "paye" ? `/ajout/confirmation?ref=${ref}` : `/ajout/paiement-echoue?ref=${ref}`;
    } catch {
      setError("La connexion a été interrompue. Réessaie.");
      setEnCours(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => simuler("paye")}
        disabled={enCours !== null}
        className="flex h-12 items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
      >
        {enCours === "paye" ? "Simulation…" : "Simuler un paiement réussi"}
      </button>
      <button
        type="button"
        onClick={() => simuler("echoue")}
        disabled={enCours !== null}
        className="flex h-12 items-center justify-center rounded-full border border-ink/15 text-sm font-medium text-ink disabled:opacity-50"
      >
        {enCours === "echoue" ? "Simulation…" : "Simuler une annulation"}
      </button>
      {error && <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink/80">{error}</p>}
    </div>
  );
}

export function BoutonReessayerAjout({ reference }: { reference: string }) {
  const [enCours, setEnCours] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reessayer = async () => {
    setEnCours(true);
    setError(null);
    try {
      const r = await reprendrePaiementAjoutWave(reference);
      if (!r.ok) {
        setError(r.error);
        setEnCours(false);
        return;
      }
      if (r.waveLaunchUrl) window.location.href = r.waveLaunchUrl;
    } catch {
      setError("La connexion a été interrompue. Réessaie.");
      setEnCours(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={reessayer}
        disabled={enCours}
        className="flex h-12 w-full items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
      >
        {enCours ? "Redirection…" : "Réessayer le paiement"}
      </button>
      {error && <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink/80">{error}</p>}
    </div>
  );
}
