"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getApercuPreparation,
  creerDemandePreparation,
  type ApercuPreparation,
  type VendeurEnAttente,
} from "@/lib/admin/preparations-actions";
import { BonPreparation } from "@/components/admin/bon-preparation";

export function PreparationNouvelle({ vendeurs }: { vendeurs: VendeurEnAttente[] }) {
  const router = useRouter();
  const [vendeurId, setVendeurId] = useState("");
  const [apercu, setApercu] = useState<ApercuPreparation | null>(null);
  const [note, setNote] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrerEnvoi] = useTransition();

  const choisir = async (id: string) => {
    setVendeurId(id);
    setApercu(null);
    setErreur(null);
    if (!id) return;
    setChargement(true);
    const res = await getApercuPreparation(id);
    setApercu(res);
    setChargement(false);
  };

  const creer = () => {
    setErreur(null);
    demarrerEnvoi(async () => {
      const res = await creerDemandePreparation(vendeurId, note.trim() || undefined);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      router.push(`/admin/preparations/${res.id}`);
    });
  };

  if (vendeurs.length === 0) {
    return (
      <p className="rounded-2xl border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/50">
        Aucun fournisseur n&apos;a d&apos;article en attente de préparation.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Fournisseur</span>
        <select
          value={vendeurId}
          onChange={(e) => choisir(e.target.value)}
          className="min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        >
          <option value="">— Choisir —</option>
          {vendeurs.map((v) => (
            <option key={v.vendeurId} value={v.vendeurId}>
              {v.nom} ({v.nbArticles} article{v.nbArticles > 1 ? "s" : ""}, {v.nbCommandes} client
              {v.nbCommandes > 1 ? "s" : ""})
            </option>
          ))}
        </select>
      </label>

      {chargement && <p className="text-sm text-ink/50">Chargement…</p>}

      {apercu && apercu.groupes.length > 0 && (
        <>
          <BonPreparation
            groupes={apercu.groupes}
            totaux={apercu.totaux}
            nbArticles={apercu.nbArticles}
          />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-ink/60">
              Note pour le fournisseur <span className="text-ink/40">(facultatif)</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </label>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={creer}
              disabled={envoi}
              className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand active:scale-95 disabled:opacity-50 sm:flex-none"
            >
              {envoi ? "Création…" : "Créer la demande"}
            </button>
          </div>
        </>
      )}

      {apercu && apercu.groupes.length === 0 && (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Plus aucun article en attente pour ce fournisseur.
        </p>
      )}
    </div>
  );
}
