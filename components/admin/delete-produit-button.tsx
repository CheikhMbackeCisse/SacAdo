"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supprimerProduit, getKitsUtilisantProduit } from "@/lib/admin/produits-actions";

export function DeleteProduitButton({ id, nom }: { id: number; nom: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const handleDelete = async () => {
    setError(null);
    setEnCours(true);
    const kits = await getKitsUtilisantProduit(id);
    setEnCours(false);

    const message =
      kits.length > 0
        ? `« ${nom} » est dans ${kits.length} kit${kits.length > 1 ? "s" : ""} (${kits
            .map((k) => k.nom)
            .join(", ")}) ; il en sera retiré. Supprimer ce produit ?`
        : `Supprimer « ${nom} » ?`;
    if (!window.confirm(message)) return;

    setEnCours(true);
    const result = await supprimerProduit(id);
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.archive) {
      window.alert(
        `« ${nom} » apparaît dans une commande passée : il a été archivé (invisible partout, retrouvable via le filtre « Archivé ») plutôt que supprimé.`,
      );
    }
    router.refresh();
  };

  return (
    <span className="flex flex-col items-end">
      <button type="button" onClick={handleDelete} disabled={enCours} className="text-red-600 hover:underline disabled:opacity-40">
        Supprimer
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
