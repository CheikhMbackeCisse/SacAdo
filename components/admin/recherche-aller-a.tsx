"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export type LienRecherche = { href: string; label: string };

// "Aller à…" (PROMPT_ADMIN Lot 2) : filtre en direct la liste des onglets
// admin par libellé, Entrée navigue vers le premier résultat. Filtre texte
// simple côté client (26 entrées, pas besoin d'aller-retour serveur).
export function RechercheAllerA({ liens }: { liens: LienRecherche[] }) {
  const router = useRouter();
  const [valeur, setValeur] = useState("");

  const resultats = useMemo(() => {
    const q = valeur.trim().toLowerCase();
    if (!q) return [];
    return liens.filter((l) => l.label.toLowerCase().includes(q)).slice(0, 8);
  }, [liens, valeur]);

  const aller = (href: string) => {
    router.push(href);
    setValeur("");
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2 text-sm">
        <Search size={15} className="shrink-0 text-ink/40" aria-hidden="true" />
        <input
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultats[0]) aller(resultats[0].href);
            if (e.key === "Escape") setValeur("");
          }}
          placeholder="Aller à…"
          className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink/40"
        />
      </div>
      {resultats.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-lg">
          {resultats.map((l) => (
            <li key={l.href}>
              <button
                type="button"
                onClick={() => aller(l.href)}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
