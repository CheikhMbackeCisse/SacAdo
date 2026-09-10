"use client";

import { useEffect, useState } from "react";
import { Backpack, Trash2 } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { CLASSES_PAR_CYCLE, seriesDe } from "@/lib/cycles";
import {
  creerBeneficiaire,
  desactiverBeneficiaire,
  listerBeneficiaires,
} from "@/lib/beneficiaires-actions";
import type { Beneficiaire } from "@/lib/beneficiaires";

const CHAMP =
  "min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none";

// « d'Awa » / « de Bineta » selon l'initiale du prénom.
function possessif(prenom: string): string {
  const p = prenom.trim();
  return /^[aeiouyàâäéèêëïîôöùûüh]/i.test(p) ? `d'${p}` : `de ${p}`;
}

function classeLabel(b: Beneficiaire): string {
  if (!b.niveau) return "";
  return b.serie ? `${b.niveau} ${b.serie}` : b.niveau;
}

export function SacadosSection() {
  const { identite } = useIdentite();
  const connecte = Boolean(identite?.telephone && identite?.jeton);

  const [liste, setListe] = useState<Beneficiaire[]>([]);
  const [charge, setCharge] = useState(false);
  const [prenom, setPrenom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [serie, setSerie] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const seriesDispo = seriesDe(niveau);

  useEffect(() => {
    if (!connecte || !identite) return;
    let vivant = true;
    listerBeneficiaires(identite.telephone, identite.jeton ?? "").then((r) => {
      if (!vivant) return;
      if (r.ok) setListe(r.beneficiaires);
      setCharge(true);
    });
    return () => {
      vivant = false;
    };
  }, [connecte, identite]);

  if (!connecte || !identite) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-elevated p-4">
        <div className="flex items-center gap-2">
          <Backpack size={17} className="text-brand" aria-hidden="true" />
          <h2 className="font-heading text-base font-semibold text-ink">Mes sacados</h2>
        </div>
        <p className="text-xs text-ink/55">
          Passe une commande pour créer ton compte, puis enregistre ici la classe de
          chaque enfant : l&apos;accueil s&apos;adapte à chacun et tu retrouves son kit
          d&apos;une année sur l&apos;autre.
        </p>
      </section>
    );
  }

  const ajouter = async () => {
    if (!prenom.trim()) return;
    setBusy(true);
    setErreur(null);
    const serieRetenue = seriesDe(niveau).length ? serie : "";
    const r = await creerBeneficiaire(identite.telephone, identite.jeton ?? "", {
      prenom,
      niveau: niveau || null,
      serie: serieRetenue || null,
    });
    setBusy(false);
    if (!r.ok) {
      setErreur(r.error);
      return;
    }
    setListe(r.beneficiaires);
    setPrenom("");
    setNiveau("");
    setSerie("");
  };

  const retirer = async (id: number) => {
    const r = await desactiverBeneficiaire(identite.telephone, identite.jeton ?? "", id);
    if (r.ok) setListe(r.beneficiaires);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-elevated p-4">
      <div className="flex items-center gap-2">
        <Backpack size={17} className="text-brand" aria-hidden="true" />
        <h2 className="font-heading text-base font-semibold text-ink">Mes sacados</h2>
      </div>
      <p className="text-xs text-ink/55">
        Enregistre la classe de chaque sacado : l&apos;accueil s&apos;adapte à chacun et
        tu retrouves son kit d&apos;une année sur l&apos;autre. Prénom et classe uniquement.
      </p>

      {charge && liste.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink/10">
          {liste.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                Le sacado {possessif(b.prenom)}
                {classeLabel(b) && <span className="text-ink/50"> · {classeLabel(b)}</span>}
              </span>
              <button
                type="button"
                onClick={() => retirer(b.id)}
                aria-label={`Retirer le sacado ${possessif(b.prenom)}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/70"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            maxLength={40}
            placeholder="Prénom"
            className={`${CHAMP} flex-1`}
          />
          <select
            value={niveau}
            onChange={(e) => {
              setNiveau(e.target.value);
              setSerie("");
            }}
            className={`${CHAMP} w-40 bg-transparent`}
            aria-label="Classe"
          >
            <option value="">Classe</option>
            {CLASSES_PAR_CYCLE.map((groupe) => (
              <optgroup key={groupe.cycle} label={groupe.label}>
                {groupe.classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {seriesDispo.length > 0 && (
            <select
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              className={`${CHAMP} w-28 bg-transparent`}
              aria-label="Série"
            >
              <option value="">Série</option>
              {seriesDispo.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <button
          type="button"
          onClick={ajouter}
          disabled={busy || !prenom.trim()}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-40"
        >
          {busy ? "…" : "Ajouter un sacado"}
        </button>
      </div>
    </section>
  );
}
