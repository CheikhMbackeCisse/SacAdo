// Cartes squelettes affichées pendant le chargement d'une page suivante
// (CORRECTIONS_V11 lot 2) — même grille que ProductGrid, pour ne pas faire
// « sauter » la mise en page quand les vrais produits arrivent.
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-elevated">
          <div className="aspect-square w-full animate-pulse bg-ink/5" />
          <div className="flex flex-1 flex-col gap-2 p-2">
            <div className="h-3 w-full animate-pulse rounded bg-ink/10" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-ink/10" />
            <div className="mt-auto flex items-center justify-between gap-2">
              <div className="h-3 w-10 animate-pulse rounded bg-ink/10" />
              <div className="size-7 shrink-0 animate-pulse rounded-full bg-ink/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
