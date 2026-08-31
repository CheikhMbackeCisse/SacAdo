"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  creerCategorie,
  modifierCategorie,
  supprimerCategorie,
} from "@/lib/admin/categories-actions";
import type { Categorie } from "@/lib/supabase/types";

export function CategoriesEditor({ categories }: { categories: Categorie[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nouveauNom, setNouveauNom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enregistrer = async (cat: Categorie, patch: Partial<Categorie>) => {
    setError(null);
    const result = await modifierCategorie(cat.id, {
      nom: patch.nom ?? cat.nom,
      ordre: patch.ordre ?? cat.ordre,
      image: patch.image !== undefined ? patch.image : cat.image,
      actif: patch.actif !== undefined ? patch.actif : cat.actif,
    });
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const ajouter = async (event: FormEvent) => {
    event.preventDefault();
    if (!nouveauNom.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await creerCategorie({
      nom: nouveauNom.trim(),
      ordre: (categories.at(-1)?.ordre ?? 0) + 1,
      image: null,
      actif: true,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNouveauNom("");
    router.refresh();
  };

  const supprimer = async (cat: Categorie) => {
    setError(null);
    const result = await supprimerCategorie(cat.id);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form
        onSubmit={ajouter}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-4"
      >
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Nouvelle catégorie</span>
          <input
            value={nouveauNom}
            onChange={(event) => setNouveauNom(event.target.value)}
            placeholder="Ex. : Instruments de musique"
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

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-3 py-2 font-medium">Ordre</th>
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Image (chemin)</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-ink/5 last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="number"
                    defaultValue={cat.ordre}
                    aria-label={`Ordre de ${cat.nom}`}
                    onBlur={(event) => enregistrer(cat, { ordre: Number(event.target.value) })}
                    className="w-14 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={cat.nom}
                    aria-label={`Nom de ${cat.nom}`}
                    onBlur={(event) => enregistrer(cat, { nom: event.target.value })}
                    className="w-full rounded-lg border border-ink/15 px-2 py-1 text-sm"
                  />
                  <code className="text-[11px] text-ink/35">{cat.slug}</code>
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={cat.image ?? ""}
                    placeholder="/images/cat-x.jpg"
                    aria-label={`Image de ${cat.nom}`}
                    onBlur={(event) =>
                      enregistrer(cat, { image: event.target.value.trim() || null })
                    }
                    className="w-full rounded-lg border border-ink/15 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={cat.actif}
                    aria-label={`Catégorie ${cat.nom} active`}
                    onChange={(event) => enregistrer(cat, { actif: event.target.checked })}
                    className="size-4 accent-brand"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => supprimer(cat)}
                    aria-label={`Supprimer ${cat.nom}`}
                    className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/40">
        L&apos;icône et les exemples de recherche d&apos;une catégorie sont définis dans le
        code (repli automatique pour une nouvelle catégorie). Une catégorie ne peut
        être supprimée que si elle ne contient plus de produits.
      </p>
    </div>
  );
}
