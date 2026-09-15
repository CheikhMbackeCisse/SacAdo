"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { getLienDocumentCommande } from "@/lib/documents/actions";

type Props = {
  commandeId: number;
  jeton: string;
  documentId: number;
  titre: string;
};

export function DocumentTelechargement({ commandeId, jeton, documentId, titre }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const telecharger = async () => {
    setBusy(true);
    setError(null);
    const result = await getLienDocumentCommande(commandeId, jeton, documentId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Lien signé, valable 15 minutes (§3 TACHE_documents_telechargeables.md) :
    // on l'ouvre dans un nouvel onglet, le navigateur affiche ou télécharge le PDF.
    window.open(result.url, "_blank", "noopener");
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={telecharger}
        disabled={busy}
        className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand transition-transform active:scale-95 disabled:opacity-60"
      >
        <Download size={15} aria-hidden="true" />
        {busy ? "Préparation…" : `Télécharger la notice — ${titre}`}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
