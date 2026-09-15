import Link from "next/link";
import { getProduitsAVerifier } from "@/lib/admin/produits-actions";
import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { getSousCategoriesAdmin } from "@/lib/admin/sous-categories-actions";
import { formatPrice } from "@/lib/format";
import { LeverPrixAVerifierButton } from "@/components/admin/lever-prix-a-verifier-button";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";

export const dynamic = "force-dynamic";

export default async function AdminPrixAVerifierPage() {
  const [produits, categories, sousCategories] = await Promise.all([
    getProduitsAVerifier(),
    getCategoriesAdmin(),
    getSousCategoriesAdmin(),
  ]);
  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));
  const nomSousCategorie = new Map(sousCategories.map((s) => [s.id, s.nom]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Prix à vérifier</h1>
        <p className="mt-1 text-sm text-ink/55">
          Produits importés dont le prix d&apos;achat tombe sous le plancher de leur
          sous-catégorie — une anomalie probable du catalogue fournisseur (erreur de
          saisie, mauvais classement). Non publiables tant que le prix ou la
          catégorie n&apos;a pas été corrigé et le doute levé ici.
        </p>
      </div>

      {produits.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun prix à vérifier.
        </p>
      ) : (
        <CartesListe>
          {produits.map((produit) => (
            <CarteListe key={produit.id}>
              <p className="font-semibold text-ink">{produit.nom}</p>
              <ChampCarte label="Catégorie">
                {nomCategorie.get(produit.categorie_id) ?? "—"}
                {produit.sous_categorie_id ? ` › ${nomSousCategorie.get(produit.sous_categorie_id) ?? "—"}` : ""}
              </ChampCarte>
              <ChampCarte label="Prix d'achat">{formatPrice(produit.prix_achat ?? 0)}</ChampCarte>
              <ChampCarte label="Prix de vente">{formatPrice(produit.prix)}</ChampCarte>
              <div className="mt-1.5 flex justify-end gap-4 border-t border-ink/10 pt-2">
                <Link href={`/admin/produits/${produit.id}`} className="text-sm font-medium text-brand hover:underline">
                  Modifier
                </Link>
                <LeverPrixAVerifierButton id={produit.id} />
              </div>
            </CarteListe>
          ))}
        </CartesListe>
      )}

      <TableauDesktop>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium">Prix d&apos;achat</th>
              <th className="px-4 py-3 font-medium">Prix de vente</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {produits.map((produit) => (
              <tr key={produit.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink">{produit.nom}</td>
                <td className="px-4 py-3 text-ink/60">
                  {nomCategorie.get(produit.categorie_id) ?? "—"}
                  {produit.sous_categorie_id ? ` › ${nomSousCategorie.get(produit.sous_categorie_id) ?? "—"}` : ""}
                </td>
                <td className="px-4 py-3 text-ink/60">{formatPrice(produit.prix_achat ?? 0)}</td>
                <td className="px-4 py-3 text-ink/60">{formatPrice(produit.prix)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link href={`/admin/produits/${produit.id}`} className="text-brand hover:underline">
                      Modifier
                    </Link>
                    <LeverPrixAVerifierButton id={produit.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableauDesktop>
    </div>
  );
}
