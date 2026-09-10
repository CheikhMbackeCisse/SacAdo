"use client";

import { useEffect, useState } from "react";
import { useIdentite } from "@/lib/local/identite";
import { decouperClasseLycee } from "@/lib/cycles";
import { creerBeneficiaire, listerBeneficiaires } from "@/lib/beneficiaires-actions";
import type { Beneficiaire } from "@/lib/beneficiaires";

// « Pour qui ce kit ? » — associe le kit ajouté à un enfant, ce qui adapte
// l'accueil au niveau de chaque enfant (TACHE_identite §2). Point de création
// des profils le moins intrusif (§2.2). Réservé aux comptes (identité + jeton
// obtenus à une commande) ; pour un visiteur anonyme le cookie `sacado_niveau`
// suffit au démarrage à froid.
export function KitBeneficiairePicker({
  cycle,
  niveau,
  value,
  onChange,
}: {
  cycle: string;
  niveau: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { identite } = useIdentite();
  const connecte = Boolean(identite?.telephone && identite?.jeton);

  const [benefs, setBenefs] = useState<Beneficiaire[]>([]);
  const [prenom, setPrenom] = useState("");
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const { niveau: base, serie } =
    cycle === "lycee" ? decouperClasseLycee(niveau) : { niveau, serie: "" };

  useEffect(() => {
    if (!connecte || !identite) return;
    let vivant = true;
    listerBeneficiaires(identite.telephone, identite.jeton ?? "").then((r) => {
      if (vivant && r.ok) setBenefs(r.beneficiaires);
    });
    return () => {
      vivant = false;
    };
  }, [connecte, identite]);

  if (!connecte || !identite) return null;

  const enregistrer = async () => {
    const p = prenom.trim();
    if (!p) return;
    setBusy(true);
    const r = await creerBeneficiaire(identite.telephone, identite.jeton ?? "", {
      prenom: p,
      niveau: base,
      serie: serie || null,
    });
    setBusy(false);
    if (r.ok) {
      setBenefs(r.beneficiaires);
      if (r.id) onChange(r.id);
      setPrenom("");
      setOuvert(false);
    }
  };

  return (
    <div className="mx-4 mb-1 flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3">
      <span className="text-xs font-medium text-ink/60">Pour qui ce kit&nbsp;?</span>
      <div className="flex flex-wrap gap-2">
        <Puce active={value === null} onClick={() => onChange(null)}>
          Sans préciser
        </Puce>
        {benefs.map((b) => (
          <Puce key={b.id} active={value === b.id} onClick={() => onChange(b.id)}>
            {b.prenom}
          </Puce>
        ))}
        <Puce active={ouvert} onClick={() => setOuvert((v) => !v)}>
          + Nouveau
        </Puce>
      </div>

      {ouvert && (
        <div className="flex gap-2">
          <input
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            maxLength={40}
            placeholder="Prénom de l'enfant"
            className="min-h-10 flex-1 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={enregistrer}
            disabled={busy || !prenom.trim()}
            className="rounded-full bg-brand px-4 text-sm font-semibold text-on-brand disabled:opacity-40"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
        </div>
      )}

      <p className="text-[11px] text-ink/40">
        Le kit se retrouve d&apos;une année sur l&apos;autre, et l&apos;accueil s&apos;adapte au
        niveau de chaque enfant. Prénom uniquement&nbsp;: aucune autre donnée.
      </p>
    </div>
  );
}

function Puce({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-brand bg-brand text-on-brand" : "border-ink/15 text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}
