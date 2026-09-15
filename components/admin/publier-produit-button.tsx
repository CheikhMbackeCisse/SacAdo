"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { basculerPublication } from "@/lib/admin/produits-actions";

export function PublierProduitButton({ id, publie }: { id: number; publie: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const handleClick = async () => {
    setEnCours(true);
    setError(null);
    const result = await basculerPublication(id, !publie);
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={enCours}
        className={publie ? "text-ink/50 hover:underline" : "font-medium text-brand hover:underline"}
      >
        {publie ? "Dépublier" : "Publier"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
