"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, MessageCircle, Search } from "lucide-react";
import { lienLocaliteLivraison } from "@/lib/whatsapp";
import { normaliserTexteLieu } from "@/lib/checkout/lieu-special";
import type { LieuSpecial } from "@/lib/supabase/types";

// Sélection d'un lieu spécial (retrait, ville hors zone habituelle à
// confirmer…) : la localité "normale" n'est plus choisie ici, elle est
// déterminée côté serveur à partir du point de livraison
// (PROMPT_CLIENT_LOCALISATION.md Lot 2). Ce picker ne sert plus qu'à
// l'alternative "je ne me fais pas livrer à domicile".
export type SelectionLieuSpecial = { id: number; nom: string } | null;

// `cles` = nom + mots-clés normalisés (migration 0119) : "poly thies" ou
// "ept" retrouvent le lieu même quand ce n'est pas un sous-texte littéral
// du nom officiel.
type Suggestion = { id: number; nom: string; cles: string[] };

const MAX_RESULTATS = 60;

function normaliser(s: string): string {
  return normaliserTexteLieu(s);
}

type Props = {
  lieuxSpeciaux: LieuSpecial[];
  value: SelectionLieuSpecial;
  onChange: (value: SelectionLieuSpecial) => void;
};

export function LieuSpecialPicker({ lieuxSpeciaux, value, onChange }: Props) {
  const [texte, setTexte] = useState(() => value?.nom ?? "");
  const [ouverte, setOuverte] = useState(false);
  const [actif, setActif] = useState(0);
  const listeRef = useRef<HTMLUListElement>(null);

  const toutes: Suggestion[] = useMemo(
    () =>
      lieuxSpeciaux
        .map((l) => ({
          id: l.id,
          nom: l.nom,
          cles: [normaliser(l.nom), ...(l.mots_cles ?? []).map(normaliser)],
        }))
        .sort((x, y) => x.nom.localeCompare(y.nom)),
    [lieuxSpeciaux],
  );

  const requete = normaliser(texte);
  const selectionValide = value != null && value.nom === texte;

  const suggestions: Suggestion[] = useMemo(() => {
    if (!requete) return toutes.slice(0, MAX_RESULTATS);
    // Priorité au nom (préfixe, puis sous-chaîne), puis aux mots-clés seuls.
    const prefixe: Suggestion[] = [];
    const interieur: Suggestion[] = [];
    const parMotCle: Suggestion[] = [];
    for (const s of toutes) {
      const norme = s.cles[0];
      if (norme.startsWith(requete)) prefixe.push(s);
      else if (norme.includes(requete)) interieur.push(s);
      else if (s.cles.some((c) => c === requete || c.includes(requete))) parMotCle.push(s);
    }
    return [...prefixe, ...interieur, ...parMotCle].slice(0, MAX_RESULTATS);
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
    onChange({ id: s.id, nom: s.nom });
  };

  const majTexte = (v: string) => {
    setTexte(v);
    setOuverte(true);
    setActif(0);
    // Toute frappe qui ne correspond plus exactement à la sélection l'annule :
    // on ne peut valider qu'avec une entrée de la liste.
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
          aria-controls="lieu-special-suggestions"
          aria-autocomplete="list"
          value={texte}
          onChange={(e) => majTexte(e.target.value)}
          onFocus={() => setOuverte(true)}
          onBlur={() => setTimeout(() => setOuverte(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Retrait, ville hors zone habituelle…"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
        />
      </div>

      {ouverte && suggestions.length > 0 && (
        <ul
          ref={listeRef}
          id="lieu-special-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/15 bg-surface shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === actifBorne}>
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
                <span className="min-w-0 flex-1 truncate">{s.nom}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aucunResultat && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 flex flex-col gap-2 rounded-xl border border-ink/15 bg-surface p-3 shadow-lg">
          <p className="text-xs text-ink/60">Ce lieu n&apos;est pas dans la liste.</p>
          <a
            href={lienLocaliteLivraison(texte.trim())}
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
