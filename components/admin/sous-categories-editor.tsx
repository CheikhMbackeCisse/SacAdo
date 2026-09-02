"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  creerSousCategorie,
  modifierSousCategorie,
  supprimerSousCategorie,
} from "@/lib/admin/sous-categories-actions";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Categorie, SousCategorie } from "@/lib/supabase/types";

type Props = {
  sousCategories: SousCategorie[];
  categories: Categorie[];
};

export function SousCategoriesEditor({ sousCategories, categories }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nouveauNom, setNouveauNom] = useState("");
  // "Kits scolaires" n'a pas de produits (ils vivent dans la table kits).
  const categoriesUtilisables = useMemo(
    () => categories.filter((c) => c.slug !== "kits"),
    [categories],
  );
  // Pas de catégorie par défaut : l'admin doit la choisir (sinon la nouvelle
  // sous-catégorie est rattachée à la première catégorie par inadvertance).
  const [nouvelleCategorie, setNouvelleCategorie] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groupes = useMemo(() => {
    const parCategorie = new Map<number, SousCategorie[]>();
    for (const sc of sousCategories) {
      const liste = parCategorie.get(sc.categorie_id) ?? [];
      liste.push(sc);
      parCategorie.set(sc.categorie_id, liste);
    }
    return categoriesUtilisables.map((c) => ({
      categorie: c,
      items: parCategorie.get(c.id) ?? [],
    }));
  }, [sousCategories, categoriesUtilisables]);

  const ajouter = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (nouvelleCategorie === null) {
      setError("Veuillez choisir une catégorie.");
      return;
    }
    if (!nouveauNom.trim()) return;
    setSubmitting(true);
    const result = await creerSousCategorie({
      nom: nouveauNom.trim(),
      categorie_id: nouvelleCategorie,
      ordre: 0,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNouveauNom("");
    router.refresh();
  };

  const renommer = async (sc: SousCategorie, nom: string) => {
    if (nom.trim() === sc.nom || !nom.trim()) return;
    setError(null);
    const result = await modifierSousCategorie(sc.id, {
      nom: nom.trim(),
      categorie_id: sc.categorie_id,
      ordre: sc.ordre,
    });
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const changerOrdre = async (sc: SousCategorie, ordre: number) => {
    if (ordre === sc.ordre) return;
    setError(null);
    const result = await modifierSousCategorie(sc.id, {
      nom: sc.nom,
      categorie_id: sc.categorie_id,
      ordre,
    });
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const supprimer = async (sc: SousCategorie) => {
    setError(null);
    const result = await supprimerSousCategorie(sc.id);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <form
        onSubmit={ajouter}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Catégorie</span>
          <ChampSelect
            ariaLabel="Catégorie"
            placeholder="Choisir une catégorie…"
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
            wrapperClassName="w-48"
            value={nouvelleCategorie === null ? "" : String(nouvelleCategorie)}
            onChange={(v) => setNouvelleCategorie(v === "" ? null : Number(v))}
            options={categoriesUtilisables.map((c) => ({ value: String(c.id), label: c.nom }))}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Nouvelle sous-catégorie</span>
          <input
            value={nouveauNom}
            onChange={(event) => setNouveauNom(event.target.value)}
            placeholder="Ex. : Mathématiques"
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-5">
        {groupes.map(({ categorie, items }) => (
          <div key={categorie.id} className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="mb-2 font-heading text-sm font-bold text-ink">
              {categorie.nom} <span className="font-normal text-ink/40">({items.length})</span>
            </p>

            {items.length === 0 ? (
              <p className="text-xs text-ink/40">Aucune sous-catégorie.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ink/5">
                {items.map((sc) => (
                  <li key={sc.id} className="flex items-center gap-2 py-2">
                    <input
                      type="number"
                      defaultValue={sc.ordre}
                      aria-label={`Ordre de ${sc.nom}`}
                      onBlur={(event) => changerOrdre(sc, Number(event.target.value))}
                      className="w-14 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                    />
                    <input
                      defaultValue={sc.nom}
                      aria-label={`Nom de ${sc.nom}`}
                      onBlur={(event) => renommer(sc, event.target.value)}
                      className="flex-1 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                    />
                    <code className="hidden text-[11px] text-ink/35 sm:inline">{sc.slug}</code>
                    <button
                      type="button"
                      onClick={() => supprimer(sc)}
                      aria-label={`Supprimer ${sc.nom}`}
                      className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
