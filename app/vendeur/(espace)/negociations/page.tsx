import { getMesNegociations } from "@/lib/vendeur/negociation-actions";
import { MesNegociations } from "@/components/vendeur/mes-negociations";
import { formatPrice } from "@/lib/format";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function VendeurNegociationsPage() {
  const items = await getMesNegociations();
  const cheznSacado = items.filter((i) => !i.aMoiDeJouer);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#001314]">Négociations</h1>
        <p className="mt-1 text-sm text-[#001314]/55">
          Le prix de chaque produit se fixe avec SacAdo avant publication. Suivez ici les
          allers-retours.
        </p>
      </div>

      {items.length === 0 && (
        <p className="rounded-2xl border border-[#001314]/10 bg-white px-4 py-10 text-center text-sm text-[#001314]/50">
          Aucune négociation en cours. Elle démarre automatiquement à la soumission d’un produit.
        </p>
      )}

      <MesNegociations items={items} />

      {cheznSacado.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#001314]/10 bg-white p-4">
          <h2 className="font-heading text-base font-bold text-[#001314]">
            En attente d’une réponse de SacAdo
          </h2>
          <ul className="flex flex-col divide-y divide-[#001314]/10">
            {cheznSacado.map((item) => (
              <li key={item.produit.id} className="flex flex-col gap-1.5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-[#001314]">{item.produit.nom}</span>
                  <span className="text-[#001314]/60">
                    Dernier prix : <span className="font-semibold text-[#0B3D91]">
                      {formatPrice(item.prixEnJeu)}
                    </span>
                  </span>
                </div>
                <ul className="flex flex-col gap-0.5 text-xs text-[#001314]/55">
                  {item.fil.map((prop) => (
                    <li key={prop.id} className="flex items-center justify-between gap-2">
                      <span>
                        {prop.auteur === "admin" ? "SacAdo" : "Vous"} · {formatPrice(prop.prix_propose)}
                      </span>
                      <span className="text-[#001314]/35">{formatDate(prop.date)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
