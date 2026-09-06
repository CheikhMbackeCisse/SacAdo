"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";
import {
  creerLieuConnu,
  modifierLieuConnu,
  supprimerLieuConnu,
  type LieuConnu,
} from "@/lib/admin/lieux-actions";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function LieuxEditor({ lieux }: { lieux: LieuConnu[] }) {
  const [cible, setCible] = useState<LieuConnu | "nouveau" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {cible === null && (
        <button
          type="button"
          onClick={() => setCible("nouveau")}
          className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un lieu
        </button>
      )}

      {cible !== null && (
        <FormLieu lieu={cible === "nouveau" ? null : cible} onFini={() => setCible(null)} />
      )}

      {lieux.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun lieu enregistré. Teste d&apos;abord la recherche au checkout ; ajoute ici
          les écoles / repères que la recherche ne trouve pas bien.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lieux.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">{l.nom}</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setCible(l)}
                    aria-label={`Modifier ${l.nom}`}
                    className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <SupprimerBouton lieu={l} />
                </div>
              </div>
              <p className="flex items-center gap-1 text-xs text-ink/40">
                <MapPin size={12} aria-hidden="true" />
                {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormLieu({ lieu, onFini }: { lieu: LieuConnu | null; onFini: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState(lieu?.nom ?? "");
  const [position, setPosition] = useState<Coordonnees | null>(
    lieu ? { lat: lieu.lat, lng: lieu.lng } : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input = {
      nom: nom.trim(),
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
    };
    const res = lieu ? await modifierLieuConnu(lieu.id, input) : await creerLieuConnu(input);
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
        {lieu ? `Modifier « ${lieu.nom} »` : "Nouveau lieu"}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Nom du lieu</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex. : École Polytechnique de Thiès"
          className={CHAMP}
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-ink/60">Position du lieu</span>
        <p className="text-xs text-ink/45">
          Recherche l&apos;adresse ou place l&apos;épingle à la main.
        </p>
        <CartePin position={position} onChange={setPosition} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting || !nom.trim() || !position}
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

function SupprimerBouton({ lieu }: { lieu: LieuConnu }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerLieuConnu(lieu.id);
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
      aria-label={`Supprimer ${lieu.nom}`}
      className="rounded-lg p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}
