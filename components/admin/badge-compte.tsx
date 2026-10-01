// Petit rond orange avec un nombre, pour signaler du nouveau sans qu'il faille
// ouvrir l'onglet (PROMPT_ADMIN Lot 2). Couleur action (#E07B39, cf. CLAUDE.md
// §4) réutilisée ici hors contexte "achat" — seul badge de nouveauté de l'admin.
export function BadgeCompte({ valeur }: { valeur: number }) {
  if (valeur <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-[#E07B39] px-1 text-[10px] font-bold leading-[18px] text-[#001314]">
      {valeur > 99 ? "99+" : valeur}
    </span>
  );
}
