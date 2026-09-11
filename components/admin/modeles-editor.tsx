"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { modifierModele, type ModeleInput } from "@/lib/admin/modeles-actions";
import { rendreModele, LIBELLE_CANAL, VARIABLES_MODELE } from "@/lib/messages/modeles";
import type { CanalModele, ModeleMessage } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

// Valeurs d'exemple pour l'aperçu.
const EXEMPLE = {
  prenom: "Awa",
  numero_commande: "1042",
  montant: "18 500",
  localite: "Diamaguène Sicap Mbao",
  articles: "Cahier 200 pages Sandwich",
  lien_commande: "https://sacadosn.vercel.app/suivi/1042",
  lien_produit: "https://sacadosn.vercel.app/produit/12",
  lien: "https://sacadosn.vercel.app/suivi/1042",
};

const ORDRE_CANAUX: CanalModele[] = ["whatsapp", "push", "inbox"];

export function ModelesEditor({ modeles }: { modeles: ModeleMessage[] }) {
  const parCanal = useMemo(() => {
    const map = new Map<CanalModele, ModeleMessage[]>();
    for (const c of ORDRE_CANAUX) map.set(c, []);
    for (const m of modeles) map.get(m.canal)?.push(m);
    return map;
  }, [modeles]);

  return (
    <div className="flex flex-col gap-6">
      {ORDRE_CANAUX.map((canal) => {
        const liste = parCanal.get(canal) ?? [];
        if (liste.length === 0) return null;
        return (
          <section key={canal} className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-ink">{LIBELLE_CANAL[canal]}</h2>
            <ul className="flex flex-col gap-2">
              {liste.map((m) => (
                <LigneModele key={`${m.code}-${m.canal}`} modele={m} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LigneModele({ modele }: { modele: ModeleMessage }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <li className="rounded-2xl border border-ink/10 bg-white">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            {modele.libelle}
            {!modele.actif && (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-medium text-ink/50">
                inactif
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink/45">
            {modele.code} · {modele.contenu}
          </span>
        </span>
        {ouvert ? (
          <Pencil size={15} className="shrink-0 text-brand" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-ink/40" aria-hidden="true" />
        )}
      </button>
      {ouvert && <FormModele modele={modele} onFini={() => setOuvert(false)} />}
    </li>
  );
}

function FormModele({ modele, onFini }: { modele: ModeleMessage; onFini: () => void }) {
  const router = useRouter();
  const sansTitre = modele.canal === "whatsapp";

  const [libelle, setLibelle] = useState(modele.libelle);
  const [titre, setTitre] = useState(modele.titre ?? "");
  const [contenu, setContenu] = useState(modele.contenu);
  const [ordre, setOrdre] = useState(String(modele.ordre));
  const [actif, setActif] = useState(modele.actif);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apercu = rendreModele(contenu, EXEMPLE);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input: ModeleInput = {
      libelle: libelle.trim(),
      titre: sansTitre ? null : titre.trim() || null,
      contenu: contenu.trim(),
      ordre: Number(ordre),
      actif,
    };
    const res = await modifierModele(modele.code, modele.canal, input);
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    onFini();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-ink/10 p-3.5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          {modele.canal === "whatsapp" ? "Libellé du bouton" : "Repère (admin)"}
        </span>
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} className={CHAMP} />
      </label>

      {!sansTitre && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Titre</span>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} className={CHAMP} />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Contenu</span>
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={4}
          className={`${CHAMP} py-2 leading-relaxed`}
        />
      </label>

      <p className="text-[11px] text-ink/45">
        Variables : {VARIABLES_MODELE.map((v) => `{${v}}`).join(" · ")}
      </p>

      <div className="rounded-xl bg-ink/[0.03] p-2.5 text-xs text-ink/70">
        <span className="mb-1 block text-[11px] font-medium text-ink/45">Aperçu</span>
        <span className="whitespace-pre-wrap">{apercu}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Ordre</span>
          <input
            value={ordre}
            onChange={(e) => setOrdre(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className={`${CHAMP} w-20`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          Actif
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting}
          className="flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          <Check size={15} aria-hidden="true" />
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onFini}
          disabled={submitting}
          className="min-h-10 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70 hover:bg-ink/5"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
