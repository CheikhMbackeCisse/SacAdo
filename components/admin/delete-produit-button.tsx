"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supprimerProduit } from "@/lib/admin/produits-actions";

export function DeleteProduitButton({ id, nom }: { id: number; nom: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer « ${nom} » ?`)) return;
    const result = await supprimerProduit(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <span className="flex flex-col items-end">
      <button type="button" onClick={handleDelete} className="text-red-600 hover:underline">
        Supprimer
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
