// Détecte le mode app installée (`display-mode: standalone`, ou son ancienne
// équivalence iOS `navigator.standalone`). Utilisé par SplashScreen et
// WelcomeScreen : ces deux calques plein écran ne doivent jamais apparaître
// en navigateur normal (Search Console : le robot Google voyait une capture
// figée dessus, faute d'interagir comme un vrai utilisateur — humain ou
// robot, un navigateur classique ne tourne jamais en mode standalone).
export function estAppInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneIOS = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standaloneMediaQuery =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return standaloneIOS || standaloneMediaQuery;
}
