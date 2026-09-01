"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import {
  abandonnerNegociation,
  accepterPrixSacado,
  contreProposerVendeur,
  type MaNegociation,
} from "@/lib/vendeur/negociation-actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MesNegociations({ items }: { items: MaNegociation[] }) {
  const aTraiter = items.filter((i) => i.aMoiDeJouer);
  if (aTraiter.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#0B3D91]/20 bg-[#0B3D91]/[0.04] p-4">
      <div>
        <h2 className="font-heading text-base font-bold text-[#001314]">
          Propositions de prix — à votre réponse
        </h2>
        <p className="mt-0.5 text-xs text-[#001314]/55">
          SacAdo a proposé un prix pour ces produits. Acceptez, re-proposez un autre prix,
          ou abandonnez.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {aTraiter.map((item) => (
          <CarteNegociation key={item.produit.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function CarteNegociation({ item }: { item: MaNegociation }) {
  const router = useRouter();
  const { produit, fil, prixEnJeu, tauxCommission, limiteAtteinte } = item;

  const [action, setAction] = useState<null | "accepter" | "contre" | "abandon">(null);
  const [contrePrix, setContrePrix] = useState(String(prixEnJeu));
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commission = Math.round((prixEnJeu * tauxCommission) / 100);
  const net = prixEnJeu - commission;
  const busy = action !== null;

  const lancer = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    tag: typeof action,
  ) => {
    setAction(tag);
    setError(null);
    const res = await fn();
    if (!res.ok) {
      setError(res.error ?? "Action impossible.");
      setAction(null);
      return;
    }
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[#001314]/10 bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-[#001314]">{produit.nom}</p>
        <p className="text-sm">
          Prix proposé par SacAdo :{" "}
          <span className="font-semibold text-[#0B3D91]">{formatPrice(prixEnJeu)}</span>
        </p>
      </div>

      <p className="text-xs text-[#001314]/55">
        Commission SacAdo ({tauxCommission}%) : {formatPrice(commission)} · vous recevrez{" "}
        <span className="font-medium text-[#001314]">{formatPrice(net)}</span>
      </p>

      <ul className="flex flex-col gap-0.5 text-xs text-[#001314]/55">
        {fil.map((prop) => (
          <li key={prop.id} className="flex items-center justify-between gap-2">
            <span>
              {prop.auteur === "admin" ? "SacAdo" : "Vous"} · {formatPrice(prop.prix_propose)}
            </span>
            <span className="text-[#001314]/35">{formatDate(prop.date)}</span>
          </li>
        ))}
      </ul>

      {limiteAtteinte && (
        <p className="rounded-lg bg-[#E07B39]/12 px-2.5 py-1.5 text-xs text-[#8a4a1f]">
          Limite d&apos;allers-retours atteinte : vous ne pouvez plus que l&apos;accepter ou
          abandonner.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => lancer(() => accepterPrixSacado(produit.id), "accepter")}
          className="flex items-center gap-1.5 rounded-full bg-[#0B3D91] px-4 py-2 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {action === "accepter" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          Accepter {formatPrice(prixEnJeu)}
        </button>

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-[#001314]/55">
            Re-proposer
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={contrePrix}
              onChange={(e) => setContrePrix(e.target.value)}
              disabled={busy || limiteAtteinte}
              className="no-spinner w-32 rounded-lg border border-[#001314]/15 px-2 py-1.5 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            disabled={busy || limiteAtteinte}
            onClick={() => lancer(() => contreProposerVendeur(produit.id, Number(contrePrix)), "contre")}
            className="rounded-full border border-[#001314]/15 px-3 py-1.5 text-sm font-medium text-[#001314]/70 hover:bg-[#001314]/5 disabled:opacity-50"
          >
            {action === "contre" ? <Loader2 size={14} className="animate-spin" /> : "Envoyer"}
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-[#001314]/55">
            Abandonner — raison (facultatif)
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              disabled={busy}
              maxLength={300}
              className="w-48 rounded-lg border border-[#001314]/15 px-2 py-1.5 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => lancer(() => abandonnerNegociation(produit.id, motif), "abandon")}
            className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {action === "abandon" ? <Loader2 size={14} className="animate-spin" /> : "Abandonner"}
          </button>
        </div>
      </div>
    </li>
  );
}
