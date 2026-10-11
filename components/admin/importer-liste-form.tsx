"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyserImportListe,
  creerListeDepuisImport,
  type LigneImportAnalysee,
} from "@/lib/admin/listes-actions";
import { rechercherProduitsAdmin } from "@/lib/admin/produits-actions";
import { formatPrice } from "@/lib/format";
import { ChampSelect, type OptionSelect } from "@/components/ui/champ-select";

type LigneRevue = {
  texte: string;
  libelle: string;
  quantite: string;
  inclus: boolean;
  produitId: number | "";
  produitOption: OptionSelect | null;
};

function optionDe(c: LigneImportAnalysee["candidats"][number]): OptionSelect {
  return { value: String(c.id), label: `${c.nom} (${formatPrice(c.prix)})` };
}

export function ImporterListeForm() {
  const router = useRouter();
  const [etape, setEtape] = useState<"coller" | "revue">("coller");
  const [texte, setTexte] = useState("");
  const [titre, setTitre] = useState("");
  const [lignes, setLignes] = useState<LigneRevue[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyser = async () => {
    setError(null);
    if (!texte.trim()) {
      setError("Collez d'abord une liste, une ligne par article.");
      return;
    }
    setAnalysing(true);
    const resultat = await analyserImportListe(texte);
    setAnalysing(false);
    if (resultat.length === 0) {
      setError("Aucune ligne reconnue dans ce texte.");
      return;
    }
    setLignes(
      resultat.map((r) => {
        const meilleur = r.candidats[0] ?? null;
        return {
          texte: r.texte,
          libelle: r.libelle,
          quantite: String(r.quantite),
          inclus: meilleur !== null,
          produitId: meilleur?.id ?? "",
          produitOption: meilleur ? optionDe(meilleur) : null,
        };
      }),
    );
    setEtape("revue");
  };

  const rechercher = async (terme: string): Promise<OptionSelect[]> => {
    const resultats = await rechercherProduitsAdmin(terme, { limite: 8 });
    return resultats.map((p) => ({ value: String(p.id), label: `${p.nom} (${formatPrice(p.prix)})` }));
  };

  const patch = (index: number, patch: Partial<LigneRevue>) =>
    setLignes((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const creer = async () => {
    setError(null);
    if (!titre.trim()) {
      setError("Le titre de la liste est requis.");
      return;
    }
    const retenues = lignes
      .filter((l) => l.inclus && l.produitId !== "")
      .map((l) => ({ produitId: Number(l.produitId), quantite: Math.max(1, Number(l.quantite) || 1) }));
    if (retenues.length === 0) {
      setError("Sélectionnez au moins un article avec un produit choisi.");
      return;
    }
    setCreating(true);
    const result = await creerListeDepuisImport(titre.trim(), retenues);
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/listes/${result.id}`);
  };

  if (etape === "coller") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">
            Collez une liste (une ligne par article, quantité en début ou en fin de ligne — ex. « 6 cahiers de
            200 pages » ou « Surligneurs x4 »)
          </span>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={8}
            placeholder={"6 cahiers de 200 pages\nSurligneurs x4\nRègle de 30 cm"}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={analyser}
          disabled={analysing}
          className="w-fit min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          {analysing ? "Analyse…" : "Analyser"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Titre de la liste</span>
        <input
          required
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Fournitures 4e"
          className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
        />
      </label>

      <div className="flex flex-col gap-2">
        {lignes.map((l, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-ink/10 p-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="checkbox"
              checked={l.inclus}
              onChange={(e) => patch(i, { inclus: e.target.checked })}
              className="size-5 shrink-0 accent-brand"
              aria-label={`Inclure « ${l.texte} »`}
            />
            <span className="w-full shrink-0 truncate text-xs text-ink/50 sm:w-40" title={l.texte}>
              {l.texte}
            </span>
            <div className="min-w-0 flex-1">
              <ChampSelect
                ariaLabel={`Produit pour ${l.libelle}`}
                placeholder="Choisir un produit…"
                searchHint="Tapez le nom, l'ID ou la marque de l'article…"
                className="min-h-10 rounded-lg border border-ink/15 px-2 text-sm"
                value={l.produitId === "" ? "" : String(l.produitId)}
                onChange={(v) => patch(i, { produitId: v === "" ? "" : Number(v) })}
                options={l.produitOption ? [l.produitOption] : []}
                onSelect={(option) => patch(i, { produitOption: option })}
                onSearch={rechercher}
              />
              {l.produitId === "" && (
                <p className="mt-1 text-[11px] text-amber-600">Aucune correspondance automatique — cherchez manuellement ou décochez.</p>
              )}
            </div>
            <input
              type="number"
              min={1}
              value={l.quantite}
              onChange={(e) => patch(i, { quantite: e.target.value })}
              className="min-h-10 w-16 shrink-0 rounded-lg border border-ink/15 px-2 text-sm"
              aria-label="Quantité"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-ink/10 pt-3">
        <button
          type="button"
          onClick={creer}
          disabled={creating}
          className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
        >
          {creating ? "Création…" : "Créer la liste"}
        </button>
        <button
          type="button"
          onClick={() => setEtape("coller")}
          className="text-xs font-medium text-ink/60 hover:underline"
        >
          Recommencer
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
