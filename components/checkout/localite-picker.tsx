"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { Localite, LieuSpecial } from "@/lib/supabase/types";

export type SelectionLocalite =
  | { type: "localite"; id: number; nom: string }
  | { type: "special"; id: number; nom: string }
  | { type: "libre"; texte: string };

type Suggestion = { id: number; nom: string; type: "localite" | "special" };

const MIN_CARACTERES = 2;
const MAX_RESULTATS = 8;

// Comparaison insensible aux accents ("thies" doit matcher "Thiès").
const MARQUES_DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

function normaliser(s: string): string {
  return s.normalize("NFD").replace(MARQUES_DIACRITIQUES, "").toLowerCase();
}

type Props = {
  localites: Localite[];
  lieuxSpeciaux: LieuSpecial[];
  value: SelectionLocalite | null;
  onChange: (value: SelectionLocalite) => void;
};

export function LocalitePicker({ localites, lieuxSpeciaux, value, onChange }: Props) {
  const [texte, setTexte] = useState(() => libelleInitial(value));
  const [ouverte, setOuverte] = useState(false);

  const suggestions: Suggestion[] = (() => {
    const requete = normaliser(texte.trim());
    if (requete.length < MIN_CARACTERES) return [];
    const matchLocalites: Suggestion[] = localites
      .filter((l) => normaliser(l.nom).includes(requete))
      .map((l) => ({ id: l.id, nom: l.nom, type: "localite" as const }));
    const matchSpeciaux: Suggestion[] = lieuxSpeciaux
      .filter((l) => normaliser(l.nom).includes(requete))
      .map((l) => ({ id: l.id, nom: l.nom, type: "special" as const }));
    return [...matchLocalites, ...matchSpeciaux].slice(0, MAX_RESULTATS);
  })();

  const majTexte = (v: string) => {
    setTexte(v);
    onChange({ type: "libre", texte: v });
    setOuverte(true);
  };

  const choisir = (s: Suggestion) => {
    setTexte(s.nom);
    setOuverte(false);
    onChange({ type: s.type, id: s.id, nom: s.nom });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-elevated px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <Search size={15} className="shrink-0 text-ink/40" aria-hidden="true" />
        <input
          type="text"
          required
          value={texte}
          onChange={(event) => majTexte(event.target.value)}
          onFocus={() => texte.trim().length >= MIN_CARACTERES && setOuverte(true)}
          onBlur={() => setTimeout(() => setOuverte(false), 120)}
          placeholder="Ta localité (quartier, ville…)"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
        />
      </div>

      {ouverte && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-ink/15 bg-surface shadow-lg">
          {suggestions.map((s) => (
            <li key={`${s.type}-${s.id}`}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choisir(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-ink/5"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-ink/40" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.nom}</span>
                  {s.type === "special" && (
                    <span className="text-[11px] font-medium text-brand">Cas particulier</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {ouverte && suggestions.length === 0 && texte.trim().length >= MIN_CARACTERES && (
        <p className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-ink/15 bg-surface px-3 py-2 text-xs text-ink/55 shadow-lg">
          Localité non reconnue : on te contactera pour confirmer le tarif de livraison.
        </p>
      )}
    </div>
  );
}

function libelleInitial(value: SelectionLocalite | null): string {
  if (!value) return "";
  return value.type === "libre" ? value.texte : value.nom;
}
