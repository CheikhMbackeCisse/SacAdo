"use client";

import { useState } from "react";
import Link from "next/link";
import { Moon, Pencil, Smartphone, Sun } from "lucide-react";
import { useIdentite, type Identite } from "@/lib/local/identite";
import { useTheme, type Theme } from "@/lib/local/theme";
import { InstallCard } from "@/components/pwa/install-card";
import { modifierNomClient } from "@/lib/moi/actions";
import { reinitialiserRecommandations } from "@/lib/reco-actions";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "clair", label: "Clair", icon: Sun },
  { value: "sombre", label: "Sombre", icon: Moon },
  { value: "systeme", label: "Système", icon: Smartphone },
];

export default function ParametresPage() {
  const { identite, setIdentite, oublier } = useIdentite();
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
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-sm text-ink">Compte</span>
          {identite ? (
            <NomCompte identite={identite} onChange={(nom) => setIdentite({ ...identite, nom })} />
          ) : (
            <span className="text-xs text-ink/50">Aucune commande enregistrée sur cet appareil</span>
          )}
        </div>
        <Link href="/politique-confidentialite" className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Confidentialité</span>
          <span className="text-xs text-brand">Voir la politique →</span>
        </Link>
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-sm text-ink">Recommandations</span>
          <ReinitialiserReco identite={identite} />
        </div>
      </section>

      {identite && (
        <button
          type="button"
          onClick={() => {
            oublier();
            // Rechargement COMPLET voulu : on repart du tout début de l'app
            // (splash + écran de bienvenue), sans état résiduel de session.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/";
          }}
          className="self-start rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition-colors active:scale-95"
        >
          Se déconnecter
        </button>
      )}
    </div>
  );
}

function ReinitialiserReco({ identite }: { identite: Identite | null }) {
  const [etat, setEtat] = useState<"repos" | "encours" | "fait">("repos");

  const lancer = async () => {
    setEtat("encours");
    await reinitialiserRecommandations(identite?.telephone ?? null, identite?.jeton ?? null);
    setEtat("fait");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-ink/50">
        Efface ce que l&apos;app a appris de ta navigation (et de celle de tes enfants). L&apos;accueil
        repart du classement général.
      </p>
      <button
        type="button"
        onClick={lancer}
        disabled={etat === "encours"}
        className="self-start rounded-full border border-ink/15 px-3.5 py-1.5 text-xs font-medium text-ink transition-colors active:scale-95 disabled:opacity-50"
      >
        {etat === "encours"
          ? "…"
          : etat === "fait"
            ? "Recommandations réinitialisées ✓"
            : "Réinitialiser mes recommandations"}
      </button>
    </div>
  );
}

function NomCompte({ identite, onChange }: { identite: Identite; onChange: (nom: string) => void }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(identite.nom);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!edition) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink/50">
          {identite.nom || "—"} · {identite.telephone}
        </span>
        {identite.jeton && (
          <button
            type="button"
            onClick={() => {
              setValeur(identite.nom);
              setErreur(null);
              setEdition(true);
            }}
            aria-label="Modifier le nom"
            className="shrink-0 rounded-lg p-1.5 text-ink/50 hover:bg-ink/5"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  const enregistrer = async () => {
    if (!identite.jeton) return;
    setEnCours(true);
    setErreur(null);
    const res = await modifierNomClient(identite.telephone, identite.jeton, valeur);
    if (!res.ok) {
      setErreur(res.error);
      setEnCours(false);
      return;
    }
    onChange(res.nom);
    setEnCours(false);
    setEdition(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className="min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        autoFocus
      />
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours || !valeur.trim()}
          className="min-h-9 rounded-full bg-brand px-3.5 text-xs font-semibold text-on-brand active:scale-95 disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setEdition(false)}
          className="min-h-9 rounded-full border border-ink/15 px-3.5 text-xs font-medium text-ink/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
