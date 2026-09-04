"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  changerStatutCommandesGroupe,
  passerRecuesEnPreparation,
  type CommandeAvecClient,
} from "@/lib/admin/commandes-actions";
import { formatPrice } from "@/lib/format";
import { StatutSelect } from "@/components/admin/statut-select";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";
import type { StatutCommande } from "@/lib/supabase/types";

const OPTIONS_GROUPE: { value: StatutCommande; label: string }[] = [
  { value: "recue", label: "Reçue" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrée" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CommandesListe({
  commandes,
  nbRecues,
}: {
  commandes: CommandeAvecClient[];
  nbRecues: number;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [statutGroupe, setStatutGroupe] = useState<StatutCommande>("preparation");
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const selectionnables = commandes
    .filter((c) => c.statut !== "paiement_en_attente")
    .map((c) => c.id);
  const toutCoche = selectionnables.length > 0 && selectionnables.every((id) => selection.has(id));

  const toggleUn = (id: number) =>
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleTout = () => setSelection(toutCoche ? new Set() : new Set(selectionnables));

  const labelStatut = (value: StatutCommande) =>
    OPTIONS_GROUPE.find((o) => o.value === value)?.label ?? value;

  const appliquerGroupe = () => {
    const ids = [...selection];
    if (ids.length === 0) return;
    const confirme = window.confirm(
      `Passer ${ids.length} commande${ids.length > 1 ? "s" : ""} en « ${labelStatut(statutGroupe)} » ?`,
    );
    if (!confirme) return;
    setErreur(null);
    startTransition(async () => {
      const res = await changerStatutCommandesGroupe(ids, statutGroupe);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      setSelection(new Set());
      router.refresh();
    });
  };

  const appliquerRaccourci = () => {
    if (nbRecues === 0) return;
    const confirme = window.confirm(
      `Passer ${nbRecues} commande${nbRecues > 1 ? "s" : ""} "Reçue${nbRecues > 1 ? "s" : ""}" en "En préparation" ?`,
    );
    if (!confirme) return;
    setErreur(null);
    startTransition(async () => {
      const res = await passerRecuesEnPreparation();
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3">
        <button
          type="button"
          onClick={appliquerRaccourci}
          disabled={enCours || nbRecues === 0}
          className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Passer toutes les «&nbsp;Reçues&nbsp;» en «&nbsp;En préparation&nbsp;»
          {nbRecues > 0 ? ` (${nbRecues})` : ""}
        </button>
      </div>

      {selection.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
          <span className="text-xs font-medium text-ink">
            {selection.size} sélectionnée{selection.size > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-ink/50">Passer en :</span>
          <select
            value={statutGroupe}
            onChange={(event) => setStatutGroupe(event.target.value as StatutCommande)}
            className="rounded-full border border-ink/15 bg-white px-2 py-1 text-xs"
          >
            {OPTIONS_GROUPE.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={appliquerGroupe}
            disabled={enCours}
            className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Appliquer
          </button>
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            className="text-xs text-ink/50 hover:text-ink"
          >
            Annuler
          </button>
        </div>
      )}

      {erreur && <p className="text-xs text-ink/70">{erreur}</p>}

      <CartesListe>
        {commandes.map((commande) => (
          <CarteListe key={commande.id}>
            <div className="flex items-center gap-2">
              {commande.statut !== "paiement_en_attente" && (
                <input
                  type="checkbox"
                  checked={selection.has(commande.id)}
                  onChange={() => toggleUn(commande.id)}
                  aria-label={`Sélectionner la commande #${commande.id}`}
                  className="size-4 shrink-0 accent-brand"
                />
              )}
              <Link
                href={`/admin/commandes/${commande.id}`}
                className="font-semibold text-brand hover:underline"
              >
                Commande #{commande.id}
              </Link>
              <span className="ml-auto shrink-0 text-xs text-ink/50">{formatDate(commande.date)}</span>
            </div>
            <ChampCarte label="Client">
              {commande.client_nom}
              <span className="block text-xs text-ink/40">{commande.client_telephone}</span>
            </ChampCarte>
            <ChampCarte label="Total">
              {formatPrice(commande.total)}
              {commande.mode_paiement === "wave" && (
                <span className="ml-1.5 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
                  Wave{commande.statut_paiement === "payee" ? " ✓" : ""}
                </span>
              )}
            </ChampCarte>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs text-ink/50">Statut</span>
              <StatutSelect commandeId={commande.id} statutActuel={commande.statut} />
            </div>
          </CarteListe>
        ))}
      </CartesListe>

      <TableauDesktop>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  checked={toutCoche}
                  onChange={toggleTout}
                  aria-label="Tout sélectionner"
                  className="size-4 accent-brand"
                />
              </th>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((commande) => (
              <tr key={commande.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3">
                  {commande.statut !== "paiement_en_attente" && (
                    <input
                      type="checkbox"
                      checked={selection.has(commande.id)}
                      onChange={() => toggleUn(commande.id)}
                      aria-label={`Sélectionner la commande #${commande.id}`}
                      className="size-4 accent-brand"
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-ink">
                  <Link href={`/admin/commandes/${commande.id}`} className="text-brand hover:underline">
                    #{commande.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {commande.client_nom}
                  <div className="text-xs text-ink/40">{commande.client_telephone}</div>
                </td>
                <td className="px-4 py-3 text-ink/60">{formatDate(commande.date)}</td>
                <td className="px-4 py-3 font-medium text-ink">
                  {formatPrice(commande.total)}
                  {commande.mode_paiement === "wave" && (
                    <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
                      Wave
                      {commande.statut_paiement === "payee" ? " ✓" : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatutSelect commandeId={commande.id} statutActuel={commande.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableauDesktop>
    </div>
  );
}
