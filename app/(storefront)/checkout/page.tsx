"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LocateFixed, MapPinned } from "lucide-react";
import { usePanierDetaille } from "@/lib/local/use-panier-detaille";
import { useIdentite } from "@/lib/local/identite";
import { getZones } from "@/lib/supabase/queries";
import { formatPrice } from "@/lib/format";
import { passerCommande } from "@/lib/checkout/actions";
import { SEUIL_GRATUITE } from "@/components/panier/free-shipping-progress";
import { RegionPicker } from "@/components/checkout/region-picker";
import type { ModeLivraison, Zone } from "@/lib/supabase/types";

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
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [adresse, setAdresse] = useState("");
  const [modeLivraison, setModeLivraison] = useState<ModeLivraison>("5j");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [errorZones, setErrorZones] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [lienMapsManuel, setLienMapsManuel] = useState("");
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [erreurLocalisation, setErreurLocalisation] = useState<string | null>(null);

  const localiser = () => {
    if (!navigator.geolocation) {
      setErreurLocalisation("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocalisationEnCours(true);
    setErreurLocalisation(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocalisationEnCours(false);
      },
      () => {
        setErreurLocalisation("Impossible d'obtenir ta position. Vérifie l'autorisation de localisation.");
        setLocalisationEnCours(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    getZones()
      .then((data) => {
        setZones(data);
        setZoneId((current) => current ?? data[0]?.id ?? null);
      })
      .catch(() => setErrorZones(true));
  }, []);

  const zoneSelectionnee = zones.find((z) => z.id === zoneId) ?? null;
  const livraisonGratuite = sousTotal >= SEUIL_GRATUITE;
  const fraisLivraison = !zoneSelectionnee
    ? 0
    : livraisonGratuite
      ? 0
      : modeLivraison === "24h"
        ? zoneSelectionnee.tarif_24h
        : zoneSelectionnee.tarif_5j;
  const total = sousTotal + fraisLivraison;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!zoneId) {
      setError("Choisis une zone de livraison.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const lignesPourEnvoi = detail.map((d) => ({
      produitId: d.produit.id,
      varianteId: d.variante?.id ?? null,
      quantite: d.quantite,
    }));

    const lienPosition =
      lienMapsManuel.trim() || (position ? `https://www.google.com/maps?q=${position.lat},${position.lng}` : "");
    const adresseAvecPosition = lienPosition ? `${adresse}\nPosition : ${lienPosition}` : adresse;

    try {
      const result = await passerCommande(lignesPourEnvoi, {
        nom,
        telephone,
        zoneId,
        adresse: adresseAvecPosition,
        modeLivraison,
        reference,
      });

      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      setIdentite({ nom, telephone });
      vider();
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
            onChange={(event) => setNomSaisi(event.target.value)}
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
            onChange={(event) => setTelephoneSaisi(event.target.value)}
            placeholder="77 123 45 67"
            className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Région de livraison</span>
          <RegionPicker zones={zones} zoneId={zoneId} onChange={setZoneId} />
          {errorZones && (
            <span className="text-xs text-ink/60">
              Impossible de charger les zones de livraison. Vérifie ta connexion et recharge la page.
            </span>
          )}
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <label className="flex flex-col gap-1" htmlFor="adresse">
            <span className="text-xs font-medium text-ink/60">Adresse / point de repère</span>
            <textarea
              id="adresse"
              required
              rows={2}
              value={adresse}
              onChange={(event) => setAdresse(event.target.value)}
              className="rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={localiser}
              disabled={localisationEnCours}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 active:scale-95 disabled:opacity-50"
            >
              <LocateFixed size={14} aria-hidden="true" />
              {localisationEnCours
                ? "Localisation…"
                : position
                  ? "Position signalée ✓"
                  : "Utiliser ma position actuelle"}
            </button>
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 active:scale-95"
            >
              <MapPinned size={14} aria-hidden="true" />
              Trouver sur Google Maps
            </a>
          </div>
          {erreurLocalisation && <span className="text-xs text-ink/60">{erreurLocalisation}</span>}

          <input
            aria-label="Lien Google Maps de ta position"
            value={lienMapsManuel}
            onChange={(event) => setLienMapsManuel(event.target.value)}
            placeholder="Colle ici le lien Google Maps de ta position (optionnel)"
            className="mt-1 rounded-xl border border-ink/15 bg-elevated px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink/60">Mode de livraison</span>
        <div className="grid grid-cols-2 gap-3">
          {(["24h", "5j"] as const).map((mode) => {
            const active = modeLivraison === mode;
            const prix = !zoneSelectionnee
              ? null
              : livraisonGratuite
                ? 0
                : mode === "24h"
                  ? zoneSelectionnee.tarif_24h
                  : zoneSelectionnee.tarif_5j;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setModeLivraison(mode)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-colors ${
                  active ? "border-brand bg-brand/5" : "border-ink/10 bg-elevated"
                }`}
              >
                <span className="text-sm font-semibold text-ink">
                  {mode === "24h" ? "Livraison 24h" : "Livraison 5 jours"}
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
        <p className="text-sm text-ink">Paiement à la livraison</p>
        <div className="flex items-center gap-3">
          <Image
            src="/images/logo-wave.jpg"
            alt="Wave"
            width={40}
            height={24}
            className="rounded object-contain"
          />
          <Image
            src="/images/logo-om.jpg"
            alt="Orange Money"
            width={40}
            height={24}
            className="rounded object-contain"
          />
          <span className="text-[11px] text-ink/40">Espèces, Wave ou Orange Money à la remise</span>
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
          disabled={submitting || !zoneId}
          className="flex h-12 w-full items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
        >
          {submitting ? "Confirmation…" : "Confirmer la commande"}
        </button>
      </div>
    </form>
  );
}
