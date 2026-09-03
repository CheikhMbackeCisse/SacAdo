"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { chercherClientParTelephone, type ClientAvecCommandes } from "@/lib/admin/reporting-actions";
import { formatPrice } from "@/lib/format";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminClientsPage() {
  const [telephone, setTelephone] = useState("");
  const [client, setClient] = useState<ClientAvecCommandes | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [pasTrouve, setPasTrouve] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRecherche(true);
    setPasTrouve(false);
    const result = await chercherClientParTelephone(telephone);
    setClient(result);
    setPasTrouve(!result);
    setRecherche(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Commandes par client</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs sm:max-w-xs">
          <span className="text-ink/60">Téléphone</span>
          <input
            required
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(event) => setTelephone(event.target.value)}
            placeholder="77 123 45 67"
            className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={recherche}
          className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          Rechercher
        </button>
      </form>

      {pasTrouve && <p className="text-sm text-ink/50">Aucun client avec ce numéro.</p>}

      {client && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-sm font-semibold text-ink">{client.nom}</p>
            <p className="text-xs text-ink/50">{client.telephone}</p>
            <p className="mt-2 text-sm text-ink/70">
              {client.commandes.length} commande{client.commandes.length > 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-ink">{formatPrice(client.totalDepense)}</span> au total
            </p>
          </div>

          <CartesListe>
            {client.commandes.map((commande) => (
              <CarteListe key={commande.id}>
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/commandes/${commande.id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    Commande #{commande.id}
                  </Link>
                  <span className="text-xs text-ink/50">{formatDate(commande.date)}</span>
                </div>
                <ChampCarte label="Total">{formatPrice(commande.total)}</ChampCarte>
                <ChampCarte label="Statut">{commande.statut}</ChampCarte>
              </CarteListe>
            ))}
          </CartesListe>

          <TableauDesktop>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {client.commandes.map((commande) => (
                  <tr key={commande.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 text-ink">#{commande.id}</td>
                    <td className="px-4 py-3 text-ink/60">{formatDate(commande.date)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatPrice(commande.total)}</td>
                    <td className="px-4 py-3 text-ink/60">{commande.statut}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/commandes/${commande.id}`} className="text-brand hover:underline">
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableauDesktop>
        </div>
      )}
    </div>
  );
}
