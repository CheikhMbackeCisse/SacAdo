import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import {
  CYCLES,
  decouperClasseLycee,
  getCycleByValue,
  structurerLycee,
} from "@/lib/cycles";

export function generateStaticParams() {
  return CYCLES.map((c) => ({ cycle: c.value }));
}

export default async function CycleClassesPage(props: PageProps<"/kits/[cycle]">) {
  const { cycle } = await props.params;
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef) notFound();

  const estLycee = cycleDef.value === "lycee";

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
          {structurerLycee(cycleDef.classes).map((niv) => (
            <details key={niv.niveau} className="group rounded-2xl border border-ink/10 bg-elevated">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-ink">{niv.niveau}</span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-ink/40 transition-transform group-open:rotate-180"
                />
              </summary>

              <div className="flex flex-col gap-2 border-t border-ink/10 px-3 py-3">
                {niv.directes.map((classe) => (
                  <ClasseLien
                    key={classe}
                    href={`/kits/${cycleDef.value}/${encodeURIComponent(classe)}`}
                    label={classe}
                  />
                ))}

                {niv.groupes.map((groupe) => (
                  <details
                    key={groupe.type}
                    className="group/serie rounded-xl border border-ink/10 bg-surface"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">
                        {groupe.label}
                      </span>
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className="shrink-0 text-ink/40 transition-transform group-open/serie:rotate-180"
                      />
                    </summary>
                    <div className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1">
                      {groupe.classes.map((classe) => {
                        const { serie } = decouperClasseLycee(classe);
                        return (
                          <ClasseLien
                            key={classe}
                            href={`/kits/${cycleDef.value}/${encodeURIComponent(classe)}`}
                            label={`Série ${serie}`}
                            ariaLabel={classe}
                          />
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </details>
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
