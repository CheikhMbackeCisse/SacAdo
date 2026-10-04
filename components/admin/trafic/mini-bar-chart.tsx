// Courbe par jour en barres CSS pures (PROMPT_ADMIN_V2 Lot 3) : pas de
// librairie de graphiques, pour rester léger sur une page admin consultée
// en 4G. Purement présentationnel, aucun état.
export function MiniBarChart({
  points,
}: {
  points: { jour: string; valeur: number }[];
}) {
  if (points.length === 0) {
    return <p className="text-xs text-ink/40">Pas encore de données sur cette période.</p>;
  }
  const max = Math.max(1, ...points.map((p) => p.valeur));

  return (
    <div className="flex h-24 items-end gap-1">
      {points.map((p) => (
        <div key={p.jour} className="flex flex-1 flex-col items-center gap-1" title={`${p.jour} : ${p.valeur}`}>
          <div
            className="w-full rounded-t bg-brand/70"
            style={{ height: `${Math.max(4, Math.round((p.valeur / max) * 100))}%` }}
          />
          <span className="text-[9px] text-ink/40">{p.jour.slice(5).replace("-", "/")}</span>
        </div>
      ))}
    </div>
  );
}
