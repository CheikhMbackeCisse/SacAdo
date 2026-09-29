// Détection robots/outils de test — la fenêtre d'installation Android ne doit
// jamais s'afficher pour ces visiteurs (Search Console "Tester l'URL en
// direct", Lighthouse, PageSpeed, crawlers publicitaires…). Pure, testable.

const MOTIFS_ROBOTS = [
  "googlebot",
  "adsbot-google",
  "mediapartners-google",
  "google-inspectiontool",
  "storebot-google",
  "lighthouse",
  "headlesschrome",
  "bot",
  "crawler",
  "spider",
];

export function userAgentEstRobot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return MOTIFS_ROBOTS.some((motif) => ua.includes(motif));
}

export function estRobot(userAgent: string, webdriver: boolean): boolean {
  return webdriver || userAgentEstRobot(userAgent);
}
