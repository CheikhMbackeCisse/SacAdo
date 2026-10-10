"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, MessageCircle, Copy, Check } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { PastilleDemande } from "@/components/admin/pastille-demande";
import {
  previsualiserMessageFournisseur,
  validerEtEnvoyerFournisseur,
  obtenirLienBon,
  type GroupeFournisseur,
} from "@/lib/admin/achats-actions";
import type { StatutDemandePreparation } from "@/lib/supabase/types";

const PLACEHOLDER_REF = "(numéro attribué à l'envoi)";
const PLACEHOLDER_LIEN = "(lien généré à l'envoi)";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function LivraisonBadge({ modeLivraison, dateLivraisonPrevue }: { modeLivraison: string | null; dateLivraisonPrevue: string | null }) {
  if (modeLivraison === "24h") {
    return <span className="rounded bg-action/10 px-1.5 py-0.5 text-[10px] font-semibold text-action">Express</span>;
  }
  if (dateLivraisonPrevue) {
    return <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/60">{formatDate(dateLivraisonPrevue)}</span>;
  }
  return null;
}

function BoutonRenvoyer({ demandeId }: { demandeId: number }) {
  const [enCours, startTransition] = useTransition();
  const [lien, setLien] = useState<string | null>(null);

  const ouvrir = () => {
    startTransition(async () => {
      const l = await obtenirLienBon(demandeId);
      setLien(l);
      window.open(l, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <button
      type="button"
      onClick={ouvrir}
      disabled={enCours}
      className="text-[11px] font-medium text-brand underline disabled:opacity-50"
    >
      {lien ? "Rouvrir le bon" : "Renvoyer le lien"}
    </button>
  );
}

const STATUTS_EN_ATTENTE = ["a_confirmer_appel", "paiement_en_attente"];

export function FournisseurCarteAchat({ groupe }: { groupe: GroupeFournisseur }) {
  const commandesDisponibles = useMemo(() => {
    const map = new Map<
      number,
      {
        commandeId: number;
        clientNom: string;
        modeLivraison: string | null;
        dateLivraisonPrevue: string | null;
        enAttente: boolean;
        articles: GroupeFournisseur["articles"];
      }
    >();
    for (const a of groupe.articles) {
      let g = map.get(a.commandeId);
      if (!g) {
        g = {
          commandeId: a.commandeId,
          clientNom: a.clientNom,
          modeLivraison: a.modeLivraison,
          dateLivraisonPrevue: a.dateLivraisonPrevue,
          enAttente: STATUTS_EN_ATTENTE.includes(a.statutCommande),
          articles: [],
        };
        map.set(a.commandeId, g);
      }
      g.articles.push(a);
    }
    return [...map.values()];
  }, [groupe.articles]);

  // Les commandes pas encore confirmées (visibles seulement avec l'interrupteur
  // "Inclure les commandes en attente", lot 3) ne sont pas présélectionnées
  // pour l'envoi — elles sont encore susceptibles de changer.
  const [selection, setSelection] = useState<Set<number>>(
    new Set(commandesDisponibles.filter((c) => !c.enAttente).map((c) => c.commandeId)),
  );
  const [avecPrix, setAvecPrix] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);
  const [texteEdite, setTexteEdite] = useState("");
  const [resultat, setResultat] = useState<{ reference: string; lien: string; copie: boolean } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);

  const articlesSelectionnes = groupe.articles.filter((a) => selection.has(a.commandeId) && !a.demandeExistante);
  const toutesDejaEnvoyees = groupe.articles.every((a) => a.demandeExistante);

  const toggleCommande = (id: number) =>
    setSelection((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const preparer = () => {
    setErreur(null);
    startTransition(async () => {
      const texte = await previsualiserMessageFournisseur({
        vendeurNom: groupe.vendeurNom,
        articles: articlesSelectionnes,
        avecPrix,
      });
      setApercu(texte);
      setTexteEdite(texte);
      setResultat(null);
      setOuvert(true);
    });
  };

  const validerEtEnvoyer = () => {
    setErreur(null);
    startTransition(async () => {
      const res = await validerEtEnvoyerFournisseur(groupe.vendeurId, [...selection], groupe.vendeurTelephone);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      const messageFinal = (texteEdite || apercu || "")
        .split(PLACEHOLDER_REF)
        .join(res.reference)
        .split(PLACEHOLDER_LIEN)
        .join(res.lien);
      setResultat({ reference: res.reference, lien: res.lien, copie: false });
      if (res.numeroWhatsapp) {
        const url = `https://wa.me/${res.numeroWhatsapp}?text=${encodeURIComponent(messageFinal)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setErreur("Numéro WhatsApp invalide pour ce fournisseur — corrige-le dans sa fiche avant d'envoyer.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{groupe.vendeurNom}</p>
          <p className="text-xs text-ink/50">
            {groupe.vendeurTelephone ?? (
              <span className="inline-flex items-center gap-1 text-action">
                <AlertTriangle size={12} aria-hidden="true" />
                Sans numéro WhatsApp —{" "}
                <Link href="/admin/fournisseurs" className="underline">
                  renseigner sa fiche
                </Link>
              </span>
            )}
          </p>
        </div>
        <div className="text-right text-xs text-ink/60">
          <p className="font-semibold text-ink">{groupe.nbArticles} article{groupe.nbArticles > 1 ? "s" : ""}</p>
          <p>{formatPrice(groupe.totalAchat)} d&apos;achat</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-ink/5 pt-3">
        {commandesDisponibles.map((c) => (
          <div key={c.commandeId} className={`flex items-start gap-2 text-sm ${c.enAttente ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={selection.has(c.commandeId)}
              onChange={() => toggleCommande(c.commandeId)}
              className="mt-1 size-4 shrink-0 accent-brand"
              aria-label={`Inclure la commande #${c.commandeId}`}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-ink/80">
                <Link href={`/admin/commandes/${c.commandeId}`} className="font-medium text-brand hover:underline">
                  #{c.commandeId}
                </Link>
                {c.clientNom}
                <LivraisonBadge modeLivraison={c.modeLivraison} dateLivraisonPrevue={c.dateLivraisonPrevue} />
                {c.enAttente && <span className="text-[10px] italic text-ink/50">pas encore confirmée par appel</span>}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {c.articles.map((a) => (
                  <li key={a.commandeItemId} className="flex items-center gap-2 text-xs text-ink/60">
                    {a.produitPhoto && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={a.produitPhoto} alt="" className="size-7 shrink-0 rounded-md border border-ink/10 object-cover" />
                    )}
                    <span className="min-w-0 truncate">
                      {a.quantite} x {a.produitNom}
                      {a.varianteLabel ? ` (${a.varianteLabel})` : ""}
                    </span>
                    {a.demandeExistante && (
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-ink/50">
                        Déjà dans {a.demandeExistante.ref}
                        <PastilleDemande
                          statut={a.demandeExistante.statut as StatutDemandePreparation}
                          recupereeLe={a.demandeExistante.recupereeLe}
                        />
                        <BoutonRenvoyer demandeId={a.demandeExistante.id} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {erreur && <p className="mt-2 text-xs text-action">{erreur}</p>}

      {!toutesDejaEnvoyees && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink/5 pt-3">
          <label className="flex items-center gap-1.5 text-xs text-ink/60">
            <input type="checkbox" checked={avecPrix} onChange={(e) => setAvecPrix(e.target.checked)} className="size-3.5 accent-brand" />
            Inclure les prix d&apos;achat
          </label>
          {!ouvert ? (
            <button
              type="button"
              onClick={preparer}
              disabled={enCours || articlesSelectionnes.length === 0}
              className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand disabled:opacity-40"
            >
              Préparer le message
            </button>
          ) : (
            <button type="button" onClick={() => setOuvert(false)} className="text-xs text-ink/50 underline">
              Fermer l&apos;aperçu
            </button>
          )}
        </div>
      )}

      {ouvert && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-ink/[0.02] p-3">
          <textarea
            value={texteEdite}
            onChange={(e) => setTexteEdite(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-ink/15 bg-white p-2 text-xs text-ink"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={validerEtEnvoyer}
              disabled={enCours}
              className="flex min-h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-xs font-semibold text-on-brand disabled:opacity-50"
            >
              <MessageCircle size={14} aria-hidden="true" />
              Valider et ouvrir WhatsApp
            </button>
            {resultat && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(resultat.lien);
                    setResultat((r) => (r ? { ...r, copie: true } : r));
                    setTimeout(() => setResultat((r) => (r ? { ...r, copie: false } : r)), 2000);
                  } catch {
                    /* copie impossible, pas bloquant */
                  }
                }}
                className="flex items-center gap-1 text-xs text-ink/60 underline"
              >
                {resultat.copie ? <Check size={12} /> : <Copy size={12} />}
                {resultat.reference} — copier le lien
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
