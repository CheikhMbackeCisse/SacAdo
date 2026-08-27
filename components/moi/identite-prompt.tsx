"use client";

import { useState, type FormEvent } from "react";
import { Phone, User } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";

// Affiché sur "Mes commandes" / "Boîte de réception" quand l'utilisateur a passé
// l'écran d'accueil : on ne redemande PAS un "login", on propose simplement
// d'enregistrer ses infos (mêmes champs que l'accueil).
export function IdentitePrompt({ contexte = "vos commandes" }: { contexte?: string }) {
  const { setIdentite } = useIdentite();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [tentative, setTentative] = useState(false);

  const nomOk = nom.trim().length > 0;
  const telOk = telephone.trim().length >= 6;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTentative(true);
    if (!nomOk || !telOk) return;
    setIdentite({ nom: nom.trim(), telephone: telephone.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-elevated p-4"
    >
      <p className="text-sm text-ink/70">
        Indiquez le nom et le numéro utilisés pour {contexte}. Vos infos restent sur cet
        appareil.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink/55">Nom complet</span>
        <span
          className={`flex items-center gap-2.5 rounded-2xl border bg-surface px-3.5 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
            tentative && !nomOk ? "border-red-400" : "border-ink/12"
          }`}
        >
          <User size={16} className="text-ink/40" aria-hidden="true" />
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Awa Diop"
            autoComplete="name"
            className="w-full bg-transparent py-3 text-base text-ink outline-none placeholder:text-ink/35"
          />
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink/55">Téléphone</span>
        <span
          className={`flex items-center gap-2.5 rounded-2xl border bg-surface px-3.5 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
            tentative && !telOk ? "border-red-400" : "border-ink/12"
          }`}
        >
          <Phone size={16} className="text-ink/40" aria-hidden="true" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="77 123 45 67"
            className="w-full bg-transparent py-3 text-base text-ink outline-none placeholder:text-ink/35"
          />
        </span>
      </label>

      <button
        type="submit"
        className="mt-1 h-11 self-start rounded-full bg-brand px-5 text-sm font-semibold text-on-brand transition-transform active:scale-95"
      >
        Enregistrer
      </button>
    </form>
  );
}
