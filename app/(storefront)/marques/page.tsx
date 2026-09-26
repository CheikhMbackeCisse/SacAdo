import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getMarques } from "@/lib/supabase/queries";
import { logoMarque } from "@/lib/marques";
import { slugify } from "@/lib/slug";
import { origineSite } from "@/lib/site-url";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const site = await origineSite();
  return {
    title: "Marques | SacAdo",
    description: "Toutes les marques disponibles sur SacAdo : fournitures scolaires et matériel d'étude.",
    alternates: { canonical: `${site}/marques` },
  };
}

export default async function MarquesPage() {
  const marques = await getMarques();

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 font-heading text-xl font-bold text-ink">Marques</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {marques.map(({ marque, count }) => {
          const logo = logoMarque(marque);
          return (
            <Link
              key={marque}
              href={`/marques/${slugify(marque)}`}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-elevated p-4 text-center transition-shadow hover:shadow-md active:scale-95"
            >
              {logo ? (
                <Image src={logo} alt={marque} width={96} height={32} className="h-8 w-auto object-contain" />
              ) : (
                <span className="font-heading text-base font-semibold text-ink">{marque}</span>
              )}
              <span className="text-xs text-ink/50">
                {count} article{count > 1 ? "s" : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
