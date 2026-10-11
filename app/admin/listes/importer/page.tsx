import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImporterListeForm } from "@/components/admin/importer-liste-form";

export default function ImporterListePage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/listes" className="flex w-fit items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" />
        Listes personnalisées
      </Link>
      <h1 className="font-heading text-xl font-bold text-ink">Importer une liste</h1>
      <p className="max-w-xl text-sm text-ink/60">
        Collez une liste de fournitures (par exemple transcrite depuis une photo par Claude ou une autre IA, ou
        tapée à la main) : un article par ligne. Chaque ligne est recherchée dans le catalogue, à vous de
        valider ou corriger avant de créer la liste.
      </p>
      <ImporterListeForm />
    </div>
  );
}
