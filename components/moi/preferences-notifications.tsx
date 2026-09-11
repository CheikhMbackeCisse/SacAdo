"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import {
  getPreferencesNotifications,
  setPreferenceNotification,
  type FamillePreference,
  type PreferencesResult,
} from "@/lib/moi/preferences-actions";

const FAMILLES: { cle: FamillePreference; label: string; description: string }[] = [
  {
    cle: "suivi_commandes",
    label: "Suivi de mes commandes",
    description: "Confirmée, en route, livrée…",
  },
  {
    cle: "produits_attendus",
    label: "Produits que j'attends",
    description: "Demande trouvée, retour en stock, baisse de prix",
  },
  {
    cle: "rentree_nouveautes",
    label: "Rentrée et nouveautés",
    description: "Rappels de saison, nouveaux produits",
  },
];

// Réglages des notifications push, en trois familles indépendantes
// (TACHE_notifications_client.md §8) — jamais un seul interrupteur global.
// N'affecte que le push : la boîte de réception reçoit toujours tout.
export function PreferencesNotificationsSection() {
  const { identite } = useIdentite();
  const [prefs, setPrefs] = useState<PreferencesResult | null>(null);
  const [enCours, setEnCours] = useState<FamillePreference | null>(null);

  useEffect(() => {
    if (!identite?.jeton) return;
    getPreferencesNotifications(identite.telephone, identite.jeton).then(setPrefs);
  }, [identite]);

  if (!identite?.jeton || !prefs) return null;

  const changer = async (cle: FamillePreference, valeur: boolean) => {
    const precedent = prefs;
    setPrefs({ ...prefs, [cle]: valeur });
    setEnCours(cle);
    const res = await setPreferenceNotification(identite.telephone, identite.jeton!, cle, valeur);
    setEnCours(null);
    if (!res.ok) setPrefs(precedent);
  };

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      {FAMILLES.map(({ cle, label, description }) => (
        <div key={cle} className="flex flex-col gap-1.5 py-1.5">
          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm text-ink">{label}</span>
              <span className="text-xs text-ink/50">{description}</span>
            </span>
            <Interrupteur
              actif={prefs[cle]}
              occupe={enCours === cle}
              onChange={(v) => changer(cle, v)}
            />
          </label>
          {cle === "suivi_commandes" && !prefs.suivi_commandes && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-ink/70">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
              Tu ne seras plus prévenu par notification quand ta commande avance (ta boîte de
              réception, elle, continue de tout recevoir).
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Interrupteur({
  actif,
  occupe,
  onChange,
}: {
  actif: boolean;
  occupe: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      disabled={occupe}
      onClick={() => onChange(!actif)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        actif ? "bg-brand" : "bg-ink/15"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          actif ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
