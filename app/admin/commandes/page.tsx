import Link from "next/link";
import {
  compterCommandesParVue,
  compterCommandesRecues,
  getCommandesAdmin,
  getMiniaturesParCommande,
  getModeleAppelWhatsApp,
} from "@/lib/admin/commandes-actions";
import { STATUTS_COMMANDE_EFFECTUEE, STATUTS_COMMANDE_EN_ATTENTE } from "@/lib/commandes";
import { CommandesListe } from "@/components/admin/commandes-liste";
import type { StatutCommande } from "@/lib/supabase/types";
import { PullToRefresh } from "@/components/admin/pull-to-refresh";

type Vue = "en_attente" | "effectuees";

// Puces rangées sous leur onglet (Lot 1). "Injoignable" n'est pas un statut
// à part : c'est 'a_confirmer_appel' avec au moins une tentative d'appel
// échouée (migration 0108) — voir le paramètre `injoignable` plus bas.
const PUCES_EN_ATTENTE: { value: StatutCommande; injoignable?: boolean; label: string }[] = [
  { value: "a_confirmer_appel", label: "À confirmer par appel" },
  { value: "a_confirmer_appel", injoignable: true, label: "Injoignable" },
  { value: "paiement_en_attente", label: "En attente de paiement Wave" },
];
const PUCES_EFFECTUEES: { value: StatutCommande; label: string }[] = [
  { value: "recue", label: "Payées à préparer" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrées" },
];
// Ni l'un ni l'autre (Lot 1) : affichées à part, quel que soit l'onglet actif.
const PUCES_A_PART: { value: StatutCommande; label: string }[] = [
  { value: "probleme", label: "Souci" },
  { value: "annulee", label: "Annulées" },
];

const TAILLE_PAGE = 50;

export default async function AdminCommandesPage(props: PageProps<"/admin/commandes">) {
  const {
    vue: vueParam,
    statut,
    injoignable: injoignableParam,
    page: pageParam,
    dateLivraison: dateLivraisonParam,
    test: testParam,
  } = await props.searchParams;
  const vue: Vue = vueParam === "effectuees" ? "effectuees" : "en_attente";
  const filtre = typeof statut === "string" ? (statut as StatutCommande) : undefined;
  const injoignable = injoignableParam === "1";
  const dateLivraison = typeof dateLivraisonParam === "string" ? dateLivraisonParam : undefined;
  const test = testParam === "1";
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * TAILLE_PAGE;
  const statutsVue = vue === "effectuees" ? STATUTS_COMMANDE_EFFECTUEE : STATUTS_COMMANDE_EN_ATTENTE;

  const [{ items: commandes, hasMore }, nbRecues, modeleAppel, compteursVue] = await Promise.all([
    getCommandesAdmin(filtre, { offset, limit: TAILLE_PAGE, dateLivraison, test, statutsVue, injoignable }),
    compterCommandesRecues(),
    getModeleAppelWhatsApp(),
    compterCommandesParVue(),
  ]);
  const miniaturesMap = await getMiniaturesParCommande(commandes.map((c) => c.id));
  const miniatures = Object.fromEntries(miniaturesMap);

  const hrefAvec = (params: {
    vue?: Vue;
    statut?: StatutCommande;
    injoignable?: boolean;
    page?: number;
    dateLivraison?: string;
    test?: boolean;
  }) => {
    const qs = new URLSearchParams();
    const v = params.vue ?? vue;
    const s = params.statut ?? filtre;
    const inj = params.injoignable ?? injoignable;
    const d = params.dateLivraison ?? dateLivraison;
    const p = params.page ?? page;
    const t = params.test ?? test;
    if (v !== "en_attente") qs.set("vue", v);
    if (s) qs.set("statut", s);
    if (inj) qs.set("injoignable", "1");
    if (d) qs.set("dateLivraison", d);
    if (p > 1) qs.set("page", String(p));
    if (t) qs.set("test", "1");
    const q = qs.toString();
    return q ? `/admin/commandes?${q}` : "/admin/commandes";
  };
  const hrefPourVue = (v: Vue) => hrefAvec({ vue: v, statut: undefined, injoignable: false, page: 1 });
  const hrefPourPuce = (value: StatutCommande, inj = false) =>
    hrefAvec({ statut: value === filtre && inj === injoignable ? undefined : value, injoignable: inj, page: 1 });
  const hrefPourPage = (p: number) => hrefAvec({ page: p });
  const pucesOnglet = vue === "effectuees" ? PUCES_EFFECTUEES : PUCES_EN_ATTENTE;

  return (
    <PullToRefresh>
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-bold text-ink">Commandes</h1>
        <Link
          href={hrefAvec({ test: !test, page: 1 })}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            test ? "border-brand bg-brand text-surface" : "border-ink/15 text-ink/70"
          }`}
        >
          Commandes de test
        </Link>
      </div>

      <div className="flex gap-2 border-b border-ink/10">
        {([
          { value: "en_attente" as Vue, label: "En attente", count: compteursVue.enAttente },
          { value: "effectuees" as Vue, label: "Effectuées", count: compteursVue.effectuees },
        ]).map((onglet) => (
          <Link
            key={onglet.value}
            href={hrefPourVue(onglet.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              vue === onglet.value ? "border-brand text-brand" : "border-transparent text-ink/50"
            }`}
          >
            {onglet.label} ({onglet.count})
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {pucesOnglet.map((puce) => {
          const actif = puce.value === filtre && Boolean("injoignable" in puce && puce.injoignable) === injoignable;
          return (
            <Link
              key={`${puce.value}-${"injoignable" in puce ? puce.injoignable : false}`}
              href={hrefPourPuce(puce.value, "injoignable" in puce ? Boolean(puce.injoignable) : false)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                actif ? "border-brand bg-brand text-surface" : "border-ink/15 text-ink/70"
              }`}
            >
              {puce.label}
            </Link>
          );
        })}
        <span className="mx-1 self-center text-ink/20">|</span>
        {PUCES_A_PART.map((puce) => (
          <Link
            key={puce.value}
            href={hrefPourPuce(puce.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              puce.value === filtre ? "border-brand bg-brand text-surface" : "border-ink/15 text-ink/70"
            }`}
          >
            {puce.label}
          </Link>
        ))}
      </div>

      {/* Filtre "préparer la tournée" (maj-accueil §7) : une date précise de
          livraison. Formulaire GET pur, pas de JS nécessaire. */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        {vue !== "en_attente" && <input type="hidden" name="vue" value={vue} />}
        {filtre && <input type="hidden" name="statut" value={filtre} />}
        {injoignable && <input type="hidden" name="injoignable" value="1" />}
        <label className="flex items-center gap-2 text-xs text-ink/60">
          Date de livraison
          <input
            type="date"
            name="dateLivraison"
            defaultValue={dateLivraison ?? ""}
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <button type="submit" className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70">
          Filtrer
        </button>
        {dateLivraison && (
          <Link href={hrefAvec({ dateLivraison: "", page: 1 })} className="text-xs text-ink/50 underline">
            Retirer le filtre
          </Link>
        )}
      </form>

      {commandes.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune commande.
        </p>
      ) : (
        <CommandesListe commandes={commandes} nbRecues={nbRecues} modeleAppel={modeleAppel} miniatures={miniatures} />
      )}

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={hrefPourPage(page - 1)} className="text-brand hover:underline">
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink/40">Page {page}</span>
          {hasMore ? (
            <Link href={hrefPourPage(page + 1)} className="text-brand hover:underline">
              Suivant →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
