"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierPrixStock } from "@/lib/admin/produits-actions";

type Props = {
  id: number;
  prix: number;
  stock: number;
  prixAchat?: number | null;
  nbKits: number;
  className?: string;
};

// Édition directe dans la liste : on tape, on valide (Entrée ou perte de
// focus), pas besoin d'ouvrir la fiche produit pour un simple ajustement.
export function EditPrixStock({ id, prix, stock, prixAchat, nbKits, className = "" }: Props) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState({ prix, stock });
  const [enCours, setEnCours] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    if (valeurs.prix === prix && valeurs.stock === stock) return;
    setEnCours(true);
    setError(null);
    const result = await modifierPrixStock(id, valeurs);
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      setValeurs({ prix, stock });
      return;
    }
    router.refresh();
  };

  const prixBas = prixAchat != null && valeurs.prix < prixAchat;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={valeurs.prix}
          disabled={enCours}
          onChange={(e) => setValeurs((v) => ({ ...v, prix: Number(e.target.value) }))}
          onBlur={enregistrer}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-right text-sm text-ink"
        />
        <span className="text-ink/40">·</span>
        <input
          type="number"
          inputMode="numeric"
          value={valeurs.stock}
          disabled={enCours}
          onChange={(e) => setValeurs((v) => ({ ...v, stock: Number(e.target.value) }))}
          onBlur={enregistrer}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-16 rounded-lg border border-ink/15 px-2 py-1 text-right text-sm text-ink"
        />
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      {prixBas && <span className="text-[11px] text-red-600">Prix &lt; prix fournisseur</span>}
      {nbKits > 0 && <span className="text-[11px] text-ink/40">Change le total de {nbKits} kit{nbKits > 1 ? "s" : ""}</span>}
    </div>
  );
}
