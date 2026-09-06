"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { usePanierDetaille } from "@/lib/local/use-panier-detaille";
import { useIdentite } from "@/lib/local/identite";
import { useKitsPanier } from "@/lib/local/kits-panier";
import { getLieuxSpeciaux, getLocalites } from "@/lib/supabase/queries";
import { formatPrice } from "@/lib/format";
import {
  demarrerPaiementWave,
  getDernierePosition,
  getOptionsPaiement,
  passerCommande,
} from "@/lib/checkout/actions";
import { SEUIL_PAIEMENT_AVANCE } from "@/lib/checkout/montants";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";
import { LocalitePicker, type SelectionLocalite } from "@/components/checkout/localite-picker";
import {
  useAllowNextNavigation,
  useUnsavedChanges,
} from "@/components/ui/navigation-guard";
import type { Localite, LieuSpecial, ModeLivraison, ModePaiement } from "@/lib/supabase/types";

// crypto.randomUUID() exige un contexte sécurisé (HTTPS/localhost) : absent
// en HTTP simple sur une IP réseau (cas de test courant sur mobile), ce qui
// faisait planter toute la page au montage. Simple clé d'idempotence anti
// double-clic, pas un besoin cryptographique -> repli Math.random() valide.
function genererReference(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // contexte non sécurisé : on tombe sur le repli ci-dessous
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { detail, sousTotal, loading: loadingPanier, vider } = usePanierDetaille();
  const { identite, setIdentite } = useIdentite();
  const { lignes: kitsPanier, vider: viderKitsPanier } = useKitsPanier();

  // Générée une seule fois par visite du checkout (pas à chaque re-render) :
  // permet au serveur de reconnaître un clic double ou une requête retentée
  // et de renvoyer la même commande au lieu d'en créer une deuxième.
  const [reference] = useState(genererReference);
  const [localites, setLocalites] = useState<Localite[]>([]);
  const [lieuxSpeciaux, setLieuxSpeciaux] = useState<LieuSpecial[]>([]);
  const [selectionLocalite, setSelectionLocalite] = useState<SelectionLocalite | null>(null);
  // Pré-remplis depuis l'identité mémorisée (onboarding / commande passée) tant
  // que l'utilisateur n'a rien saisi ; sa frappe (même vide) prend le dessus.
  const [nomSaisi, setNomSaisi] = useState<string | null>(null);
  const [telephoneSaisi, setTelephoneSaisi] = useState<string | null>(null);
  const nom = nomSaisi ?? identite?.nom ?? "";
  const telephone = telephoneSaisi ?? identite?.telephone ?? "";
  const [modeLivraison, setModeLivraison] = useState<ModeLivraison>("6j");
  const [modePaiement, setModePaiement] = useState<ModePaiement>("livraison");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Numéro déjà associé à un autre nom en base (GROUPE_B §1) : on informe sans
  // bloquer, puis on enchaîne — voir trouverOuCreerClient (lib/checkout/actions.ts).
  const [noticeNom, setNoticeNom] = useState<string | null>(null);

  const [position, setPosition] = useState<Coordonnees | null>(null);
  const [precisionLivreur, setPrecisionLivreur] = useState("");

  // Le checkout contient un travail non enregistré dès que l'utilisateur a
  // saisi/choisi quelque chose (CONFIRMATION_RETOUR.md). Repasse à false à la
  // soumission réussie.
  const [modifie, setModifie] = useState(false);
  useUnsavedChanges(modifie);
  const autoriserProchaineNavigation = useAllowNextNavigation();

  useEffect(() => {
    getLocalites().then(setLocalites);
    getLieuxSpeciaux().then(setLieuxSpeciaux);
  }, []);

  // Pré-remplissage : dernière position validée par ce numéro de client.
  // Nécessite le jeton de l'identité mémorisée (et donc que le numéro affiché
  // soit bien celui de cette identité).
  const prefillFait = useRef(false);
  useEffect(() => {
    const numero = telephone.trim();
    const jeton = identite?.jeton;
    if (prefillFait.current || !numero || !jeton || numero !== identite?.telephone) return;
    prefillFait.current = true;
    getDernierePosition(numero, jeton).then((pos) => {
      if (!pos) return;
      setPosition({ lat: pos.lat, lng: pos.lng });
      setPrecisionLivreur((actuel) => actuel || pos.precisionLivreur || "");
    });
  }, [telephone, identite]);

  // Libellé de la localité actuellement saisie/choisie (déterminant côté
  // serveur pour le tarif, jamais fait confiance côté client) — vide tant que
  // rien n'a été tapé.
  const localiteTexteCourant =
    selectionLocalite?.type === "libre" ? selectionLocalite.texte.trim() : (selectionLocalite?.nom ?? "");
  const localiteKey = selectionLocalite
    ? selectionLocalite.type === "libre"
      ? `libre:${localiteTexteCourant}`
      : `${selectionLocalite.type}:${selectionLocalite.id}`
    : "";

  // Règle du seuil ET tarif de livraison recalculés côté serveur (INTEGRATION_WAVE.md,
  // W2 + IMPLEMENTATION_TARIFS_LIVRAISON.md §6). Signature stable du panier +
  // localité pour ne relancer l'appel que sur un vrai changement, et pour
  // ignorer une réponse qui ne correspond plus à la sélection courante.
  const [reponseServeur, setReponseServeur] = useState<{
    sig: string;
    options: ModePaiement[];
    waveImpose: boolean;
    total: number;
    fraisLivraison: number;
    fraisLivraison24h: number;
    fraisLivraison6j: number;
    localiteNom: string;
    aConfirmer: boolean;
  } | null>(null);
  const panierSignature = detail
    .map((d) => `${d.produit.id}:${d.variante?.id ?? 0}x${d.quantite}`)
    .join(",");
  const sig = `${panierSignature}|${localiteKey}|${modeLivraison}`;

  useEffect(() => {
    if (!localiteTexteCourant || detail.length === 0) return;
    let annule = false;
    getOptionsPaiement(
      detail.map((d) => ({
        produitId: d.produit.id,
        varianteId: d.variante?.id ?? null,
        quantite: d.quantite,
      })),
      {
        modeLivraison,
        localiteId: selectionLocalite?.type === "localite" ? selectionLocalite.id : null,
        lieuSpecialId: selectionLocalite?.type === "special" ? selectionLocalite.id : null,
        localiteTexte: localiteTexteCourant,
      },
    ).then((r) => {
      if (annule || !r.ok) return;
      setReponseServeur({
        sig,
        options: r.options,
        waveImpose: r.waveImpose,
        total: r.total,
        fraisLivraison: r.fraisLivraison,
        fraisLivraison24h: r.fraisLivraison24h,
        fraisLivraison6j: r.fraisLivraison6j,
        localiteNom: r.localiteNom,
        aConfirmer: r.aConfirmer,
      });
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panierSignature, localiteKey, modeLivraison]);

  // Le serveur fait autorité sur les modes de paiement proposés (règle du seuil,
  // Wave branché ou non) et sur le tarif. Tant qu'il n'a pas répondu : « à la
  // livraison » seul (défaut sûr, pas de carte Wave qui clignote puis disparaît).
  const opts = reponseServeur?.sig === sig ? reponseServeur : null;
  const waveAffiche = opts?.options.includes("wave") ?? false;
  const livraisonAffiche = opts?.options.includes("livraison") ?? true;
  const waveImpose = opts?.waveImpose ?? false;
  const modePaiementEffectif: ModePaiement = waveImpose ? "wave" : modePaiement;
  const fraisLivraison = opts?.fraisLivraison ?? 0;
  const total = opts?.total ?? sousTotal;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!localiteTexteCourant) {
      setError("Indique ta localité de livraison.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const lignesPourEnvoi = detail.map((d) => ({
      produitId: d.produit.id,
      varianteId: d.variante?.id ?? null,
      quantite: d.quantite,
    }));
    const commandeInput = {
      nom,
      telephone,
      localiteId: selectionLocalite?.type === "localite" ? selectionLocalite.id : null,
      lieuSpecialId: selectionLocalite?.type === "special" ? selectionLocalite.id : null,
      localiteTexte: localiteTexteCourant,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      precisionLivreur: precisionLivreur.trim() || null,
      modeLivraison,
      reference,
      ebookClasses: kitsPanier.map((k) => ({ cycle: k.cycle, niveau: k.niveau })),
    };

    try {
      if (modePaiementEffectif === "wave") {
        // Paiement Wave : on ne vide PAS le panier ici (paiement non confirmé) ;
        // il sera vidé au retour dans l'app (page confirmation).
        const result = await demarrerPaiementWave(lignesPourEnvoi, commandeInput);
        if (!result.ok) {
          setError(result.error);
          setSubmitting(false);
          return;
        }
        setIdentite({ nom: result.nomEnregistre ?? nom, telephone, jeton: result.jeton });
        setModifie(false);
        autoriserProchaineNavigation();
        if (result.nomEnregistre) {
          setNoticeNom(result.nomEnregistre);
          await new Promise((resolve) => setTimeout(resolve, 1700));
        }
        window.location.href = result.waveLaunchUrl;
        return;
      }

      const result = await passerCommande(lignesPourEnvoi, commandeInput);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      setIdentite({ nom: result.nomEnregistre ?? nom, telephone, jeton: result.jeton });
      setModifie(false);
      vider();
      viderKitsPanier();
      if (result.nomEnregistre) {
        setNoticeNom(result.nomEnregistre);
        await new Promise((resolve) => setTimeout(resolve, 1700));
      }
      router.push(`/suivi/${result.commandeId}?t=${result.jeton}`);
    } catch {
      // Coupure réseau / erreur inattendue : ne jamais laisser le bouton
      // bloqué sur "Confirmation…" sans retour visible pour le client.
      setError("La connexion a été interrompue. Réessaie.");
      setSubmitting(false);
    }
  };

  if (!loadingPanier && detail.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-ink/50">Ton panier est vide.</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-in-up flex flex-1 flex-col gap-6 px-4 pb-[env(safe-area-inset-bottom)] pt-4"
    >
      {noticeNom && (
        <div
          role="status"
          className="fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-2xl border border-brand/20 bg-elevated px-4 py-3 text-sm text-ink shadow-lg"
        >
          Ce numéro est déjà associé au nom « {noticeNom} » : ta commande est enregistrée sous ce
          nom. Pour le changer, va dans Paramètres.
        </div>
      )}

      <h1 className="font-heading text-xl font-bold text-ink">Livraison</h1>

      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Nom complet</span>
          <input
            required
            value={nom}
            onChange={(event) => {
              setNomSaisi(event.target.value);
              setModifie(true);
            }}
            className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Téléphone (WhatsApp)</span>
          <input
            required
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(event) => {
              setTelephoneSaisi(event.target.value);
              setModifie(true);
            }}
            placeholder="77 123 45 67"
            className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-ink/60">Ta localité</span>
          <LocalitePicker
            localites={localites}
            lieuxSpeciaux={lieuxSpeciaux}
            value={selectionLocalite}
            onChange={(v) => {
              setSelectionLocalite(v);
              setModifie(true);
            }}
          />
          {opts && (
            <p className="rounded-xl bg-brand/5 px-3 py-2 text-xs text-ink/75">
              Livraison vers <span className="font-semibold text-ink">{opts.localiteNom}</span>
              {" — "}
              <span className="font-semibold text-ink">
                {opts.aConfirmer
                  ? "tarif à confirmer"
                  : opts.fraisLivraison === 0
                    ? "livraison gratuite"
                    : formatPrice(opts.fraisLivraison)}
              </span>
              {opts.aConfirmer && " . On te contactera pour convenir du tarif après ta commande."}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-ink/60">
            Précise l’emplacement sur la carte <span className="text-ink/40">(facultatif)</span>
          </span>
          <CartePin
            position={position}
            onChange={(c) => {
              setPosition(c);
              setModifie(true);
            }}
          />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">
            Précision pour le livreur <span className="text-ink/40">(facultatif)</span>
          </span>
          <textarea
            rows={2}
            maxLength={300}
            value={precisionLivreur}
            onChange={(event) => {
              setPrecisionLivreur(event.target.value);
              setModifie(true);
            }}
            placeholder="Portail bleu, 2e étage, appeler en arrivant…"
            className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink/60">Mode de livraison</span>
        <div className="grid grid-cols-2 gap-3">
          {(["24h", "6j"] as const).map((mode) => {
            const active = modeLivraison === mode;
            const prix = !opts
              ? null
              : opts.aConfirmer
                ? null
                : mode === "24h"
                  ? opts.fraisLivraison24h
                  : opts.fraisLivraison6j;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setModeLivraison(mode);
                  setModifie(true);
                }}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-colors ${
                  active ? "border-brand bg-brand/5" : "border-ink/10 bg-elevated"
                }`}
              >
                <span className="text-sm font-semibold text-ink">
                  {mode === "24h" ? "Livraison 24h" : "Livraison 6 jours"}
                </span>
                <span className="text-xs text-ink/50">
                  {prix === null ? "—" : prix === 0 ? "Gratuite" : formatPrice(prix)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3">
        <span className="text-xs font-medium text-ink/60">Paiement</span>

        {waveImpose ? (
          <p className="rounded-xl bg-brand/5 px-3 py-2 text-xs text-ink/75">
            Au-dessus de{" "}
            <span className="font-semibold text-ink">{formatPrice(SEUIL_PAIEMENT_AVANCE)}</span>, le
            paiement se règle <span className="font-semibold text-ink">d’avance par Wave</span>.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {livraisonAffiche && !waveImpose && (
            <button
              type="button"
              aria-pressed={modePaiementEffectif === "livraison"}
              onClick={() => {
                setModePaiement("livraison");
                setModifie(true);
              }}
              className={`flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors ${
                modePaiementEffectif === "livraison" ? "border-brand bg-brand/5" : "border-ink/10 bg-surface"
              }`}
            >
              <span className="text-sm font-semibold text-ink">À la livraison</span>
              <span className="flex items-center gap-2 text-[11px] text-ink/45">
                <Image
                  src="/images/logo-wave.jpg"
                  alt="Wave"
                  width={32}
                  height={20}
                  className="rounded object-contain"
                />
                <Image
                  src="/images/logo-om.jpg"
                  alt="Orange Money"
                  width={32}
                  height={20}
                  className="rounded object-contain"
                />
                Espèces, Wave ou Orange Money à la remise
              </span>
            </button>
          )}

          {waveAffiche && (
            <button
              type="button"
              aria-pressed={modePaiementEffectif === "wave"}
              onClick={() => {
                setModePaiement("wave");
                setModifie(true);
              }}
              className={`flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors ${
                modePaiementEffectif === "wave" ? "border-brand bg-brand/5" : "border-ink/10 bg-surface"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Image
                  src="/images/logo-wave.jpg"
                  alt=""
                  width={32}
                  height={20}
                  className="rounded object-contain"
                />
                Payer d’avance avec Wave
              </span>
              <span className="text-[11px] text-ink/45">
                Paiement sécurisé sur Wave, puis retour sur SacAdo.
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-elevated p-3 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Sous-total</span>
          <span>{formatPrice(sousTotal)}</span>
        </div>
        <div className="flex justify-between text-ink/70">
          <span>Livraison</span>
          <span>
            {opts?.aConfirmer
              ? "À confirmer"
              : fraisLivraison === 0
                ? "Gratuite"
                : formatPrice(fraisLivraison)}
          </span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </section>

      {error && <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink/80">{error}</p>}

      {/* Écran "tunnel" : pas de bottom nav ici (voir ROUTES_SANS_BOTTOM_NAV),
          le bouton reste collé tout en bas de l'écran. */}
      <div className="sticky bottom-0 z-40 mt-auto border-t border-ink/10 bg-surface/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <button
          type="submit"
          disabled={submitting || !localiteTexteCourant}
          className="mx-auto flex h-12 w-full max-w-6xl items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
        >
          {submitting
            ? modePaiementEffectif === "wave"
              ? "Redirection vers Wave…"
              : "Confirmation…"
            : modePaiementEffectif === "wave"
              ? "Payer avec Wave"
              : "Confirmer la commande"}
        </button>
      </div>
    </form>
  );
}
