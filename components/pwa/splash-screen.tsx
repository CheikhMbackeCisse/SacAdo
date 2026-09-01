"use client";

import { useEffect, useState } from "react";

// Écran de démarrage : le logo SacAdo (le sac) centré. Le fond suit le thème du
// téléphone — clair par défaut, bleu nuit `#02296C` en mode sombre (classe
// `.splash-fond` dans globals.css) — pour rester cohérent avec le splash natif.
// COURT : masque l'initialisation, ne la rallonge pas. N'attend pas le catalogue.
const DUREE_MS = 1400;
const DUREE_MS_MOUVEMENT_REDUIT = 450;
// Une seule apparition par session (= par lancement de l'app). Un refresh dans
// le même onglet ne re-déclenche pas le splash ; relancer l'app installée oui.
const CLE_SESSION = "sacado_splash_vu";

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
    // Déjà vu cette session → retrait immédiat (setState via timer, pas dans le
    // corps de l'effet).
    const duree = dejaVu ? 0 : mouvementReduit ? DUREE_MS_MOUVEMENT_REDUIT : DUREE_MS;

    const versSortie = setTimeout(() => setPhase("sortie"), duree);
    const versFini = setTimeout(() => setPhase("fini"), duree + (dejaVu ? 0 : 320));
    return () => {
      clearTimeout(versSortie);
      clearTimeout(versFini);
    };
  }, []);

  if (phase === "fini") return null;

  return (
    <div
      aria-hidden="true"
      className={`splash-fond fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        phase === "sortie" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Le splash doit peindre le logo AU PLUS TÔT : on sert le fichier brut,
          sans passer par le pipeline d'optimisation next/image (roundtrip). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.jpg"
        alt="SacAdo"
        width={128}
        height={128}
        className="size-32 rounded-[28px] object-cover shadow-2xl shadow-black/30 motion-safe:animate-[splash-pulse_1400ms_ease-in-out_infinite]"
      />
    </div>
  );
}
