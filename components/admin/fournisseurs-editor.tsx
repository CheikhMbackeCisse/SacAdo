"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";
import {
  creerFournisseur,
  modifierFournisseur,
  supprimerFournisseur,
} from "@/lib/admin/fournisseurs-actions";
import type { Fournisseur } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function FournisseursEditor({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  // null = aucun formulaire ouvert ; "nouveau" = création ; un objet = édition.
  const [cible, setCible] = useState<Fournisseur | "nouveau" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {cible === null && (
        <button
          type="button"
          onClick={() => setCible("nouveau")}
          className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un fournisseur
        </button>
      )}

      {cible !== null && (
        <FormFournisseur
          fournisseur={cible === "nouveau" ? null : cible}
          onFini={() => setCible(null)}
        />
      )}

      {fournisseurs.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun fournisseur enregistré.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {fournisseurs.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">{f.nom}</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setCible(f)}
                    aria-label={`Modifier ${f.nom}`}
                    className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <SupprimerBouton fournisseur={f} />
                </div>
              </div>
              {f.adresse && <p className="text-ink/60">{f.adresse}</p>}
              <p className="flex items-center gap-1 text-xs text-ink/40">
                <MapPin size={12} aria-hidden="true" />
                {f.lat != null && f.lng != null
                  ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`
                  : "Position non renseignée"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormFournisseur({
  fournisseur,
  onFini,
}: {
  fournisseur: Fournisseur | null;
  onFini: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(fournisseur?.nom ?? "");
  const [adresse, setAdresse] = useState(fournisseur?.adresse ?? "");
  const [position, setPosition] = useState<Coordonnees | null>(
    fournisseur?.lat != null && fournisseur?.lng != null
      ? { lat: fournisseur.lat, lng: fournisseur.lng }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input = {
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
    };
    const res = fournisseur
      ? await modifierFournisseur(fournisseur.id, input)
      : await creerFournisseur(input);
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
        {fournisseur ? `Modifier « ${fournisseur.nom} »` : "Nouveau fournisseur"}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Adresse / point de repère <span className="text-ink/40">(facultatif)</span>
        </span>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={CHAMP} />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-ink/60">Où récupérer la marchandise ?</span>
        <CartePin position={position} onChange={setPosition} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting || !nom.trim()}
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

function SupprimerBouton({ fournisseur }: { fournisseur: Fournisseur }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerFournisseur(fournisseur.id);
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
      aria-label={`Supprimer ${fournisseur.nom}`}
      className="rounded-lg p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}
