"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2, Pin, Search, TriangleAlert, X } from "lucide-react";
import {
  enregistrerDecouvrir,
  rechercherProduitDecouvrir,
  type CarteDecouvrir,
} from "@/lib/admin/decouvrir-actions";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";

// Éditeur "À découvrir" (PROMPT_ADMIN_V2 Lot 4) : tout se passe en mémoire
// locale (réordonner, retirer, ajouter) jusqu'au clic sur "Enregistrer" — un
// clic sur "Annuler" revient simplement à l'aperçu chargé par le serveur.
export function DecouvrirEditeur({ initial }: { initial: CarteDecouvrir[] }) {
  const router = useRouter();
  const [cartes, setCartes] = useState<CarteDecouvrir[]>(initial);
  const [retires, setRetires] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  const modifie =
    retires.size > 0 ||
    cartes.length !== initial.length ||
    cartes.some((c, i) => c.produitId !== initial[i]?.produitId);

  const deplacer = (index: number, delta: number) => {
    setCartes((liste) => {
      const cible = index + delta;
      if (cible < 0 || cible >= liste.length) return liste;
      const copie = [...liste];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
  };

  const retirer = (produitId: number) => {
    setCartes((liste) => liste.filter((c) => c.produitId !== produitId));
    setRetires((r) => new Set(r).add(produitId));
  };

  const ajouter = (carte: CarteDecouvrir, index: number) => {
    setCartes((liste) => {
      if (liste.some((c) => c.produitId === carte.produitId)) return liste;
      const copie = [...liste];
      copie.splice(index, 0, carte);
      return copie;
    });
    setRetires((r) => {
      if (!r.has(carte.produitId)) return r;
      const copie = new Set(r);
      copie.delete(carte.produitId);
      return copie;
    });
  };

  const annuler = () => {
    setCartes(initial);
    setRetires(new Set());
    setErreur(null);
  };

  const enregistrer = async () => {
    setSaving(true);
    setErreur(null);
    const res = await enregistrerDecouvrir({
      ordre: cartes.map((c) => c.produitId),
      retires: [...retires],
    });
    setSaving(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setRetires(new Set());
    setOk(true);
    setTimeout(() => setOk(false), 2000);
    router.refresh();
  };

  // Glisser-déposer natif (souris, ordinateur) ; sur téléphone, les flèches
  // monter/descendre de chaque carte couvrent le même besoin.
  const onDragStart = (index: number) => {
    dragIndex.current = index;
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (index: number) => {
    const depart = dragIndex.current;
    dragIndex.current = null;
    if (depart == null || depart === index) return;
    setCartes((liste) => {
      const copie = [...liste];
      const [retire] = copie.splice(depart, 1);
      copie.splice(index, 0, retire);
      return copie;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <AjouterProduit onAjouter={(carte) => ajouter(carte, 0)} />

      <ul className="flex flex-col gap-2">
        {cartes.map((carte, index) => (
          <li
            key={carte.produitId}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(index)}
            className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3"
          >
            <GripVertical size={16} className="hidden shrink-0 cursor-grab text-ink/30 lg:block" aria-hidden="true" />
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
              <ProductImage src={carte.photo} alt={carte.nom} className="absolute inset-0 size-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{carte.nom}</p>
              <p className="text-xs text-ink/50">{formatPrice(carte.prix)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    carte.epingleAvant ? "bg-brand/10 text-brand" : "bg-ink/5 text-ink/50"
                  }`}
                >
                  <Pin size={9} aria-hidden="true" />
                  {carte.epingleAvant ? "Épinglé" : "Automatique"}
                </span>
                {!carte.photo && <Avertissement texte="Sans image" />}
                {carte.statutPublication !== "publie" && <Avertissement texte="Invisible" />}
                {carte.stock <= 0 && <Avertissement texte="Rupture" />}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => deplacer(index, -1)}
                disabled={index === 0}
                aria-label="Monter"
                className="rounded-lg border border-ink/15 p-1 text-ink/60 disabled:opacity-30"
              >
                <ArrowUp size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => deplacer(index, 1)}
                disabled={index === cartes.length - 1}
                aria-label="Descendre"
                className="rounded-lg border border-ink/15 p-1 text-ink/60 disabled:opacity-30"
              >
                <ArrowDown size={13} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => retirer(carte.produitId)}
              aria-label="Retirer de l'accueil"
              className="shrink-0 rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-red-600"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="sticky bottom-20 flex items-center gap-2 rounded-2xl border border-ink/10 bg-white p-3 shadow-lg lg:bottom-4">
        <button
          type="button"
          onClick={enregistrer}
          disabled={!modifie || saving}
          className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : ok ? <Check size={15} /> : null}
          {ok ? "Enregistré" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={annuler}
          disabled={!modifie || saving}
          className="flex min-h-10 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Annuler les changements
        </button>
      </div>
    </div>
  );
}

function Avertissement({ texte }: { texte: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
      <TriangleAlert size={9} aria-hidden="true" />
      {texte}
    </span>
  );
}

function AjouterProduit({ onAjouter }: { onAjouter: (carte: CarteDecouvrir) => void }) {
  const [terme, setTerme] = useState("");
  const [resultats, setResultats] = useState<CarteDecouvrir[]>([]);
  const [recherche, setRecherche] = useState(false);

  const lancerRecherche = async (valeur: string) => {
    setTerme(valeur);
    if (valeur.trim().length < 2) {
      setResultats([]);
      return;
    }
    setRecherche(true);
    const res = await rechercherProduitDecouvrir(valeur);
    setRecherche(false);
    setResultats(res);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-3">
      <label className="flex items-center gap-2 rounded-full border border-ink/15 px-3 py-2">
        <Search size={14} className="text-ink/40" aria-hidden="true" />
        <input
          value={terme}
          onChange={(e) => lancerRecherche(e.target.value)}
          placeholder="Ajouter un produit à l'accueil…"
          className="w-full text-sm outline-none"
        />
      </label>
      {recherche && <p className="px-1 text-xs text-ink/40">Recherche…</p>}
      {resultats.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink/5">
          {resultats.map((r) => (
            <li key={r.produitId} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 truncate text-sm text-ink/80">
                {r.nom} <span className="text-xs text-ink/40">· {formatPrice(r.prix)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onAjouter(r);
                  setTerme("");
                  setResultats([]);
                }}
                className="shrink-0 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-brand"
              >
                Ajouter
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
