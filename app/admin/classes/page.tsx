import { getClassesAdmin } from "@/lib/admin/classes-actions";
import { ClassesManager } from "@/components/admin/classes-manager";

export default async function AdminClassesPage() {
  const classes = await getClassesAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Classes</h1>
      <p className="text-sm text-ink/50">
        Les classes affichées dans /kits, dans le profil « Mes sacados » et dans le sitemap.
      </p>
      <ClassesManager classes={classes} />
    </div>
  );
}
