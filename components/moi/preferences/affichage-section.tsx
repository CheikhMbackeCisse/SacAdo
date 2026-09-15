"use client";

import { Moon, Smartphone, Sun } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { useTheme, type Theme } from "@/lib/local/theme";
import { useTailleTexte, type TailleTexte } from "@/lib/local/taille-texte";
import { synchroniserAffichage } from "@/lib/moi/preferences-actions";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "clair", label: "Clair", icon: Sun },
  { value: "sombre", label: "Sombre", icon: Moon },
  { value: "systeme", label: "Automatique", icon: Smartphone },
];

const TAILLES: { value: TailleTexte; label: string }[] = [
  { value: "normale", label: "Normale" },
  { value: "grande", label: "Grande" },
  { value: "tres_grande", label: "Très grande" },
];

// Chaque réglage s'applique immédiatement, en local d'abord (rendu instantané,
// sans clignotement), puis synchronisé en base au meilleur effort si le
// client est identifié (TACHE_nettoyage_carrousel_preferences.md §C.2/C.4).
export function AffichageSection() {
  const { identite } = useIdentite();
  const { theme, setTheme } = useTheme();
  const { taille, setTaille } = useTailleTexte();

  const synchroniser = (champs: { theme?: Theme; taille_texte?: TailleTexte }) => {
    if (!identite?.jeton) return;
    void synchroniserAffichage(identite.telephone, identite.jeton, champs);
  };

  return (
    <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
      <div className="flex flex-col gap-2 px-4 py-3">
        <span className="text-sm text-ink">Thème</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-ink/10 p-1">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const actif = theme === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={actif}
                onClick={() => {
                  setTheme(value);
                  synchroniser({ theme: value });
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  actif ? "bg-brand text-on-brand" : "text-ink/60 hover:text-ink"
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">
        <span className="text-sm text-ink">Taille du texte</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-ink/10 p-1">
          {TAILLES.map(({ value, label }) => {
            const actif = taille === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={actif}
                onClick={() => {
                  setTaille(value);
                  synchroniser({ taille_texte: value });
                }}
                className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  actif ? "bg-brand text-on-brand" : "text-ink/60 hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
