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
              {l.date_livraison_fixe && (
                <p className="text-xs text-brand">Livraison figée le {l.date_livraison_fixe}</p>
              )}
              {l.lat != null && l.lng != null && (
                <p className="text-[11px] text-ink/40">
                  Reconnaissance : rayon {l.rayon_m ?? 0} m{l.mots_cles.length > 0 && ` · ${l.mots_cles.join(", ")}`}
                </p>
              )}
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
  const [lat, setLat] = useState(lieu?.lat != null ? String(lieu.lat) : "");
  const [lng, setLng] = useState(lieu?.lng != null ? String(lieu.lng) : "");
  const [rayonM, setRayonM] = useState(lieu?.rayon_m != null ? String(lieu.rayon_m) : "800");
  const [motsClesTexte, setMotsClesTexte] = useState((lieu?.mots_cles ?? []).join(", "));
  const [dateLivraisonFixe, setDateLivraisonFixe] = useState(lieu?.date_livraison_fixe ?? "");
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
      lat: lat.trim() ? Number(lat) : null,
      lng: lng.trim() ? Number(lng) : null,
      rayonM: lat.trim() && rayonM.trim() ? Number(rayonM) : null,
      motsCles: motsClesTexte
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      dateLivraisonFixe: dateLivraisonFixe.trim() || null,
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

      <p className="text-xs font-medium text-ink/60">
        Reconnaissance automatique <span className="text-ink/40">(facultatif)</span>
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Mots-clés (séparés par des virgules) — déclenchent ce lieu quand le client les tape
        </span>
        <input
          value={motsClesTexte}
          onChange={(e) => setMotsClesTexte(e.target.value)}
          placeholder="EPT, polytechnique, poly thies"
          className={CHAMP}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Latitude</span>
          <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="14.78896" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Longitude</span>
          <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-16.9246" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Rayon (m)</span>
          <input
            type="number"
            min={1}
            value={rayonM}
            onChange={(e) => setRayonM(e.target.value)}
            className={CHAMP}
          />
        </label>
      </div>
      <p className="text-[11px] text-ink/45">
        Une épingle posée dans ce rayon autour de la position résout automatiquement ce lieu, même sans
        sélection manuelle.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Date de livraison figée <span className="text-ink/40">(facultatif, sans date limite de commande)</span>
        </span>
        <input
          type="date"
          value={dateLivraisonFixe}
          onChange={(e) => setDateLivraisonFixe(e.target.value)}
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
