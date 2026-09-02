"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import {
  creerAttribut,
  fusionnerAttribut,
  renommerAttribut,
  supprimerAttribut,
  validerAttribut,
} from "@/lib/admin/attributs-actions";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Attribut } from "@/lib/supabase/types";

export function AttributsEditor({ attributs }: { attributs: Attribut[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState("");
  // Cible de fusion choisie pour chaque proposition (proposition id -> attribut id).
  const [cibleFusion, setCibleFusion] = useState<Record<number, number>>({});

  const propositions = useMemo(
    () => attributs.filter((a) => a.statut === "propose"),
    [attributs],
  );
  const valides = useMemo(
    () => attributs.filter((a) => a.statut === "valide"),
    [attributs],
  );

  const apres = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) setError(r.error ?? "Action impossible.");
    else {
      setError(null);
      router.refresh();
    }
  };

  const champ =
    "rounded-lg border border-ink/15 px-2 py-1.5 text-sm focus:border-brand focus:outline-none";

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* --- Propositions en attente --- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Proposés par des vendeurs{" "}
          <span className="font-normal text-ink/40">({propositions.length})</span>
        </h2>

        {propositions.length === 0 ? (
          <p className="text-xs text-ink/40">Aucune proposition en attente.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {propositions.map((prop) => (
              <li
                key={prop.id}
                className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white p-3 text-sm"
              >
                <input
                  defaultValue={prop.nom}
                  aria-label={`Nom de ${prop.nom}`}
                  onBlur={(event) => {
                    if (event.target.value.trim() && event.target.value.trim() !== prop.nom) {
                      renommerAttribut(prop.id, event.target.value).then(apres);
                    }
                  }}
                  className={champ}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => validerAttribut(prop.id).then(apres)}
                    className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-surface active:scale-95"
                  >
                    <Check size={13} aria-hidden="true" /> Valider
                  </button>

                  <span className="inline-flex items-center gap-1">
                    <ChampSelect
                      ariaLabel="Fusionner dans"
                      placeholder="Fusionner dans…"
                      className={`${champ} text-xs`}
                      wrapperClassName="w-40"
                      value={cibleFusion[prop.id] ? String(cibleFusion[prop.id]) : ""}
                      onChange={(v) =>
                        setCibleFusion((c) => ({ ...c, [prop.id]: v === "" ? 0 : Number(v) }))
                      }
                      options={valides.map((v) => ({ value: String(v.id), label: v.nom }))}
                    />
                    <button
                      type="button"
                      disabled={!cibleFusion[prop.id]}
                      onClick={() =>
                        fusionnerAttribut(prop.id, cibleFusion[prop.id]).then(apres)
                      }
                      className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/[0.04] disabled:opacity-40"
                    >
                      Fusionner
                    </button>
                  </span>

                  <button
                    type="button"
                    onClick={() => supprimerAttribut(prop.id).then(apres)}
                    className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Liste commune --- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Liste commune <span className="font-normal text-ink/40">({valides.length})</span>
        </h2>

        <div className="rounded-2xl border border-ink/10 bg-white">
          <ul className="flex flex-col divide-y divide-ink/5">
            {valides.map((attribut) => (
              <li key={attribut.id} className="flex items-center gap-2 px-3 py-2">
                <input
                  defaultValue={attribut.nom}
                  aria-label={`Nom de ${attribut.nom}`}
                  onBlur={(event) => {
                    if (event.target.value.trim() && event.target.value.trim() !== attribut.nom) {
                      renommerAttribut(attribut.id, event.target.value).then(apres);
                    }
                  }}
                  className="flex-1 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => supprimerAttribut(attribut.id).then(apres)}
                  aria-label={`Supprimer ${attribut.nom}`}
                  className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nouveau}
            onChange={(event) => setNouveau(event.target.value)}
            placeholder="Nouvel attribut (ex. Contenance)"
            className={`${champ} flex-1`}
          />
          <button
            type="button"
            onClick={() => {
              const nom = nouveau.trim();
              if (!nom) return;
              creerAttribut(nom).then((r) => {
                apres(r);
                if (r.ok) setNouveau("");
              });
            }}
            disabled={!nouveau.trim()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95 disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </section>
    </div>
  );
}
