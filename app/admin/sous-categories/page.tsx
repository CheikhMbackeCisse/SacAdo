import { redirect } from "next/navigation";

// Les sous-catégories (et le 3e niveau optionnel) se gèrent désormais avec les
// catégories, au même endroit (SOUS_SOUS_CATEGORIES.md §4). Redirection plutôt
// que suppression pure : un lien ou un favori existant vers cet écran continue
// de fonctionner.
export default function AdminSousCategoriesPage() {
  redirect("/admin/categories");
}
