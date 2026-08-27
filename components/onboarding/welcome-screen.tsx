"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Loader2, Phone, ShieldCheck, User } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";

const REPORTE_KEY = "sacado_onboarding_reporte";
// Si l'utilisateur choisit "Plus tard", on ne le re-sollicite pas avant ce délai.
const RAPPEL_MS = 7 * 24 * 60 * 60 * 1000;

// Écran de couverture : palette de marque figée en clair (le fond illustré est
// clair quel que soit le thème), donc couleurs en dur plutôt que tokens.
const INK = "#001314";
const ACTION = "#E07B39";

const SLOGAN = "Tout pour apprendre, en un seul endroit et livré chez vous.";

// Effet machine à écrire : révèle le slogan caractère par caractère. Respecte
// prefers-reduced-motion (affichage immédiat). Aucun setState synchrone dans le
// corps de l'effet — tout passe par les callbacks de timers.
function useTypewriter(text: string, active: boolean) {
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      const id = setTimeout(() => setCount(text.length), 0);
      return () => clearTimeout(id);
    }

    let i = 0;
    const startId = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, 42);
    }, 350);

    return () => {
      clearTimeout(startId);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, active]);

  return count;
}

function reporteRecemment(): boolean {
  try {
    const raw = window.localStorage.getItem(REPORTE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < RAPPEL_MS;
  } catch {
    return false;
  }
}

const EMPTY_SUBSCRIBE = () => () => {};

// Écran de bienvenue plein écran, première chose vue par un nouveau visiteur
// (z au-dessus du splash). Option A, contournable : on demande nom + numéro pour
// pré-remplir le checkout et retrouver "Mes commandes" sans redemander. Aucune
// vérification SMS, aucun mot de passe (CLAUDE.md : rien d'agressif).
export function WelcomeScreen() {
  const { identite, setIdentite } = useIdentite();
  // Rendu client uniquement : évite un flash pour les visiteurs déjà connus.
  const monte = useSyncExternalStore(EMPTY_SUBSCRIBE, () => true, () => false);
  const [ferme, setFerme] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [tentative, setTentative] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const ouvert = monte && !ferme && identite === null && !reporteRecemment();
  const typed = useTypewriter(SLOGAN, ouvert);

  const reporter = useCallback(() => {
    try {
      window.localStorage.setItem(REPORTE_KEY, String(Date.now()));
    } catch {
      // stockage indisponible : on ferme quand même pour cette session
    }
    setFerme(true);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") reporter();
    };
    const root = document.documentElement;
    const scrollAvant = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = scrollAvant;
    };
  }, [ouvert, reporter]);

  if (!ouvert) return null;

  const nomOk = nom.trim().length > 0;
  const telOk = telephone.trim().length >= 6;

  const commencer = (event: FormEvent) => {
    event.preventDefault();
    setTentative(true);
    if (!nomOk || !telOk || envoi) return;
    setEnvoi(true);
    // Courte transition : donne un retour visible avant de basculer sur l'app.
    window.setTimeout(() => {
      setIdentite({ nom: nom.trim(), telephone: telephone.trim() });
      setFerme(true);
    }, 550);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-titre"
      className="animate-fade-in-up fixed inset-0 z-[120] overflow-hidden bg-[#FEFDFF]"
    >
      {/* Fond illustré (fournitures scolaires, palette SacAdo). */}
      <Image
        src="/images/bg-page-form.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Voile radial : centre très clair pour que le texte reste lisible,
          bords plus transparents pour laisser voir l'illustration. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(254,253,255,0.94)_0%,rgba(254,253,255,0.72)_48%,rgba(254,253,255,0.4)_100%)]"
      />

      {/* pb-[14vh] : remonte le bloc (centré) vers le haut de l'écran. */}
      <div className="relative mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-6 px-6 pt-8 pb-[14vh] text-center">
        {/* Logo seul, sans cadre blanc — style icône d'app, flottement léger. */}
        <div className="animate-rise-in">
          <Image
            src="/images/logo.jpg"
            alt="SacAdo"
            width={200}
            height={200}
            priority
            className="animate-float-soft size-[84px] rounded-[26px] object-cover shadow-xl shadow-[#0B3D91]/25"
          />
        </div>

        {/* Slogan en machine à écrire. La copie invisible fige la hauteur pour
            qu'aucune ligne ne saute pendant la frappe. */}
        <h1
          id="welcome-titre"
          aria-label={SLOGAN}
          style={{ color: INK, animationDelay: "80ms" }}
          className="animate-rise-in relative font-heading text-[1.55rem] font-extrabold leading-[1.2] sm:text-[1.7rem]"
        >
          <span aria-hidden="true" className="invisible">
            {SLOGAN}
          </span>
          <span aria-hidden="true" className="absolute inset-0">
            {SLOGAN.slice(0, typed)}
            <span
              className={typed >= SLOGAN.length ? "opacity-0" : "caret-blink"}
              style={{ color: "#0B3D91" }}
            >
              |
            </span>
          </span>
        </h1>

        <form
          onSubmit={commencer}
          noValidate
          style={{ animationDelay: "160ms" }}
          className="animate-rise-in flex w-full flex-col gap-3 text-left"
        >
          <Champ
            label="Nom complet"
            icon={<User size={16} aria-hidden="true" />}
            invalid={tentative && !nomOk}
            erreur="Indiquez votre nom."
          >
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Awa Diop"
              autoComplete="name"
              enterKeyHint="next"
              className="w-full bg-transparent text-base outline-none placeholder:text-[#001314]/35"
              style={{ color: INK }}
            />
          </Champ>

          <Champ
            label="Téléphone"
            icon={<Phone size={16} aria-hidden="true" />}
            invalid={tentative && !telOk}
            erreur="Indiquez un numéro valide."
          >
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="77 123 45 67"
              enterKeyHint="go"
              className="w-full bg-transparent text-base outline-none placeholder:text-[#001314]/35"
              style={{ color: INK }}
            />
          </Champ>

          <p className="flex items-center justify-center gap-1.5 text-xs text-[#001314]/50">
            <ShieldCheck size={13} aria-hidden="true" />
            Sans mot de passe — vos infos restent sur cet appareil.
          </p>

          <button
            type="submit"
            disabled={envoi}
            style={{ backgroundColor: ACTION, color: INK }}
            className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-lg shadow-[#E07B39]/25 transition-transform active:scale-[0.98] disabled:opacity-80"
          >
            {envoi ? (
              <Loader2 size={17} className="animate-spin" aria-hidden="true" />
            ) : (
              <>
                Commencer
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reporter}
            disabled={envoi}
            className="h-11 rounded-full text-sm font-medium text-[#001314]/55 transition-colors hover:text-[#001314]/85 disabled:opacity-50"
          >
            Plus tard
          </button>
        </form>
      </div>
    </div>
  );
}

function Champ({
  label,
  icon,
  invalid,
  erreur,
  children,
}: {
  label: string;
  icon: ReactNode;
  invalid: boolean;
  erreur: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#001314]/55">{label}</span>
      <span
        className={`flex items-center gap-2.5 rounded-2xl border bg-white/85 px-3.5 backdrop-blur-sm transition-colors focus-within:border-[#0B3D91] focus-within:ring-2 focus-within:ring-[#0B3D91]/25 ${
          invalid ? "border-red-400" : "border-[#001314]/12"
        }`}
      >
        <span className="text-[#001314]/40">{icon}</span>
        <span className="flex-1 py-3">{children}</span>
      </span>
      {invalid && <span className="text-xs text-red-500">{erreur}</span>}
    </label>
  );
}
