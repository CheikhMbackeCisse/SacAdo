import {
  getClassementApercu,
  getClassementManuel,
  getConfigClassement,
  getRendementExploration,
  getSaisonsAdmin,
} from "@/lib/admin/classement-actions";
import { ClassementPanneau } from "@/components/admin/classement-panneau";

export const dynamic = "force-dynamic";

export default async function AdminClassementPage() {
  const [config, top, manuel, saisonsData, rendement] = await Promise.all([
    getConfigClassement(),
    getClassementApercu(20),
    getClassementManuel(),
    getSaisonsAdmin(),
    getRendementExploration(30),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Classement de l&apos;accueil</h1>
        <p className="mt-1 text-sm text-ink/55">
          Le score global est recalculé chaque nuit à 3h à partir des signaux des visiteurs
          (conversion, saison, marge, fraîcheur). L&apos;affinité de chaque personne le module
          ensuite à l&apos;affichage. Tout se règle ici.
        </p>
      </div>
      <ClassementPanneau
        config={config}
        top={top}
        manuel={manuel}
        saisons={saisonsData.saisons}
        categories={saisonsData.categories}
        rendement={rendement}
      />
    </div>
  );
}
