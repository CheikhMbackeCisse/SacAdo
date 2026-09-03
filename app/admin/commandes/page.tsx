import Link from "next/link";
import { getCommandesAdmin } from "@/lib/admin/commandes-actions";
import { formatPrice } from "@/lib/format";
import { StatutSelect } from "@/components/admin/statut-select";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";
import type { StatutCommande } from "@/lib/supabase/types";

const STATUTS: { value: StatutCommande | "toutes"; label: string }[] = [
  { value: "toutes", label: "Toutes" },
  { value: "paiement_en_attente", label: "Paiement en attente" },
  { value: "recue", label: "Reçue" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrée" },
];

const TAILLE_PAGE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminCommandesPage(props: PageProps<"/admin/commandes">) {
  const { statut, page: pageParam } = await props.searchParams;
  const filtre = typeof statut === "string" ? (statut as StatutCommande) : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * TAILLE_PAGE;

  const { items: commandes, hasMore } = await getCommandesAdmin(filtre, { offset, limit: TAILLE_PAGE });

  const hrefPourStatut = (value: StatutCommande | "toutes") =>
    value === "toutes" ? "/admin/commandes" : `/admin/commandes?statut=${value}`;
  const hrefPourPage = (p: number) => {
    const params = new URLSearchParams();
    if (filtre) params.set("statut", filtre);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/commandes?${qs}` : "/admin/commandes";
  };

  return (
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

      {commandes.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune commande.
        </p>
      ) : (
        <CartesListe>
          {commandes.map((commande) => (
            <CarteListe key={commande.id}>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/admin/commandes/${commande.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  Commande #{commande.id}
                </Link>
                <span className="text-xs text-ink/50">{formatDate(commande.date)}</span>
              </div>
              <ChampCarte label="Client">
                {commande.client_nom}
                <span className="block text-xs text-ink/40">{commande.client_telephone}</span>
              </ChampCarte>
              <ChampCarte label="Total">
                {formatPrice(commande.total)}
                {commande.mode_paiement === "wave" && (
                  <span className="ml-1.5 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
                    Wave{commande.statut_paiement === "payee" ? " ✓" : ""}
                  </span>
                )}
              </ChampCarte>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-ink/50">Statut</span>
                <StatutSelect commandeId={commande.id} statutActuel={commande.statut} />
              </div>
            </CarteListe>
          ))}
        </CartesListe>
      )}

      <TableauDesktop>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((commande) => (
              <tr key={commande.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink">
                  <Link href={`/admin/commandes/${commande.id}`} className="text-brand hover:underline">
                    #{commande.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {commande.client_nom}
                  <div className="text-xs text-ink/40">{commande.client_telephone}</div>
                </td>
                <td className="px-4 py-3 text-ink/60">{formatDate(commande.date)}</td>
                <td className="px-4 py-3 font-medium text-ink">
                  {formatPrice(commande.total)}
                  {commande.mode_paiement === "wave" && (
                    <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
                      Wave
                      {commande.statut_paiement === "payee" ? " ✓" : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatutSelect commandeId={commande.id} statutActuel={commande.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableauDesktop>

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
  );
}
