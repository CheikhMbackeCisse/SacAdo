"use client";

import { useState, type FormEvent } from "react";
import { useIdentite } from "@/lib/local/identite";

export function PhoneLookupForm() {
  const { setIdentite } = useIdentite();
  const [telephone, setTelephone] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = telephone.trim();
    if (!trimmed) return;
    setIdentite({ nom: "", telephone: trimmed });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Ton numéro de téléphone (utilisé à la commande)
        </span>
        <input
          required
          type="tel"
          inputMode="tel"
          value={telephone}
          onChange={(event) => setTelephone(event.target.value)}
          placeholder="77 123 45 67"
          className="rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </label>
      <button
        type="submit"
        className="self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95"
      >
        Retrouver mon historique
      </button>
    </form>
  );
}
