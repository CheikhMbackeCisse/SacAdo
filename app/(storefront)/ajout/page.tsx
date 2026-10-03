"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { usePanierDetaille, type LigneDetaillee } from "@/lib/local/use-panier-detaille";
import { useKitsPanier } from "@/lib/local/kits-panier";
import { useAjoutMode } from "@/lib/local/ajout-mode";
import { getCommandeModifiable, confirmerAjoutLivraison, demarrerAjoutWave } from "@/lib/ajout/actions";
import type { CommandeAjoutInfo } from "@/lib/ajout/actions";
import { PanierLine } from "@/components/panier/panier-line";
import { PanierKitCard } from "@/components/panier/panier-kit-card";
import { formatPrice } from "@/lib/format";
import type { GroupeKitPanier } from "@/lib/local/panier";
import type { ModePaiement } from "@/lib/supabase/types";

type GroupeAffichage = { groupe: GroupeKitPanier; lignes: LigneDetaillee[] };

function regrouperParKit(detail: LigneDetaillee[]): {
  groupes: GroupeAffichage[];
  horsGroupe: LigneDetaillee[];
} {
  const groupesMap = new Map<string, GroupeAffichage>();
  const horsGroupe: LigneDetaillee[] = [];
  for (const ligne of detail) {
    if (ligne.groupe) {
      const existant = groupesMap.get(ligne.groupe.id);
      if (existant) existant.lignes.push(ligne);
      else groupesMap.set(ligne.groupe.id, { groupe: ligne.groupe, lignes: [ligne] });
    } else {
      horsGroupe.push(ligne);
    }
  }
  return { groupes: [...groupesMap.values()], horsGroupe };
}

