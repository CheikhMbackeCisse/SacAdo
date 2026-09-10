"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Trash2 } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import {
  creerBeneficiaire,
  desactiverBeneficiaire,
  listerBeneficiaires,
} from "@/lib/beneficiaires-actions";
import type { Beneficiaire } from "@/lib/beneficiaires";

const CHAMP =
  "min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none";

export function BeneficiairesSection() {
  const { identite } = useIdentite();
  const connecte = Boolean(identite?.telephone && identite?.jeton);

  const [liste, setListe] = useState<Beneficiaire[]>([]);
  const [charge, setCharge] = useState(false);
  const [prenom, setPrenom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [serie, setSerie] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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

  if (!connecte || !identite) return null;

  const ajouter = async () => {
    if (!prenom.trim()) return;
    setBusy(true);
    setErreur(null);
    const r = await creerBeneficiaire(identite.telephone, identite.jeton ?? "", {
      prenom,
      niveau: niveau || null,
      serie: serie || null,
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
        <GraduationCap size={17} className="text-brand" aria-hidden="true" />
        <h2 className="font-heading text-base font-semibold text-ink">Mes enfants</h2>
      </div>
      <p className="text-xs text-ink/55">
        Enregistre le niveau de chaque enfant : l&apos;accueil s&apos;adapte à chacun et tu
        retrouves son kit d&apos;une année sur l&apos;autre. Prénom et niveau uniquement.
      </p>

      {charge && liste.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink/10">
          {liste.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {b.prenom}
                {b.niveau && (
                  <span className="text-ink/50">
                    {" "}
                    · {b.niveau}
                    {b.serie ? ` ${b.serie}` : ""}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => retirer(b.id)}
                aria-label={`Retirer ${b.prenom}`}
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
          <input
            value={niveau}
            onChange={(e) => setNiveau(e.target.value)}
            maxLength={40}
            placeholder="Niveau (ex : 6e)"
            className={`${CHAMP} w-32`}
          />
          <input
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            maxLength={20}
            placeholder="Série"
            className={`${CHAMP} w-24`}
          />
        </div>
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <button
          type="button"
          onClick={ajouter}
          disabled={busy || !prenom.trim()}
          className="self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-40"
        >
          {busy ? "…" : "Ajouter"}
        </button>
      </div>
    </section>
  );
}
