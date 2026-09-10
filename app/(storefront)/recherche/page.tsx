import { rechercherProduits } from "@/lib/supabase/queries";
import { journaliserRechercheVide } from "@/lib/recherche/journal";
import { journaliserEvenement } from "@/lib/mesure";
import { ResultatsRecherche } from "@/components/search/resultats-recherche";

// Page dynamique par nature (dépend de searchParams). La recherche v2 est
// précise (ET obligatoire) : on affiche tous les résultats retenus, sans
// pagination « charger plus ».
export default async function RecherchePage(props: PageProps<"/recherche">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const resultats = query ? await rechercherProduits(query, { limite: 48 }) : [];

  if (query) {
    // Signal de classement « recherche » (poids 2).
    await journaliserEvenement({ type: "recherche", recherche: query });
    if (resultats.length === 0) {
      await journaliserRechercheVide(query);
    }
  }

  return (
    <div className="animate-fade-in-up py-4">
      <h1 className="px-4 pb-3 font-heading text-lg font-bold text-ink">
        {query ? `Résultats pour « ${query} »` : "Recherche"}
      </h1>
      <ResultatsRecherche query={query} resultats={resultats} />
    </div>
  );
}
