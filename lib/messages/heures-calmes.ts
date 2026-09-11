// Heures calmes (TACHE_notifications_client.md §7) : aucune notification entre
// 22h et 7h. Dakar est en UTC toute l'année (pas d'heure d'été), donc l'heure
// UTC du serveur EST l'heure de Dakar — pas de conversion à faire. Fichier à
// part (pas de "server-only") pour rester testable sans Node ni Next.
export function heureCalmeDakar(date = new Date()): boolean {
  const h = date.getUTCHours();
  return h >= 22 || h < 7;
}
