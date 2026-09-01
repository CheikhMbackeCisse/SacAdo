"use client";

import { useEffect, useState } from "react";

// Durée d'affichage : COURT. L'écran masque l'initialisation, il ne la rallonge
// pas (ECRAN_DEMARRAGE.md « garde-fou »). Il n'attend pas le catalogue.
const DUREE_MS = 1600;
const DUREE_MS_MOUVEMENT_REDUIT = 500;
// Une seule apparition par session (= par lancement de l'app). Un refresh dans
// le même onglet ne re-déclenche pas le splash ; relancer l'app installée oui.
const CLE_SESSION = "sacado_splash_vu";

const BLEU_NUIT = "#02296C"; // = manifest background_color → enchaînement sans coupure

export function SplashScreen() {
  // Visible dès le premier rendu (serveur + client) : aucun flash de page nue.
  const [phase, setPhase] = useState<"visible" | "sortie" | "fini">("visible");

  useEffect(() => {
    let dejaVu = false;
    try {
      dejaVu = sessionStorage.getItem(CLE_SESSION) === "1";
      sessionStorage.setItem(CLE_SESSION, "1");
    } catch {
      // sessionStorage indisponible : on affiche le splash normalement
    }

    const mouvementReduit =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Déjà vu cette session → on retire immédiatement (setState via timer, pas
    // dans le corps de l'effet).
    const duree = dejaVu ? 0 : mouvementReduit ? DUREE_MS_MOUVEMENT_REDUIT : DUREE_MS;

    const versSortie = setTimeout(() => setPhase("sortie"), duree);
    const versFini = setTimeout(() => setPhase("fini"), duree + (dejaVu ? 0 : 320));
    return () => {
      clearTimeout(versSortie);
      clearTimeout(versFini);
    };
    return () => {
      clearTimeout(versSortie);
      clearTimeout(versFini);
    };
  }, []);

  if (phase === "fini") return null;

  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: BLEU_NUIT }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-8 transition-opacity duration-300 ${
        phase === "sortie" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="font-heading text-[2.75rem] font-extrabold tracking-tight text-white motion-safe:animate-[splash-pulse_1400ms_ease-in-out_infinite]">
        SacAdo
      </span>
      <p className="max-w-[240px] text-center text-sm text-white/70">
        Tout pour apprendre, en un seul endroit et livré chez vous.
      </p>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-white/15">
        <span className="block h-full w-1/3 rounded-full bg-white/80 motion-safe:animate-[splash-bar_900ms_ease-in-out_infinite]" />
      </span>
    </div>
  );
}
