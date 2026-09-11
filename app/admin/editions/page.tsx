import { getOuvragesEditionAncienne } from "@/lib/admin/editions-actions";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminEditionsPage() {
  const ouvrages = await getOuvragesEditionAncienne();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Éditions à vérifier</h1>
        <p className="mt-1 text-sm text-ink/55">
          Ouvrages dont l&apos;édition en vigueur date de plus de deux ans — à
          interroger auprès du fournisseur à chaque rentrée.
        </p>
      </div>

      {ouvrages.length === 0 ? (
        <p className="rounded-lg border border-ink/10 p-4 text-sm text-ink/55">
          Aucun ouvrage à vérifier pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10 rounded-lg border border-ink/10">
          {ouvrages.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-ink">{o.nom}</p>
                <p className="text-xs text-ink/50">
                  {[o.auteur, o.editeur].filter(Boolean).join(" — ") || "—"} · édition {o.edition}
                  {" "}· {formatPrice(o.prix)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-ink/8 px-2.5 py-1 text-[11px] font-semibold text-ink/60">
                {o.anneesEcoulees} ans
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
