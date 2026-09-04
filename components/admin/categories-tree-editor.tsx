"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2 } from "lucide-react";
import {
  creerCategorie,
  modifierCategorie,
  supprimerCategorie,
} from "@/lib/admin/categories-actions";
import {
  creerSousCategorie,
  modifierSousCategorie,
  supprimerSousCategorie,
} from "@/lib/admin/sous-categories-actions";
import {
  creerSousSousCategorie,
  modifierSousSousCategorie,
  supprimerSousSousCategorie,
} from "@/lib/admin/sous-sous-categories-actions";
import type { Categorie, SousCategorie, SousSousCategorie } from "@/lib/supabase/types";

type Props = {
  categories: Categorie[];
  sousCategories: SousCategorie[];
  sousSousCategories: SousSousCategorie[];
};

const CHAMP_ORDRE =
  "w-14 shrink-0 rounded-lg border border-ink/15 min-h-9 px-2 text-sm";
const CHAMP_NOM = "min-w-0 flex-1 rounded-lg border border-ink/15 min-h-9 px-2.5 text-sm";
const BTN_SUPPRIMER =
  "shrink-0 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600";
const BTN_AJOUTER =
  "shrink-0 rounded-full border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/5 disabled:opacity-40";

// Vue arborescente unique (Catégorie -> Sous-catégorie -> Sous-sous-catégorie
// optionnelle) : SOUS_SOUS_CATEGORIES.md §4. Remplace les deux anciens écrans
// séparés « Catégories » / « Sous-catégories ». <details> natif pour replier
// chaque niveau (14 catégories + leurs sous-niveaux ne tiennent pas toutes
// dépliées sur mobile).
export function CategoriesTreeEditor({ categories, sousCategories, sousSousCategories }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sousCatsParCategorie = useMemo(() => {
    const map = new Map<number, SousCategorie[]>();
    for (const sc of sousCategories) {
      const liste = map.get(sc.categorie_id) ?? [];
      liste.push(sc);
      map.set(sc.categorie_id, liste);
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
    }
    return map;
  }, [sousCategories]);

  const sousSousCatsParSousCategorie = useMemo(() => {
    const map = new Map<number, SousSousCategorie[]>();
    for (const ssc of sousSousCategories) {
      const liste = map.get(ssc.sous_categorie_id) ?? [];
      liste.push(ssc);
      map.set(ssc.sous_categorie_id, liste);
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
    }
    return map;
  }, [sousSousCategories]);

  const ajouterCategorie = async (event: FormEvent) => {
    event.preventDefault();
    if (!nouvelleCategorie.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await creerCategorie({
      nom: nouvelleCategorie.trim(),
      ordre: (categories.at(-1)?.ordre ?? 0) + 1,
      image: null,
      actif: true,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNouvelleCategorie("");
    router.refresh();
  };

  const enregistrerCategorie = async (cat: Categorie, patch: Partial<Categorie>) => {
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

  const supprimerCat = async (cat: Categorie) => {
    setError(null);
    const result = await supprimerCategorie(cat.id);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form
        onSubmit={ajouterCategorie}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-4"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Nouvelle catégorie</span>
          <input
            value={nouvelleCategorie}
            onChange={(event) => setNouvelleCategorie(event.target.value)}
            placeholder="Ex. : Instruments de musique"
            className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-3">
        {categories.map((cat) => {
          const sousCats = sousCatsParCategorie.get(cat.id) ?? [];
          return (
            <details
              key={cat.id}
              className="group rounded-2xl border border-ink/10 bg-white [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                <ChevronDown
                  size={16}
                  className="shrink-0 text-ink/40 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold text-ink">
                  {cat.nom}
                </span>
                <span className="shrink-0 text-xs text-ink/40">
                  {sousCats.length} sous-catégorie{sousCats.length > 1 ? "s" : ""}
                </span>
                {!cat.actif && (
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink/50">
                    Masquée
                  </span>
                )}
              </summary>

              <div className="flex flex-col gap-3 border-t border-ink/10 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    defaultValue={cat.ordre}
                    aria-label={`Ordre de ${cat.nom}`}
                    onBlur={(event) =>
                      enregistrerCategorie(cat, { ordre: Number(event.target.value) })
                    }
                    className={CHAMP_ORDRE}
                  />
                  <input
                    defaultValue={cat.nom}
                    aria-label={`Nom de ${cat.nom}`}
                    onBlur={(event) => enregistrerCategorie(cat, { nom: event.target.value })}
                    className={CHAMP_NOM}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink/60">
                    <input
                      type="checkbox"
                      checked={cat.actif}
                      aria-label={`Catégorie ${cat.nom} active`}
                      onChange={(event) =>
                        enregistrerCategorie(cat, { actif: event.target.checked })
                      }
                      className="size-4 accent-brand"
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => supprimerCat(cat)}
                    aria-label={`Supprimer ${cat.nom}`}
                    className={BTN_SUPPRIMER}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                <input
                  defaultValue={cat.image ?? ""}
                  placeholder="Image (chemin, ex. /images/cat-x.jpg)"
                  aria-label={`Image de ${cat.nom}`}
                  onBlur={(event) =>
                    enregistrerCategorie(cat, { image: event.target.value.trim() || null })
                  }
                  className="rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs"
                />

                <div className="flex flex-col gap-2 border-l-2 border-ink/10 pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                    Sous-catégories
                  </p>
                  {sousCats.length === 0 && (
                    <p className="text-xs text-ink/40">Aucune sous-catégorie.</p>
                  )}
                  {sousCats.map((sc) => (
                    <SousCategorieNode
                      key={sc.id}
                      sousCategorie={sc}
                      sousSousCategories={sousSousCatsParSousCategorie.get(sc.id) ?? []}
                      onError={setError}
                      onChanged={() => router.refresh()}
                    />
                  ))}
                  <NouvelleSousCategorie
                    categorieId={cat.id}
                    onError={setError}
                    onChanged={() => router.refresh()}
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <p className="text-xs text-ink/40">
        Une catégorie ne peut être supprimée que si elle ne contient plus de produits (idem
        pour une sous-catégorie ou une sous-sous-catégorie). Le 3e niveau (sous-sous-catégorie)
        est optionnel : ne l&apos;utilisez que là où il aide vraiment à s&apos;y retrouver.
      </p>
    </div>
  );
}

function SousCategorieNode({
  sousCategorie,
  sousSousCategories,
  onError,
  onChanged,
}: {
  sousCategorie: SousCategorie;
  sousSousCategories: SousSousCategorie[];
  onError: (error: string | null) => void;
  onChanged: () => void;
}) {
  const renommer = async (nom: string) => {
    if (!nom.trim() || nom.trim() === sousCategorie.nom) return;
    onError(null);
    const result = await modifierSousCategorie(sousCategorie.id, {
      nom: nom.trim(),
      categorie_id: sousCategorie.categorie_id,
      ordre: sousCategorie.ordre,
    });
    if (!result.ok) onError(result.error);
    onChanged();
  };

  const changerOrdre = async (ordre: number) => {
    if (ordre === sousCategorie.ordre) return;
    onError(null);
    const result = await modifierSousCategorie(sousCategorie.id, {
      nom: sousCategorie.nom,
      categorie_id: sousCategorie.categorie_id,
      ordre,
    });
    if (!result.ok) onError(result.error);
    onChanged();
  };

  const supprimer = async () => {
    onError(null);
    const result = await supprimerSousCategorie(sousCategorie.id);
    if (!result.ok) onError(result.error);
    onChanged();
  };

  return (
    <details className="group rounded-xl border border-ink/10 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <ChevronDown
          size={14}
          className="shrink-0 text-ink/35 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{sousCategorie.nom}</span>
        {sousSousCategories.length > 0 && (
          <span className="shrink-0 text-[11px] text-ink/40">
            {sousSousCategories.length} sous-sous-cat.
          </span>
        )}
      </summary>

      <div className="flex flex-col gap-2 border-t border-ink/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            defaultValue={sousCategorie.ordre}
            aria-label={`Ordre de ${sousCategorie.nom}`}
            onBlur={(event) => changerOrdre(Number(event.target.value))}
            className={CHAMP_ORDRE}
          />
          <input
            defaultValue={sousCategorie.nom}
            aria-label={`Nom de ${sousCategorie.nom}`}
            onBlur={(event) => renommer(event.target.value)}
            className={CHAMP_NOM}
          />
          <button
            type="button"
            onClick={supprimer}
            aria-label={`Supprimer ${sousCategorie.nom}`}
            className={BTN_SUPPRIMER}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-2 border-l-2 border-ink/10 pl-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/35">
            Sous-sous-catégories (optionnel)
          </p>
          {sousSousCategories.length === 0 && (
            <p className="text-[11px] text-ink/40">
              Aucune — ce rayon n&apos;a pas de 3e niveau.
            </p>
          )}
          {sousSousCategories.map((ssc) => (
            <SousSousCategorieRow
              key={ssc.id}
              sousSousCategorie={ssc}
              onError={onError}
              onChanged={onChanged}
            />
          ))}
          <NouvelleSousSousCategorie
            sousCategorieId={sousCategorie.id}
            onError={onError}
            onChanged={onChanged}
          />
        </div>
      </div>
    </details>
  );
}

function SousSousCategorieRow({
  sousSousCategorie,
  onError,
  onChanged,
}: {
  sousSousCategorie: SousSousCategorie;
  onError: (error: string | null) => void;
  onChanged: () => void;
}) {
  const renommer = async (nom: string) => {
    if (!nom.trim() || nom.trim() === sousSousCategorie.nom) return;
    onError(null);
    const result = await modifierSousSousCategorie(sousSousCategorie.id, {
      nom: nom.trim(),
      sous_categorie_id: sousSousCategorie.sous_categorie_id,
      ordre: sousSousCategorie.ordre,
    });
    if (!result.ok) onError(result.error);
    onChanged();
  };

  const changerOrdre = async (ordre: number) => {
    if (ordre === sousSousCategorie.ordre) return;
    onError(null);
    const result = await modifierSousSousCategorie(sousSousCategorie.id, {
      nom: sousSousCategorie.nom,
      sous_categorie_id: sousSousCategorie.sous_categorie_id,
      ordre,
    });
    if (!result.ok) onError(result.error);
    onChanged();
  };

  const supprimer = async () => {
    onError(null);
    const result = await supprimerSousSousCategorie(sousSousCategorie.id);
    if (!result.ok) onError(result.error);
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        defaultValue={sousSousCategorie.ordre}
        aria-label={`Ordre de ${sousSousCategorie.nom}`}
        onBlur={(event) => changerOrdre(Number(event.target.value))}
        className={CHAMP_ORDRE}
      />
      <input
        defaultValue={sousSousCategorie.nom}
        aria-label={`Nom de ${sousSousCategorie.nom}`}
        onBlur={(event) => renommer(event.target.value)}
        className={CHAMP_NOM}
      />
      <button
        type="button"
        onClick={supprimer}
        aria-label={`Supprimer ${sousSousCategorie.nom}`}
        className={BTN_SUPPRIMER}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function NouvelleSousCategorie({
  categorieId,
  onError,
  onChanged,
}: {
  categorieId: number;
  onError: (error: string | null) => void;
  onChanged: () => void;
}) {
  const [nom, setNom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ajouter = async () => {
    if (!nom.trim()) return;
    setSubmitting(true);
    onError(null);
    const result = await creerSousCategorie({ nom: nom.trim(), categorie_id: categorieId, ordre: 0 });
    setSubmitting(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setNom("");
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input
        value={nom}
        onChange={(event) => setNom(event.target.value)}
        placeholder="Nouvelle sous-catégorie"
        className={CHAMP_NOM}
      />
      <button type="button" onClick={ajouter} disabled={submitting || !nom.trim()} className={BTN_AJOUTER}>
        Ajouter
      </button>
    </div>
  );
}

function NouvelleSousSousCategorie({
  sousCategorieId,
  onError,
  onChanged,
}: {
  sousCategorieId: number;
  onError: (error: string | null) => void;
  onChanged: () => void;
}) {
  const [nom, setNom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ajouter = async () => {
    if (!nom.trim()) return;
    setSubmitting(true);
    onError(null);
    const result = await creerSousSousCategorie({
      nom: nom.trim(),
      sous_categorie_id: sousCategorieId,
      ordre: 0,
    });
    setSubmitting(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setNom("");
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input
        value={nom}
        onChange={(event) => setNom(event.target.value)}
        placeholder="Nouvelle sous-sous-catégorie"
        className={CHAMP_NOM}
      />
      <button type="button" onClick={ajouter} disabled={submitting || !nom.trim()} className={BTN_AJOUTER}>
        Ajouter
      </button>
    </div>
  );
}
