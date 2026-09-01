"use client";

import { useEffect, useState } from "react";
import { Monitor, X } from "lucide-react";

// L'espace admin (tableaux denses, colonnes multiples, formulaires produits/kits,
// carte des commandes) est pensé pour un grand écran. Ce bandeau le rappelle
// sur mobile/tablette. Il ne bloque rien — l'admin peut le fermer.
const CLE = "sacado_admin_hint_desktop";

export function AdminDesktopHint() {
  // Masqué par défaut ; révélé après lecture du choix mémorisé.
  const [masque, setMasque] = useState(true);

  useEffect(() => {
    // setTimeout : évite un setState synchrone dans le corps de l'effet.
    const t = setTimeout(() => {
      try {
        setMasque(window.localStorage.getItem(CLE) === "1");
      } catch {
        setMasque(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const fermer = () => {
    try {
      window.localStorage.setItem(CLE, "1");
    } catch {
      // masqué pour la session de toute façon
    }
    setMasque(true);
  };

  if (masque) return null;

  return (
    <div className="border-b border-brand/20 bg-brand/5 px-4 py-2.5 lg:hidden">
      <div className="flex items-center gap-2.5">
        <Monitor size={16} className="shrink-0 text-brand" aria-hidden="true" />
        <p className="flex-1 text-xs leading-snug text-ink/80">
          L’administration est optimisée pour un ordinateur. Sur mobile, certains
          tableaux et formulaires restent utilisables mais moins confortables —
          préférez un écran large.
        </p>
        <button
          type="button"
          aria-label="Masquer ce message"
          onClick={fermer}
          className="shrink-0 text-ink/40 transition-colors hover:text-ink"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
