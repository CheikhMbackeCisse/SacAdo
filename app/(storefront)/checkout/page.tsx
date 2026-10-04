"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Truck } from "lucide-react";
import { usePanierDetaille } from "@/lib/local/use-panier-detaille";
import { useIdentite } from "@/lib/local/identite";
import { marquerCommandeFraiche } from "@/lib/local/push-invite";
import { useKitsPanier } from "@/lib/local/kits-panier";
import { getLieuxSpeciaux, getLocalites } from "@/lib/supabase/queries";
import { formatDateLivraison, formatPrice } from "@/lib/format";
import {
  demarrerPaiementWave,
  getDernierePosition,
  getLivraisonDefaut,
  getOptionsPaiement,
  passerCommande,
} from "@/lib/checkout/actions";
import { MENTION_BENEFICIAIRE_WAVE } from "@/lib/legal";
import { LocalitePicker, type SelectionLocalite } from "@/components/checkout/localite-picker";
import { LocalisationInput, type ValeurLocalisation } from "@/components/checkout/localisation-input";
import { lienGoogleMapsDepuisCoordonnees } from "@/lib/checkout/localisation";
import { useAjoutMode } from "@/lib/local/ajout-mode";
import { mesurerVisite } from "@/lib/trafic/mesure-client";
import { getCommandeModifiableParTelephone } from "@/lib/ajout/actions";
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
  // Mode ajout (PROMPT_CLIENT_V2 Lot 4) : /checkout créerait une 2e commande
  // (et une 2e livraison facturée) — la page dédiée est /ajout.
  const { mode: modeAjout, entrer: entrerModeAjout } = useAjoutMode();

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
  // Wave sélectionné par défaut (PROMPT_CLIENT_V2 Lot 1) : paiement en ligne
  // en premier, avant le paiement à la livraison.
  const [modePaiement, setModePaiement] = useState<ModePaiement>("wave");
  // Case à cocher obligatoire pour un paiement à la livraison (on appelle le
  // client avant l'envoi) : jamais fait confiance côté serveur, revérifiée
  // dans passerCommande.
  const [consentementAppel, setConsentementAppel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Numéro déjà associé à un autre nom en base (GROUPE_B §1) : on informe sans
  // bloquer, puis on enchaîne — voir trouverOuCreerClient (lib/checkout/actions.ts).
  const [noticeNom, setNoticeNom] = useState<string | null>(null);

  // Relance proactive (PROMPT_CLIENT_V2 Lot 4) : ce numéro a déjà une commande
  // modifiable en cours. Suggestion rejetable, jamais un blocage — l'utilisateur
  // peut très bien vouloir une commande séparée (adresse différente, etc.).
  const [suggestionAjout, setSuggestionAjout] = useState<{ commandeId: number; jeton: string } | null>(null);
  const [suggestionRejetee, setSuggestionRejetee] = useState(false);

  // Obligatoire (PROMPT_CLIENT_V2 Lot 2) : remplace le champ libre "Comment
  // trouver ta porte" — position GPS ou lien Google Maps collé.
  const [localisation, setLocalisation] = useState<ValeurLocalisation>({ lat: null, lng: null, lien: null });

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

  // Étape "début de commande" du parcours d'achat (PROMPT_ADMIN_V2 Lot 3) :
  // une fois par arrivée sur la page, pas à chaque re-render.
  useEffect(() => {
    mesurerVisite({ type: "debut_commande" });
  }, []);

  // Déjà en mode ajout : /checkout créerait une 2e commande (et une 2e
  // livraison facturée) à la place d'ajouter à celle en cours.
  useEffect(() => {
    if (modeAjout) router.replace("/ajout");
  }, [modeAjout, router]);

  // Relance proactive (PROMPT_CLIENT_V2 Lot 4) : dès que le numéro saisi
  // correspond à une commande modifiable, propose d'y ajouter plutôt que de
  // repasser une commande. Débouncée, jamais bloquante. `suggestionRejetee`
  // filtre à l'affichage (voir plus bas) plutôt que d'être revérifiée ici :
  // la dernière trouvaille reste en mémoire, pas la peine de la redemander
  // si l'utilisateur change d'avis après un "Non, nouvelle commande".
  useEffect(() => {
    const numero = telephone.trim();
    if (!numero || modeAjout) return;
    let annule = false;
    const minuteur = setTimeout(() => {
      getCommandeModifiableParTelephone(numero).then((r) => {
        if (!annule) setSuggestionAjout(r);
      });
    }, 500);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [telephone, modeAjout]);

  const suggestionAffichee = suggestionRejetee ? null : suggestionAjout;

  const accepterSuggestionAjout = () => {
    if (!suggestionAffichee) return;
    // true : le panier déjà rempli sur CE checkout part avec l'ajout, pas
    // perdu en route.
    entrerModeAjout(suggestionAffichee.commandeId, suggestionAffichee.jeton, true);
    autoriserProchaineNavigation();
    router.push("/ajout");
  };

  // Pré-remplissage : dernière position GPS validée par ce numéro de client
  // (même lieu de livraison d'une commande à l'autre). Nécessite le jeton de
  // l'identité mémorisée (et donc que le numéro affiché soit bien celui de
  // cette identité).
  const prefillFait = useRef(false);
  useEffect(() => {
    const numero = telephone.trim();
    const jeton = identite?.jeton;
    if (prefillFait.current || !numero || !jeton || numero !== identite?.telephone) return;
    prefillFait.current = true;
    getDernierePosition(numero, jeton).then((pos) => {
      if (!pos) return;
      setLocalisation((actuel) =>
        actuel.lien
          ? actuel
          : { lat: pos.lat, lng: pos.lng, lien: lienGoogleMapsDepuisCoordonnees(pos.lat, pos.lng) },
      );
    });
    // Localité choisie dans Préférences (§C.6) : appliquée seulement si rien
    // n'est déjà sélectionné (une saisie de l'utilisateur reste prioritaire).
    getLivraisonDefaut(numero, jeton).then((defaut) => {
      if (!defaut) return;
      setSelectionLocalite((actuel) => {
        if (actuel) return actuel;
        if (defaut.localite) return { type: "localite", id: defaut.localite.id, nom: defaut.localite.nom };
        if (defaut.lieuSpecial) return { type: "special", id: defaut.lieuSpecial.id, nom: defaut.lieuSpecial.nom };
        return actuel;
      });
    });
  }, [telephone, identite]);

  // Libellé de la localité actuellement saisie/choisie (déterminant côté
  // serveur pour le tarif, jamais fait confiance côté client) — vide tant que
  // rien n'a été tapé.
  const localiteTexteCourant = selectionLocalite?.nom ?? "";
  const localiteKey = selectionLocalite
    ? `${selectionLocalite.type}:${selectionLocalite.id}`
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
    messageLivraison: string | null;
    dateLivraisonPrevue: string;
    waveNomMarchand: string | null;
    paiementLivraisonMax: number | null;
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
        messageLivraison: r.messageLivraison,
        dateLivraisonPrevue: r.dateLivraisonPrevue,
        waveNomMarchand: r.waveNomMarchand,
        paiementLivraisonMax: r.paiementLivraisonMax,
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
  // Avant la réponse du serveur, le Wave sélectionné par défaut n'a pas encore
  // de bouton affiché (waveAffiche=false) : on retombe sur "à la livraison"
  // plutôt que de montrer un état Wave sans bouton Wave visible.
  const modePaiementEffectif: ModePaiement = waveImpose ? "wave" : waveAffiche ? modePaiement : "livraison";
  const fraisLivraison = opts?.fraisLivraison ?? 0;
  const total = opts?.total ?? sousTotal;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectionLocalite) {
      setError("Choisis ta localité dans la liste.");
      return;
    }
    if (!localisation.lien) {
      setError("Indique ta position de livraison (position actuelle ou lien Google Maps).");
      return;
    }
    if (modePaiementEffectif === "livraison" && !consentementAppel) {
      setError("Coche la case pour confirmer que tu seras joignable.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const lignesPourEnvoi = detail.map((d) => ({
      produitId: d.produit.id,
      varianteId: d.variante?.id ?? null,
      quantite: d.quantite,
      groupe: d.groupe,
    }));
    const commandeInput = {
      nom,
      telephone,
      localiteId: selectionLocalite?.type === "localite" ? selectionLocalite.id : null,
      lieuSpecialId: selectionLocalite?.type === "special" ? selectionLocalite.id : null,
      localiteTexte: localiteTexteCourant,
      lat: localisation.lat,
      lng: localisation.lng,
      lienLocalisation: localisation.lien,
      modeLivraison,
      consentementAppel,
      reference,
      ebookClasses: kitsPanier.map((k) => ({ cycle: k.cycle, niveau: k.niveau })),
      // Produits de kit -> bénéficiaire choisi au sélecteur (attribution du
      // signal « commande » au bon enfant). Validé côté serveur.
      attributions: kitsPanier.flatMap((k) =>
        k.beneficiaireId
          ? (k.produitIds ?? []).map((produitId) => ({
              produitId,
              beneficiaireId: k.beneficiaireId as number,
            }))
          : [],
      ),
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
        marquerCommandeFraiche(result.commandeId);
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
      marquerCommandeFraiche(result.commandeId);
      router.push(`/suivi/${result.commandeId}?t=${result.jeton}`);
    } catch {
      // Coupure réseau / erreur inattendue : ne jamais laisser le bouton
      // bloqué sur "Confirmation…" sans retour visible pour le client.
      setError("La connexion a été interrompue. Réessaie.");
      setSubmitting(false);
    }
  };

  if (modeAjout) return null;

  if (!loadingPanier && detail.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-ink/50">Ton panier est vide.</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-in-up flex flex-1 flex-col gap-6 px-4 pb-[env(safe-area-inset-bottom)] pt-4 lg:mx-auto lg:w-full lg:max-w-5xl lg:flex-row lg:items-start lg:gap-8"
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

      <div className="flex flex-1 flex-col gap-6">
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

        {suggestionAffichee && (
          <div className="flex flex-col gap-2 rounded-2xl border border-brand/25 bg-brand/5 p-3 text-sm">
            <p className="text-ink/80">
              Ajouter à votre commande en cours n°{suggestionAffichee.commandeId} et économiser la
              livraison ?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={accepterSuggestionAjout}
                className="flex h-9 flex-1 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand"
              >
                Oui, ajouter
              </button>
              <button
                type="button"
                onClick={() => setSuggestionRejetee(true)}
                className="flex h-9 flex-1 items-center justify-center rounded-full border border-ink/15 text-xs font-medium text-ink/70"
              >
                Non, nouvelle commande
              </button>
            </div>
          </div>
        )}

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

        <LocalisationInput
          value={localisation}
          onChange={(v) => {
            setLocalisation(v);
            setModifie(true);
          }}
        />
      </section>

      {opts?.messageLivraison ? (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-brand/25 bg-brand/5 p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Truck size={15} className="text-brand" aria-hidden="true" />
            Livraison
          </span>
          <p className="text-sm text-ink/75">{opts.messageLivraison}</p>
        </section>
      ) : (
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
                  {mode === "24h"
                    ? "Livraison express (moins de 24h)"
                    : opts
                      ? `Livraison le ${formatDateLivraison(opts.dateLivraisonPrevue)}`
                      : "Livraison à une date donnée"}
                </span>
                <span className="text-xs text-ink/50">
                  {prix === null ? "—" : prix === 0 ? "Gratuite" : formatPrice(prix)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3">
        <span className="text-xs font-medium text-ink/60">Paiement</span>

        {waveImpose && opts?.paiementLivraisonMax != null ? (
          <p className="rounded-xl bg-brand/5 px-3 py-2 text-xs text-ink/75">
            Au-dessus de{" "}
            <span className="font-semibold text-ink">{formatPrice(opts.paiementLivraisonMax)}</span>, le
            paiement se règle <span className="font-semibold text-ink">d’avance par Wave</span>.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {/* Wave en premier, sélectionné par défaut (PROMPT_CLIENT_V2 Lot 1). */}
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
                Payer avec Wave
              </span>
              <span className="text-[11px] text-ink/45">
                Paiement sécurisé, votre commande part plus vite.
              </span>
            </button>
          )}

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
        </div>

        {modePaiementEffectif === "livraison" && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-ink/5 p-3">
            <p className="text-xs text-ink/70">
              Nous vous appellerons sur votre numéro WhatsApp pour confirmer la commande avant
              l&apos;envoi. Sans réponse, la commande ne sera pas expédiée.
            </p>
            <label className="flex items-start gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={consentementAppel}
                onChange={(event) => {
                  setConsentementAppel(event.target.checked);
                  setModifie(true);
                }}
                className="mt-0.5 size-4 shrink-0 accent-brand"
              />
              <span>
                J&apos;ai compris, je serai joignable au{" "}
                <span className="font-medium">{telephone || "ce numéro"}</span>
              </span>
            </label>
          </div>
        )}
      </section>
      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:w-80 lg:shrink-0">
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
        {modePaiementEffectif === "wave" && (
          <p className="mt-0.5 text-[11px] text-ink/50">{MENTION_BENEFICIAIRE_WAVE}</p>
        )}
      </section>

      {error && <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink/80">{error}</p>}

      {/* Écran "tunnel" : pas de bottom nav ici (voir ROUTES_SANS_BOTTOM_NAV),
          le bouton reste collé tout en bas de l'écran. */}
      <div className="sticky bottom-0 z-40 mt-auto border-t border-ink/10 bg-surface/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:static lg:mt-0 lg:rounded-2xl lg:border lg:border-ink/10 lg:bg-elevated lg:p-3 lg:pb-3 lg:backdrop-blur-none">
        <p className="mb-2 text-center text-[11px] text-ink/50">
          En confirmant, tu acceptes les{" "}
          <Link href="/cgv" className="font-medium text-brand">
            conditions générales de vente
          </Link>
          .
        </p>
        <button
          type="submit"
          disabled={
            submitting ||
            !selectionLocalite ||
            !localisation.lien ||
            (modePaiementEffectif === "livraison" && !consentementAppel)
          }
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
        {modePaiementEffectif === "wave" && opts?.waveNomMarchand && (
          <p className="mt-2 text-center text-[11px] text-ink/50">
            Votre paiement sera adressé à {opts.waveNomMarchand}, propriétaire de SacAdo.
          </p>
        )}
      </div>
      </div>
    </form>
  );
}
