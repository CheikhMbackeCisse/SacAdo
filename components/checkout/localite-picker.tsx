"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, MessageCircle, Search } from "lucide-react";
import { lienWhatsApp } from "@/lib/whatsapp";
import type { Localite, LieuSpecial } from "@/lib/supabase/types";

// Sélection = TOUJOURS une entrée de la liste (localité ou lieu particulier).
// Aucune saisie libre acceptée (TACHE_corrections_commande_theme_admin.md §2).
export type SelectionLocalite =
  | { type: "localite"; id: number; nom: string }
  | { type: "special"; id: number; nom: string };

type Suggestion = { id: number; nom: string; type: "localite" | "special"; norme: string };

const MAX_RESULTATS = 60;

const MARQUES_DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");
function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(MARQUES_DIACRITIQUES, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type Props = {
  localites: Localite[];
  lieuxSpeciaux: LieuSpecial[];
  value: SelectionLocalite | null;
  onChange: (value: SelectionLocalite | null) => void;
};

export function LocalitePicker({ localites, lieuxSpeciaux, value, onChange }: Props) {
  const [texte, setTexte] = useState(() => value?.nom ?? "");
  const [ouverte, setOuverte] = useState(false);
  const [actif, setActif] = useState(0);
  const listeRef = useRef<HTMLUListElement>(null);

  const toutes: Suggestion[] = useMemo(() => {
    const a: Suggestion[] = localites.map((l) => ({
      id: l.id,
      nom: l.nom,
      type: "localite" as const,
      norme: normaliser(l.nom),
    }));
    const b: Suggestion[] = lieuxSpeciaux.map((l) => ({
      id: l.id,
      nom: l.nom,
      type: "special" as const,
      norme: normaliser(l.nom),
    }));
    return [...a, ...b].sort((x, y) => x.norme.localeCompare(y.norme));
  }, [localites, lieuxSpeciaux]);

  const requete = normaliser(texte);
  const selectionValide = value != null && value.nom === texte;

  const suggestions: Suggestion[] = useMemo(() => {
    if (!requete) return toutes.slice(0, MAX_RESULTATS);
    // Priorité au début du nom, puis à l'intérieur ; alphabétique dans chaque groupe.
    const prefixe: Suggestion[] = [];
    const interieur: Suggestion[] = [];
    for (const s of toutes) {
      if (s.norme.startsWith(requete)) prefixe.push(s);
      else if (s.norme.includes(requete)) interieur.push(s);
    }
    return [...prefixe, ...interieur].slice(0, MAX_RESULTATS);
  }, [toutes, requete]);

  // Index actif borné à la liste courante (elle change à chaque frappe).
  const actifBorne = suggestions.length > 0 ? Math.min(actif, suggestions.length - 1) : 0;

  useEffect(() => {
    listeRef.current?.children[actifBorne]?.scrollIntoView({ block: "nearest" });
  }, [actifBorne]);

  const choisir = (s: Suggestion) => {
    setTexte(s.nom);
    setOuverte(false);
    setActif(0);
    onChange({ type: s.type, id: s.id, nom: s.nom });
  };

  const majTexte = (v: string) => {
    setTexte(v);
    setOuverte(true);
    setActif(0);
    // Toute frappe qui ne correspond plus exactement à la sélection l'annule :
    // on ne peut valider la commande qu'avec une entrée de la liste.
    if (value && value.nom !== v) onChange(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuverte(true);
      setActif(Math.min(actifBorne + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif(Math.max(actifBorne - 1, 0));
    } else if (e.key === "Enter") {
      if (ouverte && suggestions[actifBorne]) {
        e.preventDefault();
        choisir(suggestions[actifBorne]);
      }
    } else if (e.key === "Escape") {
      setOuverte(false);
    }
  };

  const aucunResultat = ouverte && requete.length > 0 && suggestions.length === 0;

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-elevated px-3 focus-within:ring-2 focus-within:ring-brand/20 ${
          selectionValide ? "border-brand/40" : "border-ink/25 focus-within:border-brand"
        }`}
      >
        <Search size={15} className="shrink-0 text-ink/40" aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-expanded={ouverte}
          aria-controls="localite-suggestions"
          aria-autocomplete="list"
          value={texte}
          onChange={(e) => majTexte(e.target.value)}
          onFocus={() => setOuverte(true)}
          onBlur={() => setTimeout(() => setOuverte(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Ta localité (quartier, ville…)"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
        />
      </div>

      {ouverte && suggestions.length > 0 && (
        <ul
          ref={listeRef}
          id="localite-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/15 bg-surface shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.type}-${s.id}`} role="option" aria-selected={i === actifBorne}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(s)}
                onMouseEnter={() => setActif(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink transition-colors ${
                  i === actifBorne ? "bg-brand/10" : "hover:bg-ink/5"
                }`}
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

      {aucunResultat && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 flex flex-col gap-2 rounded-xl border border-ink/15 bg-surface p-3 shadow-lg">
          <p className="text-xs text-ink/60">Cette localité n&apos;est pas encore desservie.</p>
          <a
            href={lienWhatsApp(`Bonjour SacAdo, je voudrais être livré à : ${texte.trim()}`)}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.preventDefault()}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-semibold text-on-brand"
          >
            <MessageCircle size={14} aria-hidden="true" />
            Nous écrire sur WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
