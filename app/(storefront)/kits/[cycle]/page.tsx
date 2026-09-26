import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { getCycleByValue } from "@/lib/cycles";
import { getClassesLyceeAvecKits } from "@/lib/supabase/queries";
import { SERIES_LYCEE_A_VENIR } from "@/lib/kits";

export const revalidate = 120;

export default async function CycleClassesPage(props: PageProps<"/kits/[cycle]">) {
  const { cycle } = await props.params;
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef) notFound();

  const estLycee = cycleDef.value === "lycee";

  // Le lycée a des kits seulement pour Seconde/Première/Terminale x L/S (pas
  // le découpage fin L1/L2/S1/S2/T/G de lib/cycles.ts, utilisé ailleurs pour
  // d'autres besoins) : on part des classes qui ont réellement un kit publié.
  const classesLycee = estLycee ? await getClassesLyceeAvecKits() : [];
  const NIVEAU_ORDRE = ["Seconde", "Première", "Terminale"];
  const parNiveauLycee = new Map<string, string[]>();
  for (const classe of classesLycee) {
    const niveau = classe.split(" ")[0];
    parNiveauLycee.set(niveau, [...(parNiveauLycee.get(niveau) ?? []), classe]);
  }
  const niveauxLycee = [...parNiveauLycee.keys()].sort(
    (a, b) => NIVEAU_ORDRE.indexOf(a) - NIVEAU_ORDRE.indexOf(b),
  );

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
          <p className="text-sm text-ink/60">
            {estLycee ? "Choisis la classe, puis la série." : "Choisis la classe."}
          </p>
        </div>
      </div>

      {estLycee ? (
        <div className="flex flex-col gap-2.5">
          {niveauxLycee.map((niveau) => (
            <details key={niveau} className="group rounded-2xl border border-ink/10 bg-elevated">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-ink">{niveau}</span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-ink/40 transition-transform group-open:rotate-180"
                />
              </summary>

              <div className="flex flex-col gap-2 border-t border-ink/10 px-3 py-3">
                {(parNiveauLycee.get(niveau) ?? []).map((classe) => (
                  <ClasseLien
                    key={classe}
                    href={`/kits/${cycleDef.value}/${encodeURIComponent(classe)}`}
                    label={`Série ${classe.split(" ")[1]}`}
                    ariaLabel={classe}
                  />
                ))}
              </div>
            </details>
          ))}

          {SERIES_LYCEE_A_VENIR.map((s) => (
            <div
              key={s.serie}
              className="rounded-2xl border border-dashed border-ink/15 bg-elevated/50 px-4 py-3.5"
            >
              <span className="text-sm font-semibold text-ink/50">{s.libelle}</span>
              <p className="mt-0.5 text-xs text-ink/40">{s.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cycleDef.classes.map((niveau) => (
            <ClasseLien
              key={niveau}
              href={`/kits/${cycleDef.value}/${encodeURIComponent(niveau)}`}
              label={niveau}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClasseLien({
  href,
  label,
  ariaLabel,
}: {
  href: string;
  label: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group/lien flex items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-elevated px-4 py-3.5 transition-colors hover:border-brand active:scale-[0.99]"
    >
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand transition-transform group-hover/lien:translate-x-0.5">
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  );
}
