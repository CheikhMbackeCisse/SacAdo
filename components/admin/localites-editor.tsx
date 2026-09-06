"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";
import {
  creerLocalite,
  modifierLocalite,
  supprimerLocalite,
} from "@/lib/admin/localites-actions";
import type { Localite, Zone } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function LocalitesEditor({ localites, groupes }: { localites: Localite[]; groupes: Zone[] }) {
  const [cible, setCible] = useState<Localite | "nouveau" | null>(null);
  const nomGroupe = (groupeId: number) => groupes.find((g) => g.id === groupeId)?.nom ?? "—";

  return (
    <div className="flex flex-col gap-4">
      {cible === null && (
        <button
          type="button"
          onClick={() => setCible("nouveau")}
          className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter une localité
        </button>
      )}

      {cible !== null && (
        <FormLocalite localite={cible === "nouveau" ? null : cible} groupes={groupes} onFini={() => setCible(null)} />
      )}

      {localites.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune localité enregistrée.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {localites.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{l.nom}</p>
                  <p className="text-xs text-ink/50">{nomGroupe(l.groupe_id)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setCible(l)}
                    aria-label={`Modifier ${l.nom}`}
                    className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <SupprimerBouton localite={l} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormLocalite({
  localite,
  groupes,
  onFini,
}: {
  localite: Localite | null;
  groupes: Zone[];
  onFini: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(localite?.nom ?? "");
  const [groupeId, setGroupeId] = useState<number>(localite?.groupe_id ?? groupes[0]?.id ?? 0);
  const [position, setPosition] = useState<Coordonnees | null>(
    localite?.lat != null && localite?.lng != null ? { lat: localite.lat, lng: localite.lng } : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input = {
      nom: nom.trim(),
      groupeId,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
    };
    const res = localite ? await modifierLocalite(localite.id, input) : await creerLocalite(input);
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    onFini();
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-white p-4">
      <p className="text-sm font-semibold text-ink">
        {localite ? `Modifier « ${localite.nom} »` : "Nouvelle localité"}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Groupe de livraison</span>
        <select value={groupeId} onChange={(e) => setGroupeId(Number(e.target.value))} className={CHAMP}>
          {groupes.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nom}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Position de référence <span className="text-ink/40">(facultatif)</span>
        </span>
        <CartePin position={position} onChange={setPosition} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting || !nom.trim() || !groupeId}
          className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50 sm:flex-none"
        >
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onFini}
          className="min-h-11 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function SupprimerBouton({ localite }: { localite: Localite }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerLocalite(localite.id);
    router.refresh();
  };

  if (confirme) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={supprimer}
          disabled={enCours}
          className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50"
        >
          Supprimer
        </button>
        <button type="button" onClick={() => setConfirme(false)} className="text-ink/50">
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirme(true)}
      aria-label={`Supprimer ${localite.nom}`}
      className="rounded-lg p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}
