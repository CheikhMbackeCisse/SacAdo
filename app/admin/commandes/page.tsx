import Link from "next/link";
import {
  compterCommandesRecues,
  getCommandesAdmin,
  getModeleAppelWhatsApp,
} from "@/lib/admin/commandes-actions";
import { CommandesListe } from "@/components/admin/commandes-liste";
import type { StatutCommande } from "@/lib/supabase/types";
import { PullToRefresh } from "@/components/admin/pull-to-refresh";

// Libellés alignés sur PROMPT_ADMIN_V2 Lot 2 pour les filtres rapides.
const STATUTS: { value: StatutCommande | "toutes"; label: string }[] = [
  { value: "toutes", label: "Toutes" },
  { value: "a_confirmer_appel", label: "À confirmer par appel" },
  { value: "paiement_en_attente", label: "En attente de paiement Wave" },
  { value: "recue", label: "Payées à préparer" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrées" },
  { value: "probleme", label: "Souci" },
  { value: "annulee", label: "Annulées" },
];

const TAILLE_PAGE = 50;

export default async function AdminCommandesPage(props: PageProps<"/admin/commandes">) {
  const { statut, page: pageParam, dateLivraison: dateLivraisonParam } = await props.searchParams;
  const filtre = typeof statut === "string" ? (statut as StatutCommande) : undefined;
  const dateLivraison = typeof dateLivraisonParam === "string" ? dateLivraisonParam : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * TAILLE_PAGE;

  const [{ items: commandes, hasMore }, nbRecues, modeleAppel] = await Promise.all([
    getCommandesAdmin(filtre, { offset, limit: TAILLE_PAGE, dateLivraison }),
    compterCommandesRecues(),
    getModeleAppelWhatsApp(),
  ]);

  const hrefAvec = (params: { statut?: StatutCommande; page?: number; dateLivraison?: string }) => {
    const qs = new URLSearchParams();
    const s = params.statut ?? filtre;
    const d = params.dateLivraison ?? dateLivraison;
    const p = params.page ?? page;
    if (s) qs.set("statut", s);
    if (d) qs.set("dateLivraison", d);
    if (p > 1) qs.set("page", String(p));
    const q = qs.toString();
    return q ? `/admin/commandes?${q}` : "/admin/commandes";
  };
  const hrefPourStatut = (value: StatutCommande | "toutes") =>
    hrefAvec({ statut: value === "toutes" ? undefined : value, page: 1 });
  const hrefPourPage = (p: number) => hrefAvec({ page: p });

  return (
    <PullToRefresh>
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Commandes</h1>

      <div className="flex flex-wrap gap-2">
        {STATUTS.map((option) => (
          <Link
            key={option.value}
            href={hrefPourStatut(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              (option.value === "toutes" && !filtre) || option.value === filtre
                ? "border-brand bg-brand text-surface"
                : "border-ink/15 text-ink/70"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {/* Filtre "préparer la tournée" (maj-accueil §7) : une date précise de
          livraison. Formulaire GET pur, pas de JS nécessaire. */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        {filtre && <input type="hidden" name="statut" value={filtre} />}
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
        <CommandesListe commandes={commandes} nbRecues={nbRecues} modeleAppel={modeleAppel} />
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