// Récapitulatif + paiement d'un ajout à une commande déjà passée
// (PROMPT_CLIENT_V2 Lot 4) : atteint via "Terminer" dans la bannière de mode
// ajout. Aucun frais de livraison (déjà compté sur la commande d'origine).
export default function AjoutPage() {
  const router = useRouter();
  const { mode, sortir } = useAjoutMode();
  const { detail, sousTotal, loading, retirer, retirerGroupe, setQuantite } = usePanierDetaille();
  const { vider: viderKitsPanier } = useKitsPanier();

  const [info, setInfo] = useState<CommandeAjoutInfo | null | undefined>(undefined);
  const [modePaiement, setModePaiement] = useState<ModePaiement>("wave");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mode) return;
    let annule = false;
    getCommandeModifiable(mode.commandeId, mode.jeton).then((r) => {
      if (annule) return;
      setInfo(r);
      if (r) setModePaiement(r.optionsPaiement.includes("wave") ? "wave" : "livraison");
    });
    return () => {
      annule = true;
    };
  }, [mode]);

  const { groupes, horsGroupe } = useMemo(() => regrouperParKit(detail), [detail]);

  const retirerKit = (groupe: GroupeKitPanier) => {
    retirerGroupe(groupe.id);
  };

  const handleConfirmer = async () => {
    if (!mode || !info) return;
    setSubmitting(true);
    setError(null);

    const lignesPourEnvoi = detail.map((d) => ({
      produitId: d.produit.id,
      varianteId: d.variante?.id ?? null,
      quantite: d.quantite,
      groupe: d.groupe,
    }));

    try {
      if (modePaiement === "wave") {
        const result = await demarrerAjoutWave(mode.commandeId, mode.jeton, lignesPourEnvoi, mode.reference);
        if (!result.ok) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
        if (result.waveLaunchUrl) {
          window.location.href = result.waveLaunchUrl;
          return;
        }
      } else {
        const result = await confirmerAjoutLivraison(
          mode.commandeId,
          mode.jeton,
          lignesPourEnvoi,
          mode.reference,
        );
        if (!result.ok) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
      }

      const jeton = mode.jeton;
      const commandeId = mode.commandeId;
      viderKitsPanier();
      sortir();
      router.push(`/suivi/${commandeId}?t=${jeton}`);
    } catch {
      setError("La connexion a été interrompue. Réessaie.");
      setSubmitting(false);
    }
  };

  if (!mode || info === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <h1 className="font-heading text-lg font-semibold text-ink">
          {mode ? "Cette commande ne peut plus être modifiée." : "Aucun ajout en cours."}
        </h1>
        <Link href="/" className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  if (info === undefined || loading) {
    return <p className="px-4 py-12 text-center text-sm text-ink/50">Chargement…</p>;
  }

  if (detail.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <ShoppingCart size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">Rien à ajouter pour l&apos;instant</h1>
        <p className="max-w-xs text-sm text-ink/60">
          Parcours le catalogue : tout ce que tu ajoutes ira dans la commande n°{info.numero}.
        </p>
        <Link href="/" className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  const waveAffiche = info.optionsPaiement.includes("wave");
  const livraisonAffiche = info.optionsPaiement.includes("livraison");

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-6 lg:mx-auto lg:w-full lg:max-w-5xl lg:flex-row lg:items-start lg:gap-8">
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">Ajout à la commande n°{info.numero}</h1>
          <p className="text-sm text-ink/60">Aucun frais de livraison : déjà compté sur cette commande.</p>
        </div>

        {groupes.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {groupes.map(({ groupe, lignes }) => (
              <PanierKitCard key={groupe.id} groupe={groupe} lignes={lignes} onRetirer={() => retirerKit(groupe)} />
            ))}
          </div>
        )}

        {horsGroupe.length > 0 && (
          <div className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated px-3">
            {horsGroupe.map((ligne) => (
              <PanierLine
                key={`${ligne.produit.id}-${ligne.variante?.id ?? "base"}`}
                ligne={ligne}
                onQuantiteChange={(q) => setQuantite(ligne.produit.id, ligne.variante?.id ?? null, q)}
                onRetirer={() => retirer(ligne.produit.id, ligne.variante?.id ?? null)}
              />
            ))}
          </div>
        )}

        {(waveAffiche || livraisonAffiche) && (
          <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3">
            <span className="text-xs font-medium text-ink/60">Paiement de l&apos;ajout</span>
            <div className="flex flex-col gap-2">
              {waveAffiche && (
                <button
                  type="button"
                  aria-pressed={modePaiement === "wave"}
                  onClick={() => setModePaiement("wave")}
                  className={`flex items-center gap-2 rounded-2xl border p-3 text-left transition-colors ${
                    modePaiement === "wave" ? "border-brand bg-brand/5" : "border-ink/10 bg-surface"
                  }`}
                >
                  <Image src="/images/logo-wave.jpg" alt="" width={32} height={20} className="rounded object-contain" />
                  <span className="text-sm font-semibold text-ink">Payer avec Wave</span>
                </button>
              )}
              {livraisonAffiche && (
                <button
                  type="button"
                  aria-pressed={modePaiement === "livraison"}
                  onClick={() => setModePaiement("livraison")}
                  className={`flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors ${
                    modePaiement === "livraison" ? "border-brand bg-brand/5" : "border-ink/10 bg-surface"
                  }`}
                >
                  <span className="text-sm font-semibold text-ink">Ajouter au montant dû à la livraison</span>
                  <span className="text-[11px] text-ink/45">
                    Pas de paiement en ligne : le livreur encaisse le tout à la remise.
                  </span>
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="sticky bottom-16 z-30 -mx-4 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:sticky lg:top-20 lg:mx-0 lg:w-80 lg:shrink-0 lg:rounded-2xl lg:border lg:bg-elevated lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/50">Total de l&apos;ajout</span>
            <span className="text-sm font-semibold text-ink">{formatPrice(sousTotal)}</span>
          </div>
          {error && <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink/80">{error}</p>}
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirmer}
            className="flex h-11 items-center justify-center rounded-full bg-action px-6 text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
          >
            {submitting
              ? modePaiement === "wave"
                ? "Redirection vers Wave…"
                : "Confirmation…"
              : "Confirmer l'ajout"}
          </button>
        </div>
      </div>
    </div>
  );
}
