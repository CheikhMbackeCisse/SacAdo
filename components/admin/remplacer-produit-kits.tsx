"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getKitsUtilisantProduit, remplacerProduitPartout } from "@/lib/admin/kits-actions";
import { ChampSelect, type OptionSelect } from "@/components/ui/champ-select";

// « remplacer un produit par un autre dans tous les kits, avec la liste des
// kits touchés avant de valider » — ADMIN.md Lot 2.
export function RemplacerProduitKits({ produits }: { produits: OptionSelect[] }) {
  const router = useRouter();
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [apercu, setApercu] = useState<{ id: number; nom: string }[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const voirApercu = async () => {
    if (!ancien) return;
    setChargement(true);
    setError(null);
    setSucces(null);
    const kits = await getKitsUtilisantProduit(Number(ancien));
    setChargement(false);
    setApercu(kits);
  };

  const valider = async () => {
    if (!ancien || !nouveau) return;
    setEnCours(true);
    setError(null);
    const result = await remplacerProduitPartout(Number(ancien), Number(nouveau));
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSucces(`${result.nb ?? 0} ligne(s) remplacée(s).`);
    setApercu(null);
    setAncien("");
    setNouveau("");
    router.refresh();
  };

  return (
    <details className="rounded-2xl border border-ink/10 bg-white p-3 text-sm">
      <summary className="cursor-pointer font-medium text-ink">
        Remplacer un produit dans tous les kits
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ChampSelect
            options={produits}
            value={ancien}
            onChange={(v) => {
              setAncien(v);
              setApercu(null);
            }}
            placeholder="Produit à remplacer"
            className="min-h-10 rounded-lg border border-ink/15 px-3 text-xs"
            searchable
          />
          <ChampSelect
            options={produits}
            value={nouveau}
            onChange={setNouveau}
            placeholder="Par ce produit"
            className="min-h-10 rounded-lg border border-ink/15 px-3 text-xs"
            searchable
          />
          <button
            type="button"
            onClick={voirApercu}
            disabled={!ancien || chargement}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 disabled:opacity-40"
          >
            {chargement ? "…" : "Voir les kits touchés"}
          </button>
        </div>

        {apercu && (
          <div className="rounded-xl bg-ink/[0.03] p-3 text-xs">
            {apercu.length === 0 ? (
              <p className="text-ink/50">Ce produit n&apos;est utilisé dans aucun kit.</p>
            ) : (
              <>
                <p className="mb-1 font-medium text-ink/70">{apercu.length} kit(s) touché(s) :</p>
                <ul className="list-inside list-disc text-ink/60">
                  {apercu.map((k) => (
                    <li key={k.id}>{k.nom}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={valider}
                  disabled={!nouveau || enCours}
                  className="mt-2 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-surface disabled:opacity-40"
                >
                  {enCours ? "…" : "Confirmer le remplacement"}
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
        {succes && <p className="text-xs text-green-700">{succes}</p>}
      </div>
    </details>
  );
}
