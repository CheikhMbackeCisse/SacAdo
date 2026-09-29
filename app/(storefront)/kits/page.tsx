import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CYCLES } from "@/lib/cycles";
import { DemanderProduit } from "@/components/demande/demander-produit";
import { FondDecor } from "@/components/ui/fond-decor";

export default function KitsPage() {
  return (
    <>
      {/* CORRECTIONS_V15 Lot 3 : FondDecor DOIT rester hors du div animé
          ci-dessous. `animate-fade-in-up` pose un `transform` (même
          translateY(0) en fin d'animation, fill-mode "both") qui devient le
          bloc de positionnement des descendants `position: fixed` — le fond
          se retrouvait alors limité à la hauteur du contenu au lieu de
          couvrir tout l'écran. */}
      <FondDecor variante="general" />
      <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">Kits scolaires</h1>
          <p className="text-sm text-ink/60">
            Choisis le niveau d&apos;enseignement, puis la classe.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CYCLES.map((cycle) => (
            <Link
              key={cycle.value}
              href={`/kits/${cycle.value}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-elevated transition-shadow hover:shadow-md active:scale-[0.98]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={cycle.image}
                  alt={cycle.label}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between gap-1 px-3 py-2.5">
                <span className="text-sm font-semibold text-ink">{cycle.label}</span>
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-brand transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          ))}
        </div>

        {/* maj-26-09 §8 : photo de la liste obligatoire, classe facultative. */}
        <DemanderProduit origine="liste_fournitures" variante="discret" />
      </div>
    </>
  );
}
