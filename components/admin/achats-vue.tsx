"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FournisseurCarteAchat } from "@/components/admin/fournisseur-carte-achat";
import type { ArticleAchat, GroupeFournisseur } from "@/lib/admin/achats-actions";

export function AchatsVue({
  fournisseurs,
  stockSacAdo,
  inclureEnAttente,
}: {
  fournisseurs: GroupeFournisseur[];
  stockSacAdo: ArticleAchat[];
  inclureEnAttente: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 self-start rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70">
        <input
          type="checkbox"
          checked={inclureEnAttente}
          onChange={(e) => router.push(`/admin/achats${e.target.checked ? "?enAttente=1" : ""}`)}
          className="size-3.5 accent-brand"
        />
        Inclure les commandes en attente
      </label>

      {fournisseurs.length === 0 && stockSacAdo.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun article à commander pour l&apos;instant.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {fournisseurs.map((groupe) => (
            <FournisseurCarteAchat key={groupe.vendeurId} groupe={groupe} />
          ))}
          {stockSacAdo.length > 0 && (
            <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Stock SacAdo, rien à commander</p>
              <ul className="flex flex-col gap-1 text-xs text-ink/60">
                {stockSacAdo.map((a) => (
                  <li key={a.commandeItemId}>
                    {a.quantite} x {a.produitNom}
                    {a.varianteLabel ? ` (${a.varianteLabel})` : ""} —{" "}
                    <Link href={`/admin/commandes/${a.commandeId}`} className="text-brand hover:underline">
                      #{a.commandeId}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
