import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CYCLES, getCycleByValue } from "@/lib/cycles";

export function generateStaticParams() {
  return CYCLES.map((c) => ({ cycle: c.value }));
}

// Pour le Lycée : regroupe les classes par niveau (Seconde / Première /
// Terminale) au lieu d'une liste plate de 12 séries.
const LYCEE_GROUPES = ["Seconde", "Première", "Terminale"];

function grouperClasses(cycle: string, classes: string[]) {
  if (cycle !== "lycee") return [{ titre: null as string | null, classes }];
  return LYCEE_GROUPES.map((titre) => ({
    titre,
    classes: classes.filter((c) => c.startsWith(`${titre} `)),
  })).filter((g) => g.classes.length > 0);
}

export default async function CycleClassesPage(props: PageProps<"/kits/[cycle]">) {
  const { cycle } = await props.params;
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef) notFound();

  const groupes = grouperClasses(cycle, cycleDef.classes);

  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
          <Image
            src={cycleDef.image}
            alt={cycleDef.label}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-brand">Kits scolaires</span>
          <h1 className="font-heading text-xl font-bold text-ink">{cycleDef.label}</h1>
          <p className="text-sm text-ink/60">Choisis la classe.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {groupes.map((groupe) => (
          <div key={groupe.titre ?? "classes"} className="flex flex-col gap-2">
            {groupe.titre && (
              <span className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                {groupe.titre}
              </span>
            )}
            <div className="flex flex-col gap-2">
              {groupe.classes.map((niveau) => (
                <Link
                  key={niveau}
                  href={`/kits/${cycleDef.value}/${encodeURIComponent(niveau)}`}
                  className="group flex items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-elevated px-4 py-3.5 transition-colors hover:border-brand active:scale-[0.99]"
                >
                  <span className="text-sm font-medium text-ink">{niveau}</span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand transition-transform group-hover:translate-x-0.5">
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
