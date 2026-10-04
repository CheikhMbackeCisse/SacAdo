import { Fragment } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCommandeAdmin,
  getCommandeAjoutsAdmin,
  getCommandeItemsAdmin,
  getModeleAppelWhatsApp,
  type CommandeItemAvecProduit,
} from "@/lib/admin/commandes-actions";
import { getBlocWhatsApp } from "@/lib/admin/whatsapp-actions";
import { Download, ExternalLink } from "lucide-react";
import { formatDateLivraison, formatPrice } from "@/lib/format";
import { LIBELLES_STATUT_PAIEMENT } from "@/lib/commandes";
import { numeroFacture } from "@/lib/factures/config";
import { StatutSelect } from "@/components/admin/statut-select";
import { ConfirmationAppel } from "@/components/admin/confirmation-appel";
import { BlocWhatsAppFiche } from "@/components/admin/bloc-whatsapp";
import { CommandeLocalisation } from "@/components/checkout/commande-localisation";
import { TableauDesktop } from "@/components/admin/liste-mobile";
import type { CommandeAjout } from "@/lib/supabase/types";

// Garantie ordinateurs reconditionnés (migration 0070) : la première question
// d'un client qui revient avec une panne est de savoir s'il est encore
// couvert, la réponse doit tenir en un coup d'oeil (TACHE_seye_dynamique
// _integration.md §4).
function formatDateGarantie(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
}

// Regroupe les lignes d'un même kit scolaire (CORRECTIONS_V15 Lot 2) : l'admin
// prépare la commande, il lui faut le détail produit par produit, mais rangé
// sous le nom du kit plutôt que noyé dans la liste.
type GroupeItemsAdmin = {
  id: string | null;
  nom: string | null;
  prenom: string | null;
  items: CommandeItemAvecProduit[];
};

function regrouperItemsParKit(items: CommandeItemAvecProduit[]): GroupeItemsAdmin[] {
  const groupes: GroupeItemsAdmin[] = [];
  const parGroupeId = new Map<string, GroupeItemsAdmin>();
  let horsGroupe: GroupeItemsAdmin | null = null;
  for (const item of items) {
    if (item.kit_groupe_id) {
      let g = parGroupeId.get(item.kit_groupe_id);
      if (!g) {
        g = { id: item.kit_groupe_id, nom: item.kit_nom, prenom: item.kit_beneficiaire_prenom, items: [] };
        parGroupeId.set(item.kit_groupe_id, g);
        groupes.push(g);
      }
      g.items.push(item);
    } else {
      if (!horsGroupe) {
        horsGroupe = { id: null, nom: null, prenom: null, items: [] };
        groupes.push(horsGroupe);
      }
      horsGroupe.items.push(item);
    }
  }
  return groupes;
}

