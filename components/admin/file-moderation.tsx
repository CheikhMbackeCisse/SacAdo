"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { StatutPublicationBadge } from "@/components/vendeur/statut-publication-badge";
import { formatPrice } from "@/lib/format";
import {
  accepterPrix,
  contreProposer,
  refuserProduit,
  type ProduitAModererer,
} from "@/lib/admin/negociation-actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FileModeration({ items }: { items: ProduitAModererer[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/60 p-8 text-center text-sm text-ink/55">
        Aucun produit n&apos;attend de décision pour le moment.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <CarteModeration key={item.produit.id} item={item} />
      ))}
    </ul>
  );
}

function CarteModeration({ item }: { item: ProduitAModererer }) {
  const router = useRouter();
  const { produit, fil, prixEnJeu, tauxCommission, limiteAtteinte } = item;

  const [action, setAction] = useState<null | "accepter" | "contre" | "refuser">(null);
  const [contrePrix, setContrePrix] = useState(String(prixEnJeu));
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commission = Math.round((prixEnJeu * tauxCommission) / 100);
  const net = prixEnJeu - commission;

  const lancer = async (fn: () => Promise<{ ok: boolean; error?: string }>, tag: typeof action) => {
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

  const busy = action !== null;

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/5">
          <ProductImage src={produit.photo} alt={produit.nom} sizes="80px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{produit.nom}</p>
            <StatutPublicationBadge statut={produit.statut_publication} />
          </div>
          <p className="mt-0.5 text-xs text-ink/55">
            {item.vendeurNom} · {item.categorieNom}
          </p>
          {produit.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink/50">{produit.description}</p>
          )}
        </div>
      </div>

      {produit.commentaire_vendeur && (
        <div className="rounded-xl border border-ink/10 bg-[#0B3D91]/[0.04] px-3.5 py-3 text-sm">
          <p className="text-xs font-medium text-ink/50">Commentaire du vendeur</p>
          <p className="mt-1 whitespace-pre-wrap text-ink/80">{produit.commentaire_vendeur}</p>
        </div>
      )}

      <div className="rounded-xl bg-ink/[0.03] px-3.5 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink/70">Prix en jeu</span>
          <span className="font-semibold text-ink">{formatPrice(prixEnJeu)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-ink/55">
          <span>Commission SacAdo ({tauxCommission}%) : {formatPrice(commission)}</span>
          <span>Le vendeur reçoit {formatPrice(net)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-ink/50">Historique des propositions</p>
        <ul className="flex flex-col gap-1 text-xs">
          {fil.length === 0 && <li className="text-ink/45">Soumission initiale à {formatPrice(produit.prix)}.</li>}
          {fil.map((prop) => (
            <li key={prop.id} className="flex items-center justify-between gap-2">
              <span className="text-ink/70">
                {prop.auteur === "admin" ? "SacAdo" : item.vendeurNom} · {formatPrice(prop.prix_propose)}
              </span>
              <span className="text-ink/40">
                {formatDate(prop.date)}
                {prop.statut === "accepte" && " · accepté"}
                {prop.statut === "refuse" && " · dépassé"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {limiteAtteinte && (
        <p className="rounded-lg bg-[#E07B39]/12 px-2.5 py-1.5 text-xs text-[#8a4a1f]">
          Limite d&apos;allers-retours atteinte : vous ne pouvez plus que publier au dernier prix
          ou refuser le produit.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => lancer(() => accepterPrix(produit.id), "accepter")}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          {action === "accepter" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Publier à {formatPrice(prixEnJeu)}
        </button>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink/55 sm:flex-none">
            Contre-proposer
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={contrePrix}
              onChange={(e) => setContrePrix(e.target.value)}
              disabled={busy || limiteAtteinte}
              className="no-spinner min-h-11 w-full rounded-lg border border-ink/15 px-2 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50 sm:w-32"
            />
          </label>
          <button
            type="button"
            disabled={busy || limiteAtteinte}
            onClick={() => lancer(() => contreProposer(produit.id, Number(contrePrix)), "contre")}
            className="min-h-11 shrink-0 rounded-full border border-ink/15 px-3 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
          >
            {action === "contre" ? <Loader2 size={14} className="animate-spin" /> : "Envoyer"}
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink/55 sm:flex-none">
            Refuser — motif (facultatif)
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              disabled={busy}
              maxLength={300}
              className="min-h-11 w-full rounded-lg border border-ink/15 px-2 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50 sm:w-52"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => lancer(() => refuserProduit(produit.id, motif), "refuser")}
            className="min-h-11 shrink-0 rounded-full border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {action === "refuser" ? <Loader2 size={14} className="animate-spin" /> : "Refuser"}
          </button>
        </div>
      </div>
    </li>
  );
}
