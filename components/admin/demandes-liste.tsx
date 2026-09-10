"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ExternalLink } from "lucide-react";
import {
  changerStatutDemande,
  chercherProduitsPourRattachement,
  noterDemande,
  rattacherProduitDemande,
  type Demande,
  type ProduitOption,
  type StatutDemande,
} from "@/lib/admin/demandes-actions";
import { lienWhatsAppVers } from "@/lib/whatsapp";

const STATUT_LABEL: Record<StatutDemande, string> = {
  nouvelle: "Nouvelle",
  en_recherche: "En recherche",
  trouve: "Trouvé",
  indisponible: "Indisponible",
};
const ORIGINE_LABEL: Record<string, string> = {
  moi: "écran Moi",
  recherche_vide: "recherche sans résultat",
  categorie: "bas de catégorie",
};
const ONGLETS: (StatutDemande | "toutes")[] = [
  "nouvelle",
  "en_recherche",
  "trouve",
  "indisponible",
  "toutes",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function DemandesListe({ demandes }: { demandes: Demande[] }) {
  const [onglet, setOnglet] = useState<StatutDemande | "toutes">("nouvelle");

  const compte = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of demandes) c[d.statut] = (c[d.statut] ?? 0) + 1;
    return c;
  }, [demandes]);

  const liste = onglet === "toutes" ? demandes : demandes.filter((d) => d.statut === onglet);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOnglet(o)}
            aria-pressed={onglet === o}
            className={`min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors ${
              onglet === o
                ? "bg-brand/10 text-brand"
                : "border border-ink/15 text-ink/60 hover:bg-ink/5"
            }`}
          >
            {o === "toutes" ? "Toutes" : STATUT_LABEL[o]}
            {o !== "toutes" && compte[o] ? ` (${compte[o]})` : ""}
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune demande dans cette catégorie.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {liste.map((d) => (
            <LigneDemande key={d.id} demande={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LigneDemande({ demande }: { demande: Demande }) {
  const router = useRouter();
  const [note, setNote] = useState(demande.note_interne ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [options, setOptions] = useState<ProduitOption[]>([]);
  const [messageWa, setMessageWa] = useState<string | null>(null);

  const lancer = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setEnCours(true);
    setErreur(null);
    const res = await action();
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error ?? "Action impossible.");
      return;
    }
    router.refresh();
  };

  const chercher = async (terme: string) => {
    setRecherche(terme);
    if (terme.trim().length < 2) {
      setOptions([]);
      return;
    }
    setOptions(await chercherProduitsPourRattachement(terme));
  };

  const rattacher = async (produitId: number) => {
    setEnCours(true);
    setErreur(null);
    const res = await rattacherProduitDemande(demande.id, produitId);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setMessageWa(res.message ?? null);
    setOptions([]);
    setRecherche("");
    router.refresh();
  };

  const lienContact = lienWhatsAppVers(
    demande.telephone,
    messageWa ?? `Bonjour, c'est SacAdo, au sujet de ta demande : ${demande.description}`,
  );

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{demande.description}</p>
          {demande.precision_produit && (
            <p className="text-xs text-ink/60">Précision : {demande.precision_produit}</p>
          )}
          <p className="mt-0.5 text-xs text-ink/45">
            {demande.telephone} · {formatDate(demande.cree_le)}
            {demande.origine && ` · ${ORIGINE_LABEL[demande.origine] ?? demande.origine}`}
            {demande.terme_recherche && ` · terme cherché : « ${demande.terme_recherche} »`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-ink/60">
          {STATUT_LABEL[demande.statut]}
        </span>
      </div>

      {demande.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={demande.photo_url}
          alt=""
          className="size-24 rounded-xl border border-ink/10 object-cover"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {lienContact && (
          <a
            href={lienContact}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-3.5 text-sm font-semibold text-surface active:scale-95"
          >
            <MessageCircle size={15} aria-hidden="true" />
            WhatsApp
          </a>
        )}
        {demande.produit_id && (
          <a
            href={`/produit/${demande.produit_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink/15 px-3.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Fiche produit
          </a>
        )}
      </div>

      {messageWa && (
        <p className="rounded-xl bg-brand/5 p-2.5 text-xs text-ink/70">
          Message prêt à envoyer : « {messageWa} »
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(["nouvelle", "en_recherche", "indisponible"] as StatutDemande[])
          .filter((s) => s !== demande.statut)
          .map((s) => (
            <button
              key={s}
              type="button"
              disabled={enCours}
              onClick={() => lancer(() => changerStatutDemande(demande.id, s))}
              className="min-h-10 rounded-full border border-ink/15 px-3.5 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-40"
            >
              → {STATUT_LABEL[s]}
            </button>
          ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink/55">
          Trouvé ? Rattacher à un produit du catalogue
        </span>
        <input
          value={recherche}
          onChange={(e) => chercher(e.target.value)}
          placeholder="Chercher un produit par nom…"
          className="min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none"
        />
        {options.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl border border-ink/10 p-1">
            {options.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => rattacher(p.id)}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-ink/80 hover:bg-ink/5 disabled:opacity-40"
                >
                  {p.nom}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink/55">Note interne</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          disabled={enCours || note === (demande.note_interne ?? "")}
          onClick={() => lancer(() => noterDemande(demande.id, note))}
          className="min-h-9 w-fit rounded-full border border-ink/15 px-3.5 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-40"
        >
          Enregistrer la note
        </button>
      </div>

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </li>
  );
}
