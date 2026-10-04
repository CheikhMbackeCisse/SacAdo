"use client";

import { useEffect, useState } from "react";
import { useIdentite } from "@/lib/local/identite";
import { getLieuxSpeciaux } from "@/lib/supabase/queries";
import type { LieuSpecial } from "@/lib/supabase/types";
import {
  LieuSpecialPicker,
  type SelectionLieuSpecial,
} from "@/components/checkout/localite-picker";
import { getPreferencesNotifications, setLivraisonDefaut } from "@/lib/moi/preferences-actions";

// Lieu spécial par défaut + précision pour le livreur (TACHE_nettoyage_
// carrousel_preferences.md §C.6) : font gagner un écran entier à chaque
// commande. La localité "normale" n'est plus choisie ici ni au checkout —
// elle est déterminée depuis le point de livraison (PROMPT_CLIENT_
// LOCALISATION.md Lot 2). Même composant de sélection que le checkout
// (components/checkout/localite-picker.tsx).
export function LivraisonSection() {
  const { identite } = useIdentite();
  const [lieuxSpeciaux, setLieuxSpeciaux] = useState<LieuSpecial[]>([]);
  const [selection, setSelection] = useState<SelectionLieuSpecial>(null);
  const [precision, setPrecision] = useState("");

  useEffect(() => {
    getLieuxSpeciaux().then(setLieuxSpeciaux);
  }, []);

  useEffect(() => {
    if (!identite?.jeton) return;
    getPreferencesNotifications(identite.telephone, identite.jeton).then((prefs) => {
      if (!prefs) return;
      setPrecision(prefs.precision_livreur ?? "");
      if (prefs.lieu_special_defaut_id != null) {
        const l = lieuxSpeciaux.find((x) => x.id === prefs.lieu_special_defaut_id);
        if (l) setSelection({ id: l.id, nom: l.nom });
      }
    });
    // Ne redéclenche pas à chaque frappe : seulement quand la liste arrive
    // (nécessaire pour résoudre le nom affiché) ou que l'identité change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identite, lieuxSpeciaux.length]);

  if (!identite?.jeton) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated px-4 py-3">
        <span className="text-sm text-ink">Livraison</span>
        <p className="text-xs text-ink/50">
          Passe une commande pour enregistrer un lieu spécial et une précision par défaut.
        </p>
      </section>
    );
  }

  const enregistrer = async (valeur: {
    selection?: SelectionLieuSpecial;
    precision?: string;
  }) => {
    const s = valeur.selection !== undefined ? valeur.selection : selection;
    const p = valeur.precision !== undefined ? valeur.precision : precision;
    await setLivraisonDefaut(identite.telephone, identite.jeton!, {
      localiteDefautId: null,
      lieuSpecialDefautId: s?.id ?? null,
      precisionLivreur: p.trim() || null,
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-elevated px-4 py-3">
      <span className="text-sm text-ink">Livraison</span>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink/50">Lieu spécial par défaut (retrait, destination hors domicile)</span>
        <LieuSpecialPicker
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
