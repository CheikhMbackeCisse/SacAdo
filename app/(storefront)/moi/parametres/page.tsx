"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Smartphone, Sun } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { useTheme, type Theme } from "@/lib/local/theme";
import { InstallCard } from "@/components/pwa/install-card";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "clair", label: "Clair", icon: Sun },
  { value: "sombre", label: "Sombre", icon: Moon },
  { value: "systeme", label: "Système", icon: Smartphone },
];

export default function ParametresPage() {
  const router = useRouter();
  const { identite, oublier } = useIdentite();
  const { theme, setTheme } = useTheme();

  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Paramètres</h1>

      <InstallCard />

      <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Langue</span>
          <span className="text-xs text-ink/50">Français</span>
        </div>
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
                  onClick={() => setTheme(value)}
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
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-sm text-ink">Compte</span>
          <span className="text-xs text-ink/50">
            {identite
              ? `${identite.nom || "—"} · ${identite.telephone}`
              : "Aucune commande enregistrée sur cet appareil"}
          </span>
        </div>
        <Link href="/politique-confidentialite" className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Confidentialité</span>
          <span className="text-xs text-brand">Voir la politique →</span>
        </Link>
      </section>

      {identite && (
        <button
          type="button"
          onClick={() => {
            oublier();
            router.push("/moi");
          }}
          className="self-start rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition-colors active:scale-95"
        >
          Se déconnecter
        </button>
      )}
    </div>
  );
}
