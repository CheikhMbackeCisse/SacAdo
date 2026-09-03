"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { usePanierDetaille } from "@/lib/local/use-panier-detaille";
import { useIdentite } from "@/lib/local/identite";
import { useKitEnfants } from "@/lib/local/kit-enfants";
import { getZones } from "@/lib/supabase/queries";
import { formatPrice } from "@/lib/format";
import {
  demarrerPaiementWave,
  getDernierePosition,
  getOptionsPaiement,
  passerCommande,
} from "@/lib/checkout/actions";
import { SEUIL_GRATUITE } from "@/components/panier/free-shipping-progress";
import { SEUIL_PAIEMENT_AVANCE } from "@/lib/checkout/montants";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";
import {
  useAllowNextNavigation,
  useUnsavedChanges,
} from "@/components/ui/navigation-guard";
import { regionLaPlusProche } from "@/lib/senegal-regions";
import type { ModeLivraison, ModePaiement, Zone } from "@/lib/supabase/types";

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
  const { lignes: enfantsEbook, vider: viderEnfantsEbook } = useKitEnfants();

  // Générée une seule fois par visite du checkout (pas à chaque re-render) :
  // permet au serveur de reconnaître un clic double ou une requête retentée
  // et de renvoyer la même commande au lieu d'en créer une deuxième.
  const [reference] = useState(genererReference);
  const [zones, setZones] = useState<Zone[]>([]);
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

  const [position, setPosition] = useState<Coordonnees | null>(null);
  const [precisionLivreur, setPrecisionLivreur] = useState("");

  // Le checkout contient un travail non enregistré dès que l'utilisateur a
  // saisi/choisi quelque chose (CONFIRMATION_RETOUR.md). Repasse à false à la
  // soumission réussie.
  const [modifie, setModifie] = useState(false);
  useUnsavedChanges(modifie);
  const autoriserProchaineNavigation = useAllowNextNavigation();

  useEffect(() => {
    getZones()
      .then((data) => setZones(data))
      .catch(() => setZones([]));
  }, []);

  // Pré-remplissage : dernière position validée par ce numéro de client.
  const prefillFait = useRef(false);
  useEffect(() => {
    const numero = telephone.trim();
    if (prefillFait.current || !numero) return;
    prefillFait.current = true;
    getDernierePosition(numero).then((pos) => {
      if (!pos) return;
      setPosition({ lat: pos.lat, lng: pos.lng });
      setPrecisionLivreur((actuel) => actuel || pos.precisionLivreur || "");
    });
  }, [telephone]);

  // La région (donc le tarif) est déduite de l'épingle — le client ne la choisit
  // plus. Le serveur refait la déduction de son côté (jamais confiance au client).
  const regionDeduite = position ? regionLaPlusProche(position.lat, position.lng) : null;
  const zoneSelectionnee = regionDeduite
    ? (zones.find((z) => z.nom === regionDeduite) ?? null)
    : null;
  const livraisonGratuite = sousTotal >= SEUIL_GRATUITE;
  const fraisLivraison = !zoneSelectionnee
    ? 0
    : livraisonGratuite
      ? 0
      : modeLivraison === "24h"
        ? zoneSelectionnee.tarif_24h
        : zoneSelectionnee.tarif_6j;
  const total = sousTotal + fraisLivraison;

  // Règle du seuil recalculée côté serveur (INTEGRATION_WAVE.md, W2) : c'est
  // elle qui fait autorité sur les modes de paiement proposés. Signature stable
  // du panier pour ne relancer l'appel que sur un vrai changement, et pour
  // ignorer une réponse qui ne correspond plus au panier courant.
  const [seuilServeur, setSeuilServeur] = useState<{
    sig: string;
    options: ModePaiement[];
    waveImpose: boolean;
  } | null>(null);
  const panierSignature = detail
    .map((d) => `${d.produit.id}:${d.variante?.id ?? 0}x${d.quantite}`)
    .join(",");

  useEffect(() => {
    if (!position || detail.length === 0) return;
    let annule = false;
    getOptionsPaiement(
      detail.map((d) => ({
        produitId: d.produit.id,
        varianteId: d.variante?.id ?? null,
        quantite: d.quantite,
      })),
      { lat: position.lat, lng: position.lng, modeLivraison },
    ).then((r) => {
      if (annule || !r.ok) return;
      setSeuilServeur({ sig: panierSignature, options: r.options, waveImpose: r.waveImpose });
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panierSignature, position?.lat, position?.lng, modeLivraison]);

  // Le serveur fait autorité sur les modes de paiement proposés (règle du seuil,
  // Wave branché ou non). Tant qu'il n'a pas répondu : « à la livraison » seul
  // (défaut sûr, pas de carte Wave qui clignote puis disparaît).
  const opts = seuilServeur?.sig === panierSignature ? seuilServeur : null;
  const waveAffiche = opts?.options.includes("wave") ?? false;
  const livraisonAffiche = opts?.options.includes("livraison") ?? true;
  const waveImpose = opts?.waveImpose ?? false;
  const modePaiementEffectif: ModePaiement = waveImpose ? "wave" : modePaiement;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!position) {
      setError("Confirme le lieu de livraison sur la carte.");
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
      lat: position.lat,
      lng: position.lng,
      precisionLivreur: precisionLivreur.trim() || null,
      modeLivraison,
      reference,
      enfantsEbook: enfantsEbook.map((e) => ({ kit: e.kit, prenom: e.prenom })),
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
        setIdentite({ nom, telephone });
        setModifie(false);
        autoriserProchaineNavigation();
        window.location.href = result.waveLaunchUrl;
        return;
      }

      const result = await passerCommande(lignesPourEnvoi, commandeInput);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      setIdentite({ nom, telephone });
      setModifie(false);
      vider();
      viderEnfantsEbook();
      router.push(`/suivi/${result.commandeId}`);
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
    <form onSubmit={handleSubmit} className="animate-fade-in-up flex flex-col gap-6 px-4 py-4 pb-28">
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
          <span className="text-xs font-medium text-ink/60">Où livrer ?</span>
          <CartePin
            position={position}
            onChange={(c) => {
              setPosition(c);
              setModifie(true);
            }}
          />
          {regionDeduite && (
            <p className="rounded-xl bg-brand/5 px-3 py-2 text-xs text-ink/75">
              Livraison vers <span className="font-semibold text-ink">{regionDeduite}</span>
              {zoneSelectionnee ? (
                <>
                  {" — "}
                  <span className="font-semibold text-ink">
                    {livraisonGratuite || fraisLivraison === 0
                      ? "livraison gratuite"
                      : formatPrice(fraisLivraison)}
                  </span>
                </>
              ) : null}
              . Si ce n’est pas la bonne zone, déplace l’épingle.
            </p>
          )}
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
            const prix = !zoneSelectionnee
              ? null
              : livraisonGratuite
                ? 0
                : mode === "24h"
                  ? zoneSelectionnee.tarif_24h
                  : zoneSelectionnee.tarif_6j;
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

      {enfantsEbook.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-decorative/30 bg-decorative/10 p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink/70">
            <BookOpen size={14} aria-hidden="true" />
            Personnalisation de l&apos;ebook
          </span>
          <ul className="flex flex-col gap-0.5 text-sm text-ink/80">
            {enfantsEbook.map((e) => (
              <li key={e.id}>
                <span className="font-medium text-ink">{e.prenom}</span>
                <span className="text-ink/50"> — {e.kit}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          <span>{fraisLivraison === 0 ? "Gratuite" : formatPrice(fraisLivraison)}</span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </section>

      {error && <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink/80">{error}</p>}

      <div className="sticky bottom-16 z-30 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:bottom-0">
        <button
          type="submit"
          disabled={submitting || !position}
          className="flex h-12 w-full items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
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