// Tableau/cartes d'articles, factorisé pour être réutilisé à l'identique par
// les lignes d'origine et par chaque lot d'ajout (PROMPT_ADMIN_V2 Lot 2).
function BlocArticles({ groupesItems }: { groupesItems: GroupeItemsAdmin[] }) {
  return (
    <>
      <div className="flex flex-col gap-3 lg:hidden">
        {groupesItems.map((groupe) => (
          <div key={groupe.id ?? "hors-groupe"} className="flex flex-col gap-1">
            {groupe.nom && (
              <p className="px-1 text-xs font-semibold text-ink/70">
                Kit {groupe.nom}
                {groupe.prenom ? ` — pour ${groupe.prenom}` : ""}
              </p>
            )}
            <ul className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white px-4 text-sm">
              {groupe.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="min-w-0 text-ink">
                    {item.produit_nom}
                    <span className="block text-xs text-ink/45">
                      {item.quantite} × {formatPrice(item.prix_unitaire)}
                    </span>
                    {item.composants && item.composants.length > 0 && (
                      <ul className="mt-1 border-l-2 border-ink/10 pl-2 text-xs text-ink/55">
                        {item.composants.map((c, i) => (
                          <li key={i}>
                            {c.nom} × {c.quantite}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.personnalisation_nom && (
                      <span className="block text-xs font-medium text-brand">
                        Personnalisé : {item.personnalisation_nom} — {item.personnalisation_specialite}
                      </span>
                    )}
                    {item.garantie_fin && (
                      <span className="block text-xs font-medium text-[#16A34A]">
                        Garantie jusqu&apos;au {formatDateGarantie(item.garantie_fin)}
                      </span>
                    )}
                    {item.photo_a_ameliorer && (
                      <span className="mt-1 block rounded border border-brand/30 bg-brand/5 px-1.5 py-0.5 text-xs font-medium text-ink">
                        Photographier avant l&apos;emballage (fond neutre, lumière du jour)
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-ink">
                    {formatPrice(item.prix_unitaire * item.quantite)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <TableauDesktop>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Qté</th>
              <th className="px-4 py-3 font-medium">Prix unitaire</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Garantie</th>
            </tr>
          </thead>
          <tbody>
            {groupesItems.map((groupe) => (
              <Fragment key={groupe.id ?? "hors-groupe"}>
                {groupe.nom && (
                  <tr key={`${groupe.id}-titre`} className="border-b border-ink/5">
                    <td colSpan={5} className="px-4 pt-3 text-xs font-semibold text-ink/70">
                      Kit {groupe.nom}
                      {groupe.prenom ? ` — pour ${groupe.prenom}` : ""}
                    </td>
                  </tr>
                )}
                {groupe.items.map((item) => (
                  <tr key={item.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 text-ink">
                      {item.produit_nom}
                      {item.personnalisation_nom && (
                        <span className="mt-1 block text-xs font-medium text-brand">
                          Personnalisé : {item.personnalisation_nom} — {item.personnalisation_specialite}
                        </span>
                      )}
                      {item.composants && item.composants.length > 0 && (
                        <ul className="mt-1 border-l-2 border-ink/10 pl-2 text-xs font-normal text-ink/55">
                          {item.composants.map((c, i) => (
                            <li key={i}>
                              {c.nom} × {c.quantite}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.photo_a_ameliorer && (
                        <span className="mt-1 block w-fit rounded border border-brand/30 bg-brand/5 px-1.5 py-0.5 text-xs font-medium text-ink">
                          Photographier avant l&apos;emballage (fond neutre, lumière du jour)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/60">{item.quantite}</td>
                    <td className="px-4 py-3 text-ink/60">{formatPrice(item.prix_unitaire)}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {formatPrice(item.prix_unitaire * item.quantite)}
                    </td>
                    <td className="px-4 py-3 text-ink/60">
                      {item.garantie_fin ? (
                        <span className="font-medium text-[#16A34A]">
                          {formatDateGarantie(item.garantie_fin)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableauDesktop>
    </>
  );
}

function formatDateHeureAjout(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Paiement d'un lot d'ajout, affiché à part de celui de la commande d'origine
// (PROMPT_ADMIN_V2 Lot 2) : un ajout Wave peut être payé alors que la commande
// elle-même est "à la livraison", et inversement.
function PaiementAjout({ ajout }: { ajout: CommandeAjout }) {
  if (ajout.mode_paiement !== "wave") {
    return <span className="text-ink/70">À la livraison — ajouté au montant dû</span>;
  }
  const reference = ajout.wave_event_id ?? ajout.wave_session_id;
  return (
    <span className="text-ink/80">
      Wave —{" "}
      <span
        className={
          ajout.statut_paiement === "payee"
            ? "font-semibold text-success"
            : ajout.statut_paiement === "en_attente"
              ? "font-semibold text-brand"
              : "font-semibold text-ink/60"
        }
      >
        {ajout.statut_paiement ? LIBELLES_STATUT_PAIEMENT[ajout.statut_paiement] : "—"}
      </span>
      {reference && <span className="block text-xs text-ink/40">Réf. {reference}</span>}
    </span>
  );
}

export default async function AdminCommandeDetailPage(props: PageProps<"/admin/commandes/[id]">) {
  const { id } = await props.params;
  const commandeId = Number(id);
  if (!Number.isFinite(commandeId)) notFound();

  const [commande, items, blocWhatsApp, ajouts, modeleAppel] = await Promise.all([
    getCommandeAdmin(commandeId),
    getCommandeItemsAdmin(commandeId),
    getBlocWhatsApp(commandeId),
    getCommandeAjoutsAdmin(commandeId),
    getModeleAppelWhatsApp(),
  ]);
  if (!commande) notFound();

  const itemsOrigine = items.filter((i) => i.ajout_id === null);
  const groupesItems = regrouperItemsParKit(itemsOrigine);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/commandes" className="text-sm text-brand hover:underline">
        ← Toutes les commandes
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-ink">Commande #{commande.id}</h1>
        <StatutSelect commandeId={commande.id} statutActuel={commande.statut} />
      </div>

      {commande.statut === "a_confirmer_appel" && (
        <ConfirmationAppel
          commandeId={commande.id}
          clientNom={commande.client_nom}
          clientTelephone={commande.client_telephone}
          telephoneNormalise={commande.telephone_normalise}
          total={commande.total}
          modeleWhatsApp={modeleAppel}
          tentatives={commande.appel_tentatives}
          dernierEssaiLe={commande.appel_dernier_essai_le}
        />
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
        <div>
          <p className="font-semibold text-ink">{commande.client_nom}</p>
          <p className="text-ink/50">{commande.client_telephone}</p>
          {commande.adresse && <p className="mt-2 text-ink/70">{commande.adresse}</p>}
          <p className="text-ink/50">
            Livraison{" "}
            {commande.message_livraison
              ? "spéciale"
              : commande.mode_livraison === "24h"
                ? "express (24h)"
                : commande.date_livraison_prevue
                  ? `datée — ${formatDateLivraison(commande.date_livraison_prevue)}`
                  : "datée"}
            {commande.localite_nom && ` — ${commande.localite_nom}`}
          </p>
          {commande.message_livraison && (
            <p className="mt-1 text-xs text-ink/60">
              Message affiché au client : « {commande.message_livraison} »
            </p>
          )}
        </div>

        {commande.frais_livraison_a_confirmer && (
          <p className="rounded-lg border border-brand/30 bg-brand/5 px-2 py-1.5 text-xs font-medium text-ink">
            Tarif de livraison à confirmer avec le client.
          </p>
        )}

        <div className="border-t border-ink/10 pt-3">
          <p className="text-xs font-medium text-ink/50">Paiement</p>
          {commande.mode_paiement === "wave" ? (
            <p className="text-ink/80">
              Wave —{" "}
              <span
                className={
                  commande.statut_paiement === "payee"
                    ? "font-semibold text-success"
                    : commande.statut_paiement === "en_attente"
                      ? "font-semibold text-brand"
                      : "font-semibold text-ink/60"
                }
              >
                {commande.statut_paiement
                  ? LIBELLES_STATUT_PAIEMENT[commande.statut_paiement]
                  : "—"}
              </span>
              {commande.montant_paye != null && (
                <span className="text-ink/50"> · {formatPrice(commande.montant_paye)} encaissés</span>
              )}
              {(commande.wave_event_id ?? commande.wave_session_id) && (
                <span className="block text-xs text-ink/40">
                  Réf. {commande.wave_event_id ?? commande.wave_session_id}
                </span>
              )}
            </p>
          ) : (
            <p className="text-ink/80">À la livraison</p>
          )}
        </div>

        {commande.lat != null && commande.lng != null ? (
          <CommandeLocalisation
            lat={commande.lat}
            lng={commande.lng}
            precision={commande.precision_livreur}
            liensNavigation
          />
        ) : commande.lien_localisation ? (
          <a
            href={commande.lien_localisation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-transform active:scale-95"
          >
            <ExternalLink size={13} aria-hidden="true" />
            Voir sur Google Maps
          </a>
        ) : (
          <p className="text-xs text-ink/40">Aucune position de livraison enregistrée.</p>
        )}

        {commande.facture_id != null && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
            <div>
              <p className="text-xs font-medium text-ink/50">
                Facture n° {numeroFacture(commande.facture_id)}
              </p>
              <p className="text-ink/80">
                Code de confirmation :{" "}
                <span className="font-mono font-semibold tracking-wide text-ink">
                  {commande.code_confirmation}
                </span>
              </p>
            </div>
            <a
              href={`/api/factures/${commande.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand"
            >
              <Download size={13} aria-hidden="true" />
              Télécharger la facture
            </a>
          </div>
        )}

        {commande.enfants_ebook && (
          <p className="rounded-lg bg-brand/5 px-2 py-1.5 text-xs text-ink/80">
            <span className="font-semibold text-ink">Prénom(s) indiqué(s) à la commande :</span>{" "}
            {commande.enfants_ebook}
          </p>
        )}
      </div>

      {blocWhatsApp && <BlocWhatsAppFiche commandeId={commande.id} bloc={blocWhatsApp} />}

      <BlocArticles groupesItems={groupesItems} />

      {ajouts.map((ajout) => {
        const groupesAjout = regrouperItemsParKit(items.filter((i) => i.ajout_id === ajout.id));
        return (
          <div key={ajout.id} className="flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
              <p className="font-semibold text-ink">Ajout du {formatDateHeureAjout(ajout.cree_le)}</p>
              <PaiementAjout ajout={ajout} />
            </div>
            <BlocArticles groupesItems={groupesAjout} />
          </div>
        );
      })}

      <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Sous-total</span>
          <span>{formatPrice(commande.sous_total)}</span>
        </div>
        <div className="flex justify-between text-ink/70">
          <span>Livraison</span>
          <span>
            {commande.frais_livraison_a_confirmer
              ? "À confirmer"
              : commande.frais_livraison === 0
                ? "Gratuite"
                : formatPrice(commande.frais_livraison)}
          </span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(commande.total)}</span>
        </div>
      </div>
    </div>
  );
}
