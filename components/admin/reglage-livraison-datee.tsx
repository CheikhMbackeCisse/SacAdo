"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import {
  ajouterDateFermeeAdmin,
  reglerHeureLimiteSamedi,
  retirerDateFermeeAdmin,
} from "@/lib/admin/zones-actions";

// Livraison "à date donnée" (maj-accueil §7) : heure limite du samedi
// (au-delà, une commande passe au samedi suivant) + dates fermées (jours
// fériés, Magal, Tabaski...), pour que la date calculée les évite.
export function ReglageLivraisonDatee({
  heureLimiteSamedi,
  datesFermees,
}: {
  heureLimiteSamedi: string | null;
  datesFermees: { date: string; motif: string | null }[];
}) {
  const router = useRouter();
  const [heure, setHeure] = useState(heureLimiteSamedi ?? "");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nouvelleDate, setNouvelleDate] = useState("");
  const [nouveauMotif, setNouveauMotif] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  const modifie = heure !== (heureLimiteSamedi ?? "");

  const enregistrerHeure = async () => {
    setSaving(true);
    setError(null);
    const res = await reglerHeureLimiteSamedi(heure.trim() || null);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
    router.refresh();
  };

  const ajouterDate = async () => {
    if (!nouvelleDate) return;
    setAjoutEnCours(true);
    setError(null);
    const res = await ajouterDateFermeeAdmin(nouvelleDate, nouveauMotif.trim() || null);
    setAjoutEnCours(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNouvelleDate("");
    setNouveauMotif("");
    router.refresh();
  };

  const retirerDate = async (date: string) => {
    await retirerDateFermeeAdmin(date);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-3.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink/70">Heure limite du samedi</span>
        <input
          type="time"
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
          className="w-28 rounded-lg border border-ink/15 px-2 py-1 text-ink focus:border-brand focus:outline-none"
        />
        <span className="text-xs text-ink/45">Vide = aucune (toute commande du samedi part dimanche)</span>
        {modifie && (
          <button
            type="button"
            onClick={enregistrerHeure}
            disabled={saving}
            className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-surface disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : "Enregistrer"}
          </button>
        )}
        {ok && (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <Check size={12} /> Enregistré
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
        <span className="text-ink/70">Dates fermées</span>
        {datesFermees.length > 0 && (
          <ul className="flex flex-col gap-1">
            {datesFermees.map((d) => (
              <li key={d.date} className="flex items-center gap-2 rounded-lg bg-ink/[0.03] px-2.5 py-1.5 text-xs">
                <span className="font-medium text-ink">{d.date}</span>
                {d.motif && <span className="text-ink/50">{d.motif}</span>}
                <button
                  type="button"
                  onClick={() => retirerDate(d.date)}
                  aria-label="Retirer cette date"
                  className="ml-auto text-ink/40 hover:text-ink/70"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={nouvelleDate}
            onChange={(e) => setNouvelleDate(e.target.value)}
            className="rounded-lg border border-ink/15 px-2 py-1 text-ink focus:border-brand focus:outline-none"
          />
          <input
            type="text"
            placeholder="Motif (Magal, Tabaski…)"
            value={nouveauMotif}
            onChange={(e) => setNouveauMotif(e.target.value)}
            className="w-40 rounded-lg border border-ink/15 px-2 py-1 text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={ajouterDate}
            disabled={!nouvelleDate || ajoutEnCours}
            className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-surface disabled:opacity-50"
          >
            {ajoutEnCours ? <Loader2 size={12} className="animate-spin" /> : "Ajouter"}
          </button>
        </div>
      </div>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
