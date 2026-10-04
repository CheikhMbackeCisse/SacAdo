"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type OptionSelect = { value: string; label: string; disabled?: boolean };

type Props = {
  options: OptionSelect[];
  // "" (ou une valeur absente de la liste) => le placeholder s'affiche et
  // AUCUNE option n'apparaît cochée. L'utilisateur doit choisir activement.
  value: string;
  onChange: (value: string) => void;
  // Appelé avec l'option complète au moment du choix (en plus de onChange) —
  // utile en mode recherche serveur pour retenir le libellé affiché sans
  // garder toute la liste des résultats précédents.
  onSelect?: (option: OptionSelect) => void;
  placeholder: string;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  // Classes du bouton déclencheur (bordure, rayon, taille selon le contexte).
  className?: string;
  // Classes du conteneur (largeur, positionnement dans une rangée…).
  wrapperClassName?: string;
  // Ancrage horizontal du menu quand le déclencheur est court.
  align?: "start" | "end";
  // Filtre de recherche. Par défaut : automatique au-delà de 8 options.
  searchable?: boolean;
  // Recherche côté serveur (catalogues trop grands pour être préchargés en
  // entier : produits d'un kit, remplacement de produit…). Quand fourni,
  // `options` ne sert qu'à afficher le libellé de la valeur déjà choisie ;
  // la liste affichée vient de cet appel, débouncé, à chaque frappe.
  onSearch?: (terme: string) => Promise<OptionSelect[]>;
  // Texte affiché avant la première frappe en mode recherche serveur.
  searchHint?: string;
};

// Liste déroulante maison : remplace <select> natif là où le picker natif
// (iOS surtout) pré-surligne une vraie option et la valide au « Terminé » sans
// choix explicite. Ici, tant que `value` ne correspond à rien, rien n'est
// mis en avant. Calqué sur l'ancien RegionPicker.
export function ChampSelect({
  options,
  value,
  onChange,
  onSelect,
  placeholder,
  disabled = false,
  ariaLabel,
  id,
  className = "",
  wrapperClassName = "",
  align = "start",
  searchable,
  onSearch,
  searchHint = "Tapez pour chercher…",
}: Props) {
  const autoId = useId();
  const listboxId = `${id ?? autoId}-listbox`;
  const conteneurRef = useRef<HTMLDivElement>(null);
  const rechercheRef = useRef<HTMLInputElement>(null);

  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [indexActif, setIndexActif] = useState(-1);
  const [resultatsServeur, setResultatsServeur] = useState<OptionSelect[] | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  const optionsActivables = options.filter((o) => !o.disabled);
  const avecRecherche = searchable ?? (!!onSearch || optionsActivables.length > 8);

  const selection =
    options.find((o) => o.value === value && !o.disabled) ??
    resultatsServeur?.find((o) => o.value === value) ??
    null;

  // Recherche serveur débouncée (250 ms), déclenchée depuis la frappe (pas un
  // effect : un setState synchrone dans un effect provoquerait un rendu en
  // cascade évitable ici).
  const debounceRecherche = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lancerRecherche = (terme: string) => {
    if (debounceRecherche.current) clearTimeout(debounceRecherche.current);
    if (!onSearch) return;
    const q = terme.trim();
    if (!q) {
      setResultatsServeur(null);
      setRechercheEnCours(false);
      return;
    }
    setRechercheEnCours(true);
    debounceRecherche.current = setTimeout(() => {
      onSearch(q).then((resultats) => {
        setResultatsServeur(resultats);
        setRechercheEnCours(false);
      });
    }, 250);
  };
  useEffect(() => () => {
    if (debounceRecherche.current) clearTimeout(debounceRecherche.current);
  }, []);

  const visibles = useMemo(() => {
    if (onSearch) return resultatsServeur ?? [];
    const q = recherche.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.disabled || o.label.toLowerCase().includes(q));
  }, [options, recherche, onSearch, resultatsServeur]);

  const ouvrir = () => {
    if (disabled) return;
    setRecherche("");
    setResultatsServeur(null);
    setIndexActif(-1);
    setOuvert(true);
  };
  const fermer = () => {
    setOuvert(false);
    setRecherche("");
    setResultatsServeur(null);
    setIndexActif(-1);
  };
  const basculer = () => (ouvert ? fermer() : ouvrir());

  const choisir = (option: OptionSelect) => {
    if (option.disabled) return;
    onChange(option.value);
    onSelect?.(option);
    fermer();
  };

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    const surClicExterne = (event: PointerEvent) => {
      if (!conteneurRef.current?.contains(event.target as Node)) fermer();
    };
    document.addEventListener("pointerdown", surClicExterne);
    return () => document.removeEventListener("pointerdown", surClicExterne);
  }, [ouvert]);

  // Focus le champ de recherche à l'ouverture (si présent).
  useEffect(() => {
    if (ouvert && avecRecherche) {
      const t = setTimeout(() => rechercheRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [ouvert, avecRecherche]);

  const surTouche = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (!ouvert) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ouvrir();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      fermer();
      return;
    }
    if (event.key === "Tab") {
      fermer();
      return;
    }
    const activables = visibles
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const position = activables.findIndex(({ i }) => i > indexActif);
      const cible = position === -1 ? activables[0] : activables[position];
      if (cible) setIndexActif(cible.i);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const avant = [...activables].reverse().find(({ i }) => i < indexActif || indexActif === -1);
      if (avant) setIndexActif(avant.i);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const cible = visibles[indexActif];
      if (cible && !cible.disabled) choisir(cible);
    }
  };

  return (
    <div ref={conteneurRef} className={`relative ${wrapperClassName}`} onKeyDown={surTouche}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={basculer}
        className={`flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 ${className} ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
      >
        <span className={selection ? "text-ink" : "text-ink/40"}>
          {selection?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-ink/40 transition-transform ${ouvert ? "rotate-180" : ""}`}
        />
      </button>

      {ouvert && (
        <div
          className={`absolute top-full z-30 mt-1 min-w-full ${
            align === "end" ? "right-0" : "left-0"
          } w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink/10 bg-elevated shadow-lg`}
        >
          {avecRecherche && (
            <div className="border-b border-ink/10 p-1.5">
              <input
                ref={rechercheRef}
                value={recherche}
                onChange={(event) => {
                  setRecherche(event.target.value);
                  setIndexActif(-1);
                  lancerRecherche(event.target.value);
                }}
                placeholder="Rechercher…"
                className="w-full rounded-lg border border-ink/15 bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
              />
            </div>
          )}

          <ul role="listbox" id={listboxId} className="max-h-60 overflow-y-auto py-1">
            {onSearch && !recherche.trim() && (
              <li className="px-3 py-3 text-center text-sm text-ink/50">{searchHint}</li>
            )}
            {onSearch && recherche.trim() && rechercheEnCours && (
              <li className="px-3 py-3 text-center text-sm text-ink/50">Recherche…</li>
            )}
            {(!onSearch || (recherche.trim() && !rechercheEnCours)) && visibles.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-ink/50">Aucun résultat.</li>
            )}
            {(!onSearch || (recherche.trim() && !rechercheEnCours)) && visibles.map((option, index) => {
              if (option.disabled) return null;
              const active = option.value === value;
              const survole = index === indexActif;
              return (
                <li key={option.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndexActif(index)}
                    onClick={() => choisir(option)}
                    className={`flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-2.5 text-left text-sm transition-colors ${
                      survole ? "bg-ink/5" : ""
                    } ${active ? "font-semibold text-brand" : "text-ink"}`}
                  >
                    {option.label}
                    {active && <Check size={15} aria-hidden="true" className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
