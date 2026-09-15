"use client";

import { useEffect, useState } from "react";
import { useIdentite } from "@/lib/local/identite";
import { getLieuxSpeciaux, getLocalites } from "@/lib/supabase/queries";
import type { Localite, LieuSpecial } from "@/lib/supabase/types";
import {
  LocalitePicker,
  type SelectionLocalite,
} from "@/components/checkout/localite-picker";
import { getPreferencesNotifications, setLivraisonDefaut } from "@/lib/moi/preferences-actions";

// Localité par défaut + précision pour le livreur (TACHE_nettoyage_carrousel_
// preferences.md §C.6) : font gagner un écran entier à chaque commande. Même
// composant de sélection que le checkout (components/checkout/localite-picker.tsx).
export function LivraisonSection() {
  const { identite } = useIdentite();
  const [localites, setLocalites] = useState<Localite[]>([]);
  const [lieuxSpeciaux, setLieuxSpeciaux] = useState<LieuSpecial[]>([]);
  const [selection, setSelection] = useState<SelectionLocalite | null>(null);
  const [precision, setPrecision] = useState("");

  useEffect(() => {
    getLocalites().then(setLocalites);
    getLieuxSpeciaux().then(setLieuxSpeciaux);
  }, []);

  useEffect(() => {
    if (!identite?.jeton) return;
    getPreferencesNotifications(identite.telephone, identite.jeton).then((prefs) => {
      if (!prefs) return;
      setPrecision(prefs.precision_livreur ?? "");
      if (prefs.localite_defaut_id != null) {
        const l = localites.find((x) => x.id === prefs.localite_defaut_id);
        if (l) setSelection({ type: "localite", id: l.id, nom: l.nom });
      } else if (prefs.lieu_special_defaut_id != null) {
        const l = lieuxSpeciaux.find((x) => x.id === prefs.lieu_special_defaut_id);
        if (l) setSelection({ type: "special", id: l.id, nom: l.nom });
      }
    });
    // Ne redéclenche pas à chaque frappe : seulement quand les listes arrivent
    // (nécessaires pour résoudre le nom affiché) ou que l'identité change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identite, localites.length, lieuxSpeciaux.length]);

  if (!identite?.jeton) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated px-4 py-3">
        <span className="text-sm text-ink">Livraison</span>
        <p className="text-xs text-ink/50">
          Passe une commande pour enregistrer une localité et une précision par défaut.
        </p>
      </section>
    );
  }

  const enregistrer = async (valeur: {
    selection?: SelectionLocalite | null;
    precision?: string;
  }) => {
    const s = valeur.selection !== undefined ? valeur.selection : selection;
    const p = valeur.precision !== undefined ? valeur.precision : precision;
    await setLivraisonDefaut(identite.telephone, identite.jeton!, {
      localiteDefautId: s?.type === "localite" ? s.id : null,
      lieuSpecialDefautId: s?.type === "special" ? s.id : null,
      precisionLivreur: p.trim() || null,
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-elevated px-4 py-3">
      <span className="text-sm text-ink">Livraison</span>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink/50">Localité par défaut</span>
        <LocalitePicker
          localites={localites}
          lieuxSpeciaux={lieuxSpeciaux}
          value={selection}
          onChange={(v) => {
            setSelection(v);
            enregistrer({ selection: v });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink/50">Précision pour le livreur</span>
        <input
          value={precision}
          onChange={(e) => setPrecision(e.target.value)}
          onBlur={() => enregistrer({ precision })}
          placeholder="Portail bleu, 2e étage…"
          className="min-h-10 rounded-xl border border-ink/15 bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </div>
    </section>
  );
}
