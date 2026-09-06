"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  creerLieuSpecial,
  modifierLieuSpecial,
  supprimerLieuSpecial,
} from "@/lib/admin/lieux-speciaux-actions";
import { formatPrice } from "@/lib/format";
import type { LieuSpecial, ModeLieuSpecial } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

const LABEL_MODE: Record<ModeLieuSpecial, string> = {
  livraison: "Livraison",
  retrait: "Retrait",
  a_confirmer: "Tarif à confirmer",
};

const MODES: ModeLieuSpecial[] = ["livraison", "retrait", "a_confirmer"];

export function LieuxSpeciauxEditor({ lieux }: { lieux: LieuSpecial[] }) {
  const [cible, setCible] = useState<LieuSpecial | "nouveau" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {cible === null && (
        <button
          type="button"
          onClick={() => setCible("nouveau")}
          className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un lieu spécial
        </button>
      )}

      {cible !== null && <FormLieuSpecial lieu={cible === "nouveau" ? null : cible} onFini={() => setCible(null)} />}

      {lieux.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun lieu spécial enregistré.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lieux.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{l.nom}</p>
                  <p className="text-xs text-ink/50">
                    {LABEL_MODE[l.mode]} — {l.tarif != null ? formatPrice(l.tarif) : "sans tarif fixe"}
                  </p>
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
                  <SupprimerBouton lieu={l} />
                </div>
              </div>
              {l.message && <p className="text-ink/60">{l.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormLieuSpecial({ lieu, onFini }: { lieu: LieuSpecial | null; onFini: () => void }) {
  const router = useRouter();
  const [nom, setNom] = useState(lieu?.nom ?? "");
  const [mode, setMode] = useState<ModeLieuSpecial>(lieu?.mode ?? "livraison");
  const [tarif, setTarif] = useState(lieu?.tarif != null ? String(lieu.tarif) : "");
  const [message, setMessage] = useState(lieu?.message ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input = {
      nom: nom.trim(),
      tarif: mode === "a_confirmer" ? null : Number(tarif),
      mode,
      message: message.trim() || null,
    };
    const res = lieu ? await modifierLieuSpecial(lieu.id, input) : await creerLieuSpecial(input);
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
      <p className="text-sm font-semibold text-ink">{lieu ? `Modifier « ${lieu.nom} »` : "Nouveau lieu spécial"}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Mode</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as ModeLieuSpecial)} className={CHAMP}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {LABEL_MODE[m]}
            </option>
          ))}
        </select>
      </label>

      {mode !== "a_confirmer" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Tarif (FCFA)</span>
          <input type="number" min={0} value={tarif} onChange={(e) => setTarif(e.target.value)} className={CHAMP} />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Message affiché au client <span className="text-ink/40">(facultatif)</span>
        </span>
        <textarea
          rows={2}
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={CHAMP}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting || !nom.trim() || (mode !== "a_confirmer" && !tarif)}
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

function SupprimerBouton({ lieu }: { lieu: LieuSpecial }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerLieuSpecial(lieu.id);
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
