"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
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
      className="animate-fade-in-up fixed inset-0 z-[120] flex flex-col overflow-y-auto bg-surface"
    >
      {/* Halos décoratifs (palette marque, très diffus) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand/25 blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 size-72 rounded-full bg-action/20 blur-[90px]"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-7 px-6 py-10">
        <header className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-3xl bg-elevated shadow-sm ring-1 ring-ink/10">
            <Image
              src="/images/logo.jpg"
              alt="SacAdo"
              width={44}
              height={44}
              className="rounded-2xl object-cover"
              priority
            />
          </span>
          <p className="mt-3 font-heading text-lg font-bold tracking-tight text-brand">SacAdo</p>
          <h1
            id="welcome-titre"
            className="mt-4 font-heading text-2xl font-extrabold leading-snug text-ink"
          >
            On prépare votre rentrée
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            Votre nom et votre numéro, une seule fois. Ils pré-remplissent vos commandes
            et gardent votre historique à portée.
          </p>
        </header>

        <form onSubmit={commencer} noValidate className="flex flex-col gap-3">
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
              className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/35"
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
              className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/35"
            />
          </Champ>

          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-ink/45">
            <ShieldCheck size={13} aria-hidden="true" />
            Pas de mot de passe. Vos infos restent sur cet appareil.
          </p>

          <button
            type="submit"
            disabled={envoi}
            className="mt-2 flex h-13 items-center justify-center gap-2 rounded-full bg-action text-sm font-semibold text-on-action shadow-sm transition-transform active:scale-[0.98] disabled:opacity-80"
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
            className="h-11 rounded-full text-sm font-medium text-ink/50 transition-colors hover:text-ink/80 disabled:opacity-50"
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
      <span className="text-xs font-medium text-ink/55">{label}</span>
      <span
        className={`flex items-center gap-2.5 rounded-2xl border bg-elevated px-3.5 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
          invalid ? "border-red-400" : "border-ink/12"
        }`}
      >
        <span className="text-ink/40">{icon}</span>
        <span className="flex-1 py-3">{children}</span>
      </span>
      {invalid && <span className="text-xs text-red-500">{erreur}</span>}
    </label>
  );
}
