import { getConfigPromoExpressAdmin } from "@/lib/admin/promo-express-actions";
import { PromoExpressEditor } from "@/components/admin/promo-express-editor";

export const dynamic = "force-dynamic";

export default async function AdminPromoExpressPage() {
  const config = await getConfigPromoExpressAdmin();

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Promo express</h1>
        <p className="mt-1 text-sm text-ink/55">
          Les jours choisis, avant l&apos;heure limite, la livraison express coûte le même prix
          que la livraison à date donnée.
        </p>
      </div>
      <PromoExpressEditor initial={config} />
    </div>
  );
}
