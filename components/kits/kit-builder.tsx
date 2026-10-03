"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { slugAvecId } from "@/lib/slug";
import { usePanier } from "@/lib/local/panier";
import { useKitsPanier } from "@/lib/local/kits-panier";
import { useAjoutMode } from "@/lib/local/ajout-mode";
import { KitBeneficiairePicker } from "@/components/kits/kit-beneficiaire-picker";
import { ligneEstAffichable } from "@/lib/kits";
import type { Produit, SectionKitItem, VarianteAvecAttributs } from "@/lib/supabase/types";

export type LigneKitBuilder = {
  id: number;
  produit: Produit;
  quantite: number;
  libelleBesoin: string | null;
  groupeAffichage: string | null;
  section: SectionKitItem;
  cocheDefaut: boolean;
  ordre: number;
  variantes: VarianteAvecAttributs[];
};

type EtatLigne = { checked: boolean; varianteId: number | null };

type KitBuilderProps = {
  kitId: number;
  cycle: string;
  niveau: string;
  gamme: string;
  gammeLabel: string;
  photoKit: string | null;
  lignes: LigneKitBuilder[];
};

const GROUPE_CAHIERS = "Cahiers";

function varianteParDefaut(variantes: VarianteAvecAttributs[]): number | null {
  const dispo = variantes.find((v) => v.statut !== "epuise");
  return dispo?.id ?? variantes[0]?.id ?? null;
}

