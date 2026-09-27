"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { estAppInstallee } from "@/lib/pwa/standalone";
import { DUREE_ANIMATION_LOGO_MS, LogoAnime } from "@/components/pwa/logo-anime";

// Écran de démarrage : logo animé (LOGO_ANIME.md), même fond que le splash
// natif de la PWA — clair par défaut, bleu nuit `#02296C` en mode sombre
// (classe `.splash-fond` dans globals.css).
// Une seule apparition par session (= par lancement de l'app). Un refresh
// dans le même onglet ne re-déclenche pas le splash ; relancer l'app
// installée oui.
const CLE_SESSION = "sacado_splash_vu";
// Sécurité : le splash disparaît au plus tard 12 s après son affichage, quoi
// qu'il arrive (l'app pourrait ne jamais signaler "prête").
const DUREE_MAX_MS = 12000;
const SORTIE_MS = 300;
const ATTENTE_APRES_INTRO_MS = 300;
const DUREE_MOUVEMENT_REDUIT_MS = 450;

export function SplashScreen() {
  // Visible dès le premier rendu (serveur + client) — mais masqué en
  // navigateur normal par la CSS `.splash-overlay` tant que le JS n'a pas
  // confirmé le mode installé.
  const [phase, setPhase] = useState<"visible" | "sortie" | "fini">("visible");
  const [anime, setAnime] = useState(true);
  const [enBoucle, setEnBoucle] = useState(false);
  const introFinieRef = useRef(false);
  const appPreteRef = useRef(false);
  const sortieDeclencheeRef = useRef(false);

  const declencherSortie = useCallback(() => {
    if (sortieDeclencheeRef.current) return;
    sortieDeclencheeRef.current = true;
    setPhase("sortie");
    setTimeout(() => setPhase("fini"), SORTIE_MS);
  }, []);

  useEffect(() => {
    if (!estAppInstallee()) {
      setPhase("fini");
      return;
    }

    let dejaVu = false;
    try {
      dejaVu = sessionStorage.getItem(CLE_SESSION) === "1";
      sessionStorage.setItem(CLE_SESSION, "1");
    } catch {
      // sessionStorage indisponible : on affiche le splash normalement
    }
    if (dejaVu) {
      setPhase("fini");
      return;
    }

    const mouvementReduit =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const surAppPrete = () => {
      appPreteRef.current = true;
      if (introFinieRef.current) {
        setTimeout(declencherSortie, ATTENTE_APRES_INTRO_MS);
      } else {
        setEnBoucle(true);
      }
    };

    if (mouvementReduit) {
      setAnime(false);
      // Sortie dès que l'app est prête, 450 ms minimum sur le logo immobile.
      const debut = Date.now();
      const versSortie = () => {
        const reste = Math.max(0, DUREE_MOUVEMENT_REDUIT_MS - (Date.now() - debut));
        setTimeout(declencherSortie, reste);
      };
      if (document.readyState === "complete") {
        versSortie();
      } else {
        window.addEventListener("load", versSortie, { once: true });
      }
      const secours = setTimeout(declencherSortie, DUREE_MAX_MS);
      return () => {
        window.removeEventListener("load", versSortie);
        clearTimeout(secours);
      };
    }

    if (document.readyState === "complete") {
      surAppPrete();
    } else {
      window.addEventListener("load", surAppPrete, { once: true });
    }

    // Toucher l'écran pendant l'intro la passe : sortie directe si l'app est
    // prête, sinon passage à la boucle.
    const surToucher = () => {
      if (introFinieRef.current) return;
      introFinieRef.current = true;
      if (appPreteRef.current) {
        declencherSortie();
      } else {
        setEnBoucle(true);
      }
    };
    window.addEventListener("pointerdown", surToucher, { once: true });

    const secours = setTimeout(declencherSortie, DUREE_MAX_MS);

    return () => {
      window.removeEventListener("load", surAppPrete);
      window.removeEventListener("pointerdown", surToucher);
      clearTimeout(secours);
    };
  }, [declencherSortie]);

  const surFinIntro = useCallback(() => {
    introFinieRef.current = true;
    if (appPreteRef.current) {
      setTimeout(declencherSortie, ATTENTE_APRES_INTRO_MS);
    } else {
      setEnBoucle(true);
    }
  }, [declencherSortie]);

  if (phase === "fini") return null;

  return (
    <div
      aria-hidden="true"
      className={`splash-overlay splash-fond fixed inset-0 z-[100] items-center justify-center transition-opacity duration-300 ${
        phase === "sortie" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <LogoAnime
        className="size-32"
        anime={anime}
        enBoucle={enBoucle}
        onFin={anime ? surFinIntro : undefined}
      />
    </div>
  );
}

// Durée exportée pour d'éventuels tests / réglages fins ailleurs.
export const DUREE_INTRO_LOGO_MS = DUREE_ANIMATION_LOGO_MS;
