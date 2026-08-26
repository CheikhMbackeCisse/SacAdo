import Link from "next/link";
import { CategoryTile } from "@/components/category/category-tile";
import { CATEGORIES } from "@/lib/categories";

export default function CategoriesPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 font-heading text-xl font-bold text-ink">Catégories</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((categorie) => (
          <Link
            key={categorie.slug}
            href={categorie.href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-white p-4 text-center transition-shadow hover:shadow-md active:scale-95"
          >
            <CategoryTile categorie={categorie} tileClassName="size-14" iconSize={26} />
            <span className="text-sm font-medium text-ink">{categorie.nom}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
