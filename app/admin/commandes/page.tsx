import Link from "next/link";
import { compterCommandesRecues, getCommandesAdmin } from "@/lib/admin/commandes-actions";
import { CommandesListe } from "@/components/admin/commandes-liste";
import type { StatutCommande } from "@/lib/supabase/types";

const STATUTS: { value: StatutCommande | "toutes"; label: string }[] = [
  { value: "toutes", label: "Toutes" },
  { value: "paiement_en_attente", label: "Paiement en attente" },
  { value: "recue", label: "Reçue" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrée" },
  { value: "probleme", label: "Souci" },
];

const TAILLE_PAGE = 50;

export default async function AdminCommandesPage(props: PageProps<"/admin/commandes">) {
  const { statut, page: pageParam } = await props.searchParams;
  const filtre = typeof statut === "string" ? (statut as StatutCommande) : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * TAILLE_PAGE;

  const [{ items: commandes, hasMore }, nbRecues] = await Promise.all([
    getCommandesAdmin(filtre, { offset, limit: TAILLE_PAGE }),
    compterCommandesRecues(),
  ]);

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
        <CommandesListe commandes={commandes} nbRecues={nbRecues} />
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
  );
}
