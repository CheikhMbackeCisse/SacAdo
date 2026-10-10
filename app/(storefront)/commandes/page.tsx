"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { getCommandesParTelephone } from "@/lib/moi/actions";
import { formatPrice } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { LIBELLES_STATUT_COMMANDE } from "@/lib/commandes";
import { BoutonReessayerPaiement } from "@/components/checkout/paiement-retour";
import { BasculerLivraison } from "@/components/checkout/bascule-livraison";
import { BoutonAjouterProduits } from "@/components/ajout/bouton-ajouter";
import { commandeModifiablePourAjout } from "@/lib/ajout/eligibilite";
import type { Commande } from "@/lib/supabase/types";

const LABELS_STATUT = LIBELLES_STATUT_COMMANDE;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MesCommandesPage() {
  const { identite } = useIdentite();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!identite?.jeton) return;
    getCommandesParTelephone(identite.telephone, identite.jeton)
      .then(setCommandes)
      .finally(() => setCharge(true));
  }, [identite]);

  const sansHistorique = Boolean(identite) && !identite?.jeton;
  const loading = Boolean(identite?.jeton) && !charge;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Mes commandes</h1>

      {!identite ? (
        <EmptyState
          icon={ClipboardList}
          title="Pas encore de commande"
          description="Vos commandes apparaîtront ici après votre premier achat."
        />
      ) : loading ? (
        <p className="text-sm text-ink/50">Chargement…</p>
      ) : sansHistorique ? (
        <EmptyState
          icon={ClipboardList}
          title="Historique lié à cet appareil"
          description="Passez une commande depuis cet appareil pour retrouver votre suivi ici."
        />
      ) : commandes.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Vous n'avez pas encore de commande"
          description="Vos commandes apparaîtront ici une fois passées."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {commandes.map((commande) => {
            // Paiement Wave abandonné ou échoué (PROMPT_CLIENT_V2 Lot 1) : la
            // commande reste visible, avec le choix de reprendre le paiement
            // Wave ou de basculer à la livraison. `statut` reste
            // 'paiement_en_attente' même après un échec (voir
            // traiter_paiement_wave) — seul `statut_paiement` change.
            const enAttentePaiement =
              commande.mode_paiement === "wave" && commande.statut === "paiement_en_attente";

            return (
              <div
                key={commande.id}
                className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3"
              >
                <Link
                  href={`/suivi/${commande.id}?t=${identite?.jeton ?? ""}`}
                  className="flex flex-col gap-1 active:opacity-70"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">Commande #{commande.id}</span>
                    <span
                      className={`text-xs font-medium ${
                        commande.statut === "livree"
                          ? "text-success"
                          : commande.statut === "probleme" || commande.statut === "annulee"
                            ? "text-red-600"
                            : "text-ink/60"
                      }`}
                    >
                      {LABELS_STATUT[commande.statut]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink/50">
                    <span>{formatDate(commande.date)}</span>
                    <span className="font-semibold text-ink">{formatPrice(commande.total)}</span>
                  </div>
                </Link>

                {enAttentePaiement && commande.client_reference && (
                  <div className="flex flex-col gap-2 border-t border-ink/10 pt-2">
                    <BoutonReessayerPaiement reference={commande.client_reference} label="Payer maintenant" />
                    <BasculerLivraison reference={commande.client_reference} />
                  </div>
                )}

                {commandeModifiablePourAjout(commande.statut) && identite?.jeton && (
                  <div className="border-t border-ink/10 pt-2">
                    <BoutonAjouterProduits
                      commandeId={commande.id}
                      jeton={identite.jeton}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-brand/30 text-xs font-semibold text-brand active:scale-[0.98]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
