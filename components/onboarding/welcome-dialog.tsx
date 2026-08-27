"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { GraduationCap } from "lucide-react";
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

// Première visite (option A, contournable) : on demande le nom et le numéro pour
// pré-remplir le checkout et retrouver "Mes commandes" / la boîte de réception
// sans redemander. Aucune vérification SMS, aucun mot de passe. Bouton "Plus
// tard" pour ne pas bloquer (CLAUDE.md : pas de pop-ups agressifs).
const EMPTY_SUBSCRIBE = () => () => {};

export function WelcomeDialog() {
  const { identite, setIdentite } = useIdentite();
  // Rendu uniquement côté client : évite un flash de la modale au SSR pour les
  // visiteurs qui ont déjà une identité mémorisée.
  const monte = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
  const [ferme, setFerme] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");

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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert, reporter]);

  if (!ouvert) return null;

  const commencer = (event: FormEvent) => {
    event.preventDefault();
    const nomTrim = nom.trim();
    const telTrim = telephone.trim();
    if (!nomTrim || !telTrim) return;
    setIdentite({ nom: nomTrim, telephone: telTrim });
    setFerme(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-titre"
    >
      <div className="w-full max-w-sm rounded-3xl border border-ink/10 bg-elevated p-5 shadow-xl">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <GraduationCap size={24} aria-hidden="true" />
        </span>
        <h2 id="welcome-titre" className="mt-3 font-heading text-lg font-bold text-ink">
          Bienvenue sur SacAdo
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Ton nom et ton numéro pour préparer tes commandes et retrouver ton
          historique. Pas de mot de passe.
        </p>

        <form onSubmit={commencer} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-ink/60">Nom complet</span>
            <input
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Awa Diop"
              autoComplete="name"
              className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-ink/60">Téléphone</span>
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="77 123 45 67"
              className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </label>

          <div className="mt-1 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={reporter}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
            >
              Plus tard
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-transform active:scale-95"
            >
              Commencer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
