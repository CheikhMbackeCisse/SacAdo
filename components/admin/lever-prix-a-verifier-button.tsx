"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leverPrixAVerifier } from "@/lib/admin/produits-actions";

export function LeverPrixAVerifierButton({ id }: { id: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const handleClick = async () => {
    if (!window.confirm("Marquer ce prix comme vérifié ? Il redeviendra publiable normalement.")) return;
    setEnCours(true);
    const result = await leverPrixAVerifier(id);
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
        className="text-sm font-medium text-brand hover:underline"
      >
        Marquer vérifié
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
