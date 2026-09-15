"use client";

import { useEffect, useState } from "react";
import { useIdentite, type Identite } from "@/lib/local/identite";
import {
  getPreferencesNotifications,
  setPersonnalisation,
} from "@/lib/moi/preferences-actions";
import { reinitialiserRecommandations } from "@/lib/reco-actions";
import { Interrupteur } from "@/components/moi/preferences-notifications";

export function RecommandationsSection() {
  const { identite } = useIdentite();

  return (
    <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
      <div className="px-4 py-3">
        <span className="mb-2 block text-sm text-ink">Recommandations</span>
        <PersonnalisationToggle identite={identite} />
      </div>
      <div className="flex flex-col gap-2 px-4 py-3">
        <ReinitialiserReco identite={identite} />
      </div>
    </section>
  );
}

function PersonnalisationToggle({ identite }: { identite: Identite | null }) {
  const [actif, setActif] = useState(true);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!identite?.jeton) return;
    getPreferencesNotifications(identite.telephone, identite.jeton).then((prefs) => {
      if (prefs) setActif(prefs.personnalisation);
    });
  }, [identite]);

  if (!identite?.jeton) {
    return (
      <p className="text-xs text-ink/50">
        Passe une commande pour activer la personnalisation de l&apos;accueil.
      </p>
    );
  }

  const changer = async (valeur: boolean) => {
    const precedent = actif;
    setActif(valeur);
    setOccupe(true);
    const res = await setPersonnalisation(identite.telephone, identite.jeton!, valeur);
    setOccupe(false);
    if (!res.ok) setActif(precedent);
  };

  return (
    <label className="flex items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm text-ink">Personnaliser l&apos;accueil selon mes consultations</span>
        <span className="text-xs text-ink/50">
          Désactivé, l&apos;accueil affiche le classement général, identique pour tous.
        </span>
      </span>
      <Interrupteur actif={actif} occupe={occupe} onChange={changer} />
    </label>
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