export function KitBuilder({
  kitId,
  cycle,
  niveau,
  gamme,
  gammeLabel,
  photoKit,
  lignes: toutesLesLignes,
}: KitBuilderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Réouvert depuis « Modifier » sur une carte du panier (CORRECTIONS_V15
  // Lot 2) : on repart de la sélection exacte de ce kit dans le panier, pas
  // des coches par défaut.
  const modifierGroupeId = searchParams.get("modifier");

  const { ajouterKit, lignes: lignesPanier } = usePanier();
  const { enregistrer: enregistrerKitClasse } = useKitsPanier();
  // Mode ajout (PROMPT_CLIENT_V2 Lot 4) : pas de "Commander ce kit" direct —
  // ajouterKit() va déjà dans le panier de l'ajout en cours (usePanier() est
  // mode-aware), il n'y a qu'un seul bouton, comme en mode "Modifier".
  const { mode: modeAjout } = useAjoutMode();
  const [added, setAdded] = useState(false);

  const lignesExistantesDuGroupe = useMemo(
    () => (modifierGroupeId ? lignesPanier.filter((l) => l.groupe?.id === modifierGroupeId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const groupeExistant = lignesExistantesDuGroupe[0]?.groupe ?? null;

  const [beneficiaireId, setBeneficiaireId] = useState<number | null>(
    () => groupeExistant?.beneficiaireId ?? null,
  );
  const [beneficiairePrenom, setBeneficiairePrenom] = useState<string | null>(
    () => groupeExistant?.beneficiairePrenom ?? null,
  );
  // Ouvert par défaut (CORRECTIONS_KITS Lot 5 §1) : fermé, les cahiers
  // passaient inaperçus (ex. kits 3e Confort, CM2 Confort).
  const [cahiersOuverts, setCahiersOuverts] = useState(true);

  const lignes = useMemo(
    () => toutesLesLignes.filter((l) => ligneEstAffichable(l.produit)).sort((a, b) => a.ordre - b.ordre),
    [toutesLesLignes],
  );

  const [etats, setEtats] = useState<Record<number, EtatLigne>>(() =>
    Object.fromEntries(
      lignes.map((l) => {
        if (lignesExistantesDuGroupe.length > 0) {
          const existante = lignesExistantesDuGroupe.find((le) => le.produitId === l.produit.id);
          return [
            l.id,
            { checked: Boolean(existante), varianteId: existante?.varianteId ?? varianteParDefaut(l.variantes) },
          ];
        }
        return [l.id, { checked: l.cocheDefaut, varianteId: varianteParDefaut(l.variantes) }];
      }),
    ),
  );

  const toggle = (id: number) =>
    setEtats((c) => ({ ...c, [id]: { ...c[id], checked: !c[id].checked } }));

  const choisirVariante = (id: number, varianteId: number) =>
    setEtats((c) => ({ ...c, [id]: { ...c[id], varianteId } }));

  const prixLigne = (l: LigneKitBuilder) => {
    const variante = l.variantes.find((v) => v.id === etats[l.id]?.varianteId);
    return variante?.prix ?? l.produit.prix;
  };

  const { total, nbArticles } = useMemo(() => {
    return lignes.reduce(
      (acc, l) => {
        if (!etats[l.id]?.checked) return acc;
        return { total: acc.total + l.quantite * prixLigne(l), nbArticles: acc.nbArticles + l.quantite };
      },
      { total: 0, nbArticles: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, etats]);

  const principales = lignes.filter((l) => l.section === "principal");
  const livresProposes = lignes.filter((l) => l.section === "livres_proposes");
  const options = lignes.filter((l) => l.section === "option");

  const cahiers = principales.filter((l) => l.groupeAffichage === GROUPE_CAHIERS);
  const autresPrincipales = principales.filter((l) => l.groupeAffichage !== GROUPE_CAHIERS);
  // Titre du bloc (CORRECTIONS_KITS Lot 5 §1) : somme des quantités cochées,
  // pas le nombre de lignes (un même cahier peut être en quantité 2, 3…).
  const nbCahiersCoches = cahiers
    .filter((l) => etats[l.id]?.checked)
    .reduce((s, l) => s + l.quantite, 0);

  // Construit les lignes cochées et les range dans le panier. Pure côté
  // données : la navigation qui suit dépend du bouton cliqué (PROMPT_CLIENT_V2
  // Lot 3), voir handleCommander / handleAjouterContinuer ci-dessous.
  const ajouterAuPanier = () => {
    const produitIds: number[] = [];
    const items: { produitId: number; varianteId: number | null; quantite: number }[] = [];
    lignes.forEach((l) => {
      const etat = etats[l.id];
      if (!etat?.checked) return;
      items.push({ produitId: l.produit.id, varianteId: etat.varianteId, quantite: l.quantite });
      produitIds.push(l.produit.id);
    });

    ajouterKit(
      {
        id: groupeExistant?.id,
        kitId,
        cycle,
        niveau,
        gamme,
        gammeLabel,
        photo: photoKit,
        beneficiaireId,
        beneficiairePrenom,
      },
      items,
    );
    enregistrerKitClasse(cycle, niveau, { beneficiaireId, produitIds });
  };

  // Bouton principal (PROMPT_CLIENT_V2 Lot 3) : va directement à la page
  // commande, sans passer par le panier. En mode « Modifier » (réouvert
  // depuis une carte du panier), on retourne au panier comme avant — ce
  // n'est pas un nouvel achat.
  const handleCommander = () => {
    ajouterAuPanier();
    router.push(modifierGroupeId ? "/panier" : "/checkout");
  };

  // Lien secondaire : comportement historique du bouton (reste sur la page,
  // feedback "Ajouté ✓").
  const handleAjouterContinuer = () => {
    ajouterAuPanier();
    if (modifierGroupeId) {
      router.push("/panier");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col lg:mx-auto lg:w-full lg:max-w-5xl lg:flex-row lg:items-start lg:gap-8">
    <div className="flex flex-1 flex-col">
      <KitBeneficiairePicker
        cycle={cycle}
        niveau={niveau}
        value={beneficiaireId}
        onChange={(id, prenom) => {
          setBeneficiaireId(id);
          setBeneficiairePrenom(prenom);
        }}
      />

      <ul className="flex flex-col divide-y divide-ink/10 px-4">
        {cahiers.length > 0 && (
          <li className="flex flex-col py-2.5">
            <button
              type="button"
              onClick={() => setCahiersOuverts((v) => !v)}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-sm text-ink">
                Cahiers : {nbCahiersCoches} cahier{nbCahiersCoches > 1 ? "s" : ""}
              </span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`shrink-0 text-ink/40 transition-transform ${cahiersOuverts ? "rotate-180" : ""}`}
              />
            </button>
            {cahiersOuverts && (
              <ul className="mt-2 flex flex-col divide-y divide-ink/5 border-t border-ink/5 pt-1">
                {cahiers.map((l) => (
                  <LigneKitRow
                    key={l.id}
                    ligne={l}
                    etat={etats[l.id]}
                    onToggle={() => toggle(l.id)}
                    onVariante={(vid) => choisirVariante(l.id, vid)}
                    compact
                  />
                ))}
              </ul>
            )}
          </li>
        )}

        {autresPrincipales.map((l) => (
          <LigneKitRow
            key={l.id}
            ligne={l}
            etat={etats[l.id]}
            onToggle={() => toggle(l.id)}
            onVariante={(vid) => choisirVariante(l.id, vid)}
          />
        ))}
      </ul>

      {livresProposes.length > 0 && (
        <div className="mx-4 mt-3 flex flex-col gap-1 rounded-2xl border border-ink/10 bg-elevated p-3">
          <span className="text-xs font-semibold text-ink/70">Livres au programme, non inclus</span>
          <ul className="flex flex-col divide-y divide-ink/5">
            {livresProposes.map((l) => (
              <LigneKitRow
                key={l.id}
                ligne={l}
                etat={etats[l.id]}
                onToggle={() => toggle(l.id)}
                onVariante={(vid) => choisirVariante(l.id, vid)}
                compact
              />
            ))}
          </ul>
        </div>
      )}

      {options.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink/10 px-4 pt-2">
          {options.map((l) => (
            <LigneKitRow
              key={l.id}
              ligne={l}
              etat={etats[l.id]}
              onToggle={() => toggle(l.id)}
              onVariante={(vid) => choisirVariante(l.id, vid)}
            />
          ))}
        </ul>
      )}
    </div>

      <div className="sticky bottom-16 z-30 mt-4 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:sticky lg:top-20 lg:mt-0 lg:w-80 lg:shrink-0 lg:rounded-2xl lg:border lg:bg-elevated lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-ink/50">
              {nbArticles} article{nbArticles > 1 ? "s" : ""} sélectionné{nbArticles > 1 ? "s" : ""}
            </span>
            <span className="text-sm font-semibold text-ink">{formatPrice(total)}</span>
          </div>
          {modifierGroupeId || modeAjout ? (
            <button
              type="button"
              disabled={nbArticles === 0}
              onClick={handleAjouterContinuer}
              className="flex h-11 items-center justify-center rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30 lg:w-full"
            >
              {modifierGroupeId ? "Mettre à jour le kit" : added ? "Ajouté ✓" : "Ajouter le kit"}
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1.5 lg:items-stretch">
              <button
                type="button"
                disabled={nbArticles === 0}
                onClick={handleCommander}
                className="flex h-11 items-center justify-center rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30 lg:w-full"
              >
                Commander ce kit
              </button>
              <button
                type="button"
                disabled={nbArticles === 0}
                onClick={handleAjouterContinuer}
                className="text-xs font-medium text-ink/60 underline-offset-2 transition-colors hover:text-ink hover:underline disabled:cursor-not-allowed disabled:text-ink/30 lg:text-center"
              >
                {added ? "Ajouté ✓" : "Ajouter au panier et continuer mes achats"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LigneKitRow({
  ligne,
  etat,
  onToggle,
  onVariante,
  compact = false,
}: {
  ligne: LigneKitBuilder;
  etat: EtatLigne | undefined;
  onToggle: () => void;
  onVariante: (varianteId: number) => void;
  compact?: boolean;
}) {
  const epuise = ligne.produit.statut === "epuise";
  const variante = ligne.variantes.find((v) => v.id === etat?.varianteId);
  const prix = variante?.prix ?? ligne.produit.prix;

  return (
    <li className={`flex flex-col gap-1.5 ${compact ? "py-2" : "py-2.5"}`}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={etat?.checked ?? false}
          disabled={epuise}
          onChange={onToggle}
          aria-label={`Inclure ${ligne.libelleBesoin ?? ligne.produit.nom}`}
          className="size-5 shrink-0 accent-brand"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/produits/${slugAvecId(ligne.produit.nom, ligne.produit.id)}`}
            className="truncate text-sm text-ink hover:underline"
          >
            {ligne.libelleBesoin ?? ligne.produit.nom}
          </Link>
          <span className="text-xs text-ink/50">
            {ligne.quantite > 1 ? `${ligne.quantite} × ` : ""}
            {formatPrice(prix)}
          </span>
          {epuise && <span className="text-[11px] text-ink/40">Épuisé — non inclus</span>}
        </div>
      </div>

      {ligne.variantes.length > 1 && etat?.checked && (
        <div className="ml-8 flex flex-wrap gap-1.5">
          {ligne.variantes.map((v) => {
            const label = v.attributs.map((a) => a.valeur).join(" / ") || `#${v.id}`;
            const active = v.id === etat.varianteId;
            const varianteEpuisee = v.statut === "epuise";
            return (
              <button
                key={v.id}
                type="button"
                disabled={varianteEpuisee}
                onClick={() => onVariante(v.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  varianteEpuisee
                    ? "cursor-not-allowed border-ink/10 text-ink/25 line-through"
                    : active
                      ? "border-brand bg-brand text-on-brand"
                      : "border-ink/15 text-ink/70"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
