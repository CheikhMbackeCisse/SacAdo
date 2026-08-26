import { searchProduits } from "@/lib/supabase/queries";
import { SearchResults } from "@/components/search/search-results";

// Page dynamique par nature (dépend de searchParams, non cachable en ISR) :
// on se protège plutôt en limitant la taille de page (searchProduits pagine).
export default async function RecherchePage(props: PageProps<"/recherche">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { items: produits, hasMore } = query
    ? await searchProduits(query)
    : { items: [], hasMore: false };

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-lg font-bold text-ink">
        {query ? `Résultats pour « ${query} »` : "Recherche"}
      </h1>
      <SearchResults query={query} produitsInitiaux={produits} hasMoreInitial={hasMore} />
    </div>
  );
}
