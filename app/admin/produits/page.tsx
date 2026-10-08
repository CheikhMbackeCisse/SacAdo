import Link from "next/link";
import { Plus, Download } from "lucide-react";
import {
  getProduitsAdminPage,
  getNbKitsParProduit,
  getVendeursPourFiltre,
  type FiltresProduitsAdmin,
  type TriProduitsAdmin,
} from "@/lib/admin/produits-actions";
import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { getSousCategoriesAdmin } from "@/lib/admin/sous-categories-actions";
import { DeleteProduitButton } from "@/components/admin/delete-produit-button";
import { PublierProduitButton } from "@/components/admin/publier-produit-button";
import { EditPrixStock } from "@/components/admin/edit-prix-stock";
import { FiltresProduits } from "@/components/admin/filtres-produits";
import { SelectionMasseProvider, CaseSelection, CaseToutSelectionner } from "@/components/admin/selection-masse";
import { ProductImage } from "@/components/ui/product-image";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";
import { VENDEUR_SACADO_ID } from "@/lib/vendeurs/constants";
import { PullToRefresh } from "@/components/admin/pull-to-refresh";

const TAILLE_PAGE = 50;

function chaine(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export default async function AdminProduitsPage(props: PageProps<"/admin/produits">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(chaine(sp.page)) || 1);
  const offset = (page - 1) * TAILLE_PAGE;

  const filtres: FiltresProduitsAdmin = {
    q: chaine(sp.q),
    categorieId: chaine(sp.categorie) ? Number(chaine(sp.categorie)) : undefined,
    sousCategorieId: chaine(sp.sousCategorie) ? Number(chaine(sp.sousCategorie)) : undefined,
    vendeurId: chaine(sp.vendeur) as FiltresProduitsAdmin["vendeurId"],
    statutPublication: chaine(sp.statut) as FiltresProduitsAdmin["statutPublication"],
    stock: chaine(sp.stock) as FiltresProduitsAdmin["stock"],
    sansImage: chaine(sp.sansImage) === "1",
    sansSousCategorie: chaine(sp.sansSousCategorie) === "1",
    tri: (chaine(sp.tri) as TriProduitsAdmin) ?? "nom",
  };

  const [{ items: produits, hasMore }, categories, sousCategories, vendeurs] = await Promise.all([
    getProduitsAdminPage({ offset, limit: TAILLE_PAGE }, filtres),
    getCategoriesAdmin(),
    getSousCategoriesAdmin(),
    getVendeursPourFiltre(),
  ]);
  const nbKitsParProduit = await getNbKitsParProduit(produits.map((p) => p.id));

  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) qs.set(k, v);
  const hrefPage = (p: number) => {
    const next = new URLSearchParams(qs);
    next.set("page", String(p));
    return `/admin/produits?${next.toString()}`;
  };

  return (
    <PullToRefresh>
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-ink">Produits</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/produits/export"
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
          >
            <Download size={14} aria-hidden="true" />
            Exporter en Excel
          </Link>
          <Link
            href="/admin/produits/nouveau"
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95"
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter un produit
          </Link>
        </div>
      </div>

      <FiltresProduits
        categories={categories.map((c) => ({ value: String(c.id), label: c.nom }))}
        sousCategories={sousCategories.map((c) => ({ value: String(c.id), label: c.nom }))}
        vendeurs={[
          { value: "sacado", label: "SacAdo" },
          ...vendeurs.map((v) => ({ value: v.id, label: v.nom })),
        ]}
      />

      {produits.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun produit ne correspond à ces filtres.
        </p>
      ) : (
        <SelectionMasseProvider
          produits={produits.map((p) => ({ id: p.id, nom: p.nom, prix: p.prix }))}
          categories={categories}
          sousCategories={sousCategories}
        >
        <CartesListe>
          {produits.map((produit) => {
            const nbKits = nbKitsParProduit.get(produit.id) ?? 0;
            return (
              <CarteListe key={produit.id}>
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <CaseSelection id={produit.id} />
                  </div>
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                    <ProductImage src={produit.photo} alt={produit.nom} className="h-full w-full" sizes="48px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink">{produit.nom}</p>
                      <span className="shrink-0 text-xs text-ink/50">{produit.statut}</span>
                    </div>
                    <p className="text-xs text-ink/50">
                      {nomCategorie.get(produit.categorie_id) ?? "—"}
                      {produit.vendeur_id && produit.vendeur_id !== VENDEUR_SACADO_ID ? " · marketplace" : ""}
                    </p>
                  </div>
                </div>
                <ChampCarte label="Prix / stock">
                  <EditPrixStock
                    id={produit.id}
                    prix={produit.prix}
                    stock={produit.stock}
                    prixAchat={produit.prix_achat}
                    nbKits={nbKits}
                  />
                </ChampCarte>
                <ChampCarte label="Publication">
                  {produit.prix_a_verifier ? (
                    <span className="font-medium text-red-600">prix à vérifier</span>
                  ) : (
                    produit.statut_publication
                  )}
                </ChampCarte>
                {nbKits > 0 && <ChampCarte label="Kits">{nbKits}</ChampCarte>}
                <div className="mt-1.5 flex justify-end gap-4 border-t border-ink/10 pt-2">
                  <Link
                    href={`/admin/produits/${produit.id}`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Fiche
                  </Link>
                  <PublierProduitButton id={produit.id} publie={produit.statut_publication === "publie"} />
                  <DeleteProduitButton id={produit.id} nom={produit.nom} />
                </div>
              </CarteListe>
            );
          })}
        </CartesListe>

      <TableauDesktop>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="w-8 px-4 py-3">
                <CaseToutSelectionner ids={produits.map((p) => p.id)} />
              </th>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium">Prix / stock</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Publication</th>
              <th className="px-4 py-3 font-medium">Kits</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {produits.map((produit) => {
              const nbKits = nbKitsParProduit.get(produit.id) ?? 0;
              return (
                <tr key={produit.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3">
                    <CaseSelection id={produit.id} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                      <ProductImage src={produit.photo} alt={produit.nom} className="h-full w-full" sizes="40px" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {produit.nom}
                    {produit.vendeur_id && produit.vendeur_id !== VENDEUR_SACADO_ID && (
                      <span className="ml-1.5 text-xs text-ink/40">marketplace</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {nomCategorie.get(produit.categorie_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <EditPrixStock
                      id={produit.id}
                      prix={produit.prix}
                      stock={produit.stock}
                      prixAchat={produit.prix_achat}
                      nbKits={nbKits}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink/60">{produit.statut}</td>
                  <td className="px-4 py-3">
                    {produit.prix_a_verifier ? (
                      <span className="font-medium text-red-600">prix à vérifier</span>
                    ) : (
                      <span className="text-ink/60">{produit.statut_publication}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{nbKits || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/produits/${produit.id}`} className="text-brand hover:underline">
                        Fiche
                      </Link>
                      <PublierProduitButton id={produit.id} publie={produit.statut_publication === "publie"} />
                      <DeleteProduitButton id={produit.id} nom={produit.nom} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableauDesktop>
        </SelectionMasseProvider>
      )}

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={hrefPage(page - 1)} className="text-brand hover:underline">
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink/40">Page {page}</span>
          {hasMore ? (
            <Link href={hrefPage(page + 1)} className="text-brand hover:underline">
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
