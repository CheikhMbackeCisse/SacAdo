import { notFound } from "next/navigation";
import { getKitAdmin, getKitItemsAdmin, getTotauxGammesClasse } from "@/lib/admin/kits-actions";
import { getProduitsAdmin } from "@/lib/admin/produits-actions";
import { getGammeDef } from "@/lib/gammes";
import { KitItemsManager } from "@/components/admin/kit-items-manager";
import { MosaiqueKit } from "@/components/admin/mosaique-kit";
import { formatPrice } from "@/lib/format";

export default async function EditKitPage(props: PageProps<"/admin/kits/[id]">) {
  const { id } = await props.params;
  const kitId = Number(id);
  if (!Number.isFinite(kitId)) notFound();

  const kit = await getKitAdmin(kitId);
  if (!kit) notFound();

  const [items, tousLesProduits, gammesSoeurs] = await Promise.all([
    getKitItemsAdmin(kitId),
    getProduitsAdmin(),
    getTotauxGammesClasse(kit.cycle, kit.niveau, kit.id),
  ]);
  // Livres et annales (§3.5.3) : jamais une ancienne édition dans un kit —
  // pas proposée au sélecteur (garde-fou serveur dans ajouterKitItem).
  const produits = tousLesProduits.filter((p) => p.edition_statut !== "ancienne");

  // Approximation en direct pendant l'édition (coché par défaut, section
  // principale) : le calcul exact, aligné sur le storefront, reste
  // `prix_calcule` dans la liste /admin/kits.
  const totalEnDirect = items
    .filter((it) => it.section === "principal" && it.coche_defaut)
    .reduce((acc, it) => acc + it.quantite_defaut * it.produit_prix, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">{kit.nom}</h1>

      <div className="flex max-w-2xl flex-wrap items-center gap-4 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm">
        <span className="font-semibold text-ink">Total en direct : {formatPrice(totalEnDirect)}</span>
        {gammesSoeurs.map((g) => (
          <span key={g.gamme} className="text-ink/50">
            {getGammeDef(g.gamme)?.label ?? g.gamme} : {formatPrice(g.prix_calcule)}
          </span>
        ))}
      </div>

      <KitItemsManager kitId={kit.id} items={items} produits={produits} />
      <MosaiqueKit kitId={kit.id} items={items} imagesInitiales={kit.images_mosaique} />
    </div>
  );
}
