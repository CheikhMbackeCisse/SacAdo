"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supprimerListe } from "@/lib/admin/listes-actions";

export function SupprimerListeButton({ listeId, titre }: { listeId: number; titre: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer la liste « ${titre} » ? Le lien public cessera de fonctionner.`)) return;
    setEnCours(true);
    const result = await supprimerListe(listeId);
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/listes");
  };

  return (
    <span className="flex flex-col items-start gap-1">
      <button type="button" onClick={handleDelete} disabled={enCours} className="text-xs text-red-600 hover:underline disabled:opacity-40">
        Supprimer la liste
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
