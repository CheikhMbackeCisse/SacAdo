"use client";

import { useEffect, useRef, useState } from "react";
import { usePanier } from "@/lib/local/panier";
import { useKitEnfants } from "@/lib/local/kit-enfants";
import { reprendrePaiementWave, simulerPaiementWave } from "@/lib/checkout/actions";

// Le panier n'est vidé qu'au retour dans l'app après un paiement Wave : la
// commande existe déjà en base (et le stock est décrémenté), le panier local
// n'a plus lieu d'être.
export function ViderPanierAuMontage() {
  const { vider } = usePanier();
  const { vider: viderEnfants } = useKitEnfants();
  const fait = useRef(false);

  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    vider();
    viderEnfants();
  }, [vider, viderEnfants]);

  return null;
}

// Boutons de la page de SIMULATION du paiement Wave (mode dev sans clé). Le
// bouton « réussi » déclenche la même logique que le vrai webhook Wave via
// simulerPaiementWave(), puis renvoie vers l'écran de retour correspondant.
export function SimulationBoutons({ reference }: { reference: string }) {
  const [enCours, setEnCours] = useState<"paye" | "echoue" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const simuler = async (issue: "paye" | "echoue") => {
    setEnCours(issue);
    setError(null);
    try {
      const r = await simulerPaiementWave(reference, issue);
      if (!r.ok) {
        setError(r.error ?? "La simulation a échoué.");
        setEnCours(null);
        return;
      }
      const ref = encodeURIComponent(reference);
      window.location.href =
        issue === "paye"
          ? `/checkout/confirmation?ref=${ref}`
          : `/checkout/paiement-echoue?ref=${ref}`;
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

export function BoutonReessayerPaiement({ reference }: { reference: string }) {
  const [enCours, setEnCours] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reessayer = async () => {
    setEnCours(true);
    setError(null);
    try {
      const r = await reprendrePaiementWave(reference);
      if (!r.ok) {
        setError(r.error);
        setEnCours(false);
        return;
      }
      window.location.href = r.waveLaunchUrl;
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
