"use client";

// Logo SacAdo animé pour l'écran de démarrage.
// SVG + CSS, aucune bibliothèque. Le sac et le mot « SacAdo » sont dessinés dans le code :
// ils s'animent dès le premier affichage, sans rien télécharger.
// Les 7 photos d'objets (cahiers, stylos, calculatrice, kit de traçage, tablette, tableau,
// Arduino) sont dans UNE seule image WebP de 68 Ko (/images/splash/objets-v1.webp),
// préchargée en priorité. Elles rejoignent l'animation dès qu'elles sont décodées,
// synchronisées sur le temps déjà écoulé : si l'image arrive en retard (connexion lente),
// les objets déjà passés sont sautés, jamais d'attente ni de saccade. Si elle n'arrive pas,
// l'animation se joue sans objets. Aux visites suivantes l'image est en cache.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { preload } from "react-dom";

export const SPRITE_OBJETS = "/images/splash/objets-v1.webp";
export const DUREE_ANIMATION_LOGO_MS = 6600;

const CSS = `.sa-logo{overflow:visible}
.sa-sac,.sa-mot,.sa-obj{transform-box:view-box}
.sa-sac,.sa-mot{transform-origin:640px 700px}
.sa-obj{transform-origin:0 0;opacity:0}
.sa-mot{transform:translateY(-115px)}
.sa-anime .sa-sac{animation:sa-sac 6.6s cubic-bezier(.2,.8,.2,1) both}
.sa-anime .sa-mot{animation:sa-mot 6.6s linear both}
.sa-anime.sa-avec-objets .sa-obj{will-change:transform,opacity}
.sa-anime.sa-avec-objets .sa-o0{animation:sa-o0 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o0{0%,20.2%{opacity:0;transform:translate(902px,138px) scale(0.2)}23.2%{opacity:1;transform:translate(902px,138px) scale(1.12)}25.7%{opacity:1;transform:translate(902px,138px) scale(1)}30.2%{opacity:1;transform:translate(902px,138px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}36.7%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
.sa-anime.sa-avec-objets .sa-o1{animation:sa-o1 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o1{0%,28.7%{opacity:0;transform:translate(1243px,555px) scale(0.2)}31.7%{opacity:1;transform:translate(1243px,555px) scale(1.12)}34.2%{opacity:1;transform:translate(1243px,555px) scale(1)}38.7%{opacity:1;transform:translate(1243px,555px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}45.2%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
.sa-anime.sa-avec-objets .sa-o2{animation:sa-o2 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o2{0%,37.3%{opacity:0;transform:translate(1130px,1080px) scale(0.2)}40.3%{opacity:1;transform:translate(1130px,1080px) scale(1.12)}42.8%{opacity:1;transform:translate(1130px,1080px) scale(1)}47.3%{opacity:1;transform:translate(1130px,1080px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}53.8%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
.sa-anime.sa-avec-objets .sa-o3{animation:sa-o3 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o3{0%,45.9%{opacity:0;transform:translate(648px,1320px) scale(0.2)}48.9%{opacity:1;transform:translate(648px,1320px) scale(1.12)}51.4%{opacity:1;transform:translate(648px,1320px) scale(1)}55.9%{opacity:1;transform:translate(648px,1320px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}62.4%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
.sa-anime.sa-avec-objets .sa-o4{animation:sa-o4 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o4{0%,53.3%{opacity:0;transform:translate(160px,1093px) scale(0.2)}56.3%{opacity:1;transform:translate(160px,1093px) scale(1.12)}58.8%{opacity:1;transform:translate(160px,1093px) scale(1)}63.3%{opacity:1;transform:translate(160px,1093px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}69.8%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
.sa-anime.sa-avec-objets .sa-o5{animation:sa-o5 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o5{0%,60.6%{opacity:0;transform:translate(34px,570px) scale(0.2)}63.6%{opacity:1;transform:translate(34px,570px) scale(1.12)}66.1%{opacity:1;transform:translate(34px,570px) scale(1)}70.6%{opacity:1;transform:translate(34px,570px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}77.1%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
.sa-anime.sa-avec-objets .sa-o6{animation:sa-o6 6.6s linear both;animation-delay:var(--sa-decalage,0ms)}
@keyframes sa-o6{0%,67.5%{opacity:0;transform:translate(364px,145px) scale(0.2)}70.5%{opacity:1;transform:translate(364px,145px) scale(1.12)}73.0%{opacity:1;transform:translate(364px,145px) scale(1)}77.5%{opacity:1;transform:translate(364px,145px) scale(1);animation-timing-function:cubic-bezier(.5,0,.9,.4)}84.0%,100%{opacity:0;transform:translate(640px,790px) scale(0.1)}}
@keyframes sa-sac{0%{opacity:0;transform:scale(.55)}12%{opacity:1;transform:scale(1.04)}17%{transform:scale(1)}35.7%{transform:scale(1)}37.7%{transform:scale(1.02)}39.2%{transform:scale(1)}44.2%{transform:scale(1)}46.2%{transform:scale(1.02)}47.7%{transform:scale(1)}52.8%{transform:scale(1)}54.8%{transform:scale(1.02)}56.3%{transform:scale(1)}61.4%{transform:scale(1)}63.4%{transform:scale(1.02)}64.9%{transform:scale(1)}68.8%{transform:scale(1)}70.8%{transform:scale(1.02)}72.3%{transform:scale(1)}75%{transform:scale(1)}78%{transform:scale(1.035,.965)}84%{transform:scale(1.02)}88%{transform:scale(.99,1.01)}100%{opacity:1;transform:scale(1)}}
@keyframes sa-mot{0%,15%{opacity:0;transform:rotate(-360deg) translateY(-540px) rotate(360deg) scale(.7)}20%{opacity:1;transform:rotate(-330deg) translateY(-540px) rotate(330deg) scale(.75)}30%{transform:rotate(-270deg) translateY(-540px) rotate(270deg) scale(.8)}45%{transform:rotate(-180deg) translateY(-520px) rotate(180deg) scale(.85)}58%{transform:rotate(-90deg) translateY(-430px) rotate(90deg) scale(.92);animation-timing-function:ease-in}70%{transform:rotate(0deg) translateY(-190px) rotate(0deg) scale(1.08);animation-timing-function:ease-out}77%{transform:rotate(0deg) translateY(-108px) rotate(0deg) scale(.96)}85%{transform:rotate(0deg) translateY(-119px) rotate(0deg) scale(1.02)}100%{opacity:1;transform:rotate(0deg) translateY(-115px) rotate(0deg) scale(1)}}
@media (prefers-reduced-motion:reduce){.sa-anime .sa-sac,.sa-anime .sa-mot,.sa-anime .sa-obj{animation:none}}
.sa-boucle{transform-origin:50% 54%;animation:sa-pulse 1.4s ease-in-out infinite}
@keyframes sa-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){.sa-boucle{animation:none}}`;

const SVG = `<defs>
<linearGradient id="saCorps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3079EC"/><stop offset="1" stop-color="#1A5AC5"/></linearGradient>
<linearGradient id="saPoche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3580F2"/><stop offset="1" stop-color="#1C5CC8"/></linearGradient>
<linearGradient id="saBretelle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3881EF"/><stop offset="1" stop-color="#2166D6"/></linearGradient>
</defs>
<g class="sa-sac">
<path d="M566 300V228a74 74 0 0 1 148 0v72" fill="none" stroke="#2C76E1" stroke-width="40" stroke-linecap="round"/>
<path d="M470 292C432 250 378 248 350 286C330 314 332 356 342 440" fill="none" stroke="url(#saBretelle)" stroke-width="70" stroke-linecap="round"/>
<path d="M810 292C848 250 902 248 930 286C950 314 948 356 938 440" fill="none" stroke="url(#saBretelle)" stroke-width="70" stroke-linecap="round"/>
<path d="M296 560C296 372 430 262 640 262S984 372 984 560L987 1048Q987 1142 892 1142H388Q293 1142 293 1048Z" fill="#1450B5"/>
<path d="M316 562C316 390 440 288 640 288S964 390 964 562L967 1030Q967 1114 884 1114H396Q313 1114 313 1030Z" fill="url(#saCorps)"/>
<rect x="322" y="752" width="636" height="352" rx="72" fill="#1552B8" opacity=".55"/>
<rect x="322" y="740" width="636" height="352" rx="72" fill="url(#saPoche)"/>
</g>
<g class="sa-obj sa-o0"><svg x="-290" y="-290" width="580" height="580" viewBox="0 0 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-obj sa-o1"><svg x="-290" y="-290" width="580" height="580" viewBox="240 0 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-obj sa-o2"><svg x="-290" y="-290" width="580" height="580" viewBox="480 0 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-obj sa-o3"><svg x="-290" y="-290" width="580" height="580" viewBox="720 0 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-obj sa-o4"><svg x="-290" y="-290" width="580" height="580" viewBox="0 240 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-obj sa-o5"><svg x="-290" y="-290" width="580" height="580" viewBox="240 240 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-obj sa-o6"><svg x="-290" y="-290" width="580" height="580" viewBox="480 240 240 240"><image href="/images/splash/objets-v1.webp" width="960" height="480"/></svg></g><g class="sa-mot">
<text x="640" y="700" text-anchor="middle" dominant-baseline="central" font-family="var(--font-heading), Inter, Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="142" textLength="505" lengthAdjust="spacingAndGlyphs" fill="#F2F8FF">SacAdo</text>
</g>
`;

type Props = {
  className?: string;
  /** false = logo final immobile (prefers-reduced-motion) */
  anime?: boolean;
  /** appelé quand le mot « SacAdo » s'est posé sur le sac */
  onFin?: () => void;
  /** true = l'intro est finie mais l'app charge encore : le logo « respire » en boucle */
  enBoucle?: boolean;
};

export function LogoAnime({ className = "", anime = true, onFin, enBoucle = false }: Props) {
  preload(SPRITE_OBJETS, { as: "image", fetchPriority: "high" });
  const ref = useRef<SVGSVGElement>(null);
  const [objets, setObjets] = useState<{ decalage: number } | null>(null);

  useEffect(() => {
    if (!anime) return;
    let annule = false;
    const img = new Image();
    img.src = SPRITE_OBJETS;
    img
      .decode()
      .then(() => {
        if (annule || !ref.current) return;
        const mot = ref.current.querySelector(".sa-mot");
        const anim = mot && "getAnimations" in mot ? (mot as Element).getAnimations()[0] : undefined;
        const ecoule = typeof anim?.currentTime === "number" ? anim.currentTime : null;
        // Trop tard (tous les objets seraient déjà passés) ou API absente : pas d'objets.
        if (ecoule === null || ecoule > DUREE_ANIMATION_LOGO_MS * 0.7) return;
        setObjets({ decalage: -ecoule });
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [anime]);

  const classes = ["sa-logo", anime ? "sa-anime" : "", objets ? "sa-avec-objets" : "", enBoucle ? "sa-boucle" : "", className].filter(Boolean).join(" ");

  return (
    <>
      <style>{CSS}</style>
      <svg
        ref={ref}
        className={classes}
        style={objets ? ({ "--sa-decalage": `${objets.decalage}ms` } as CSSProperties) : undefined}
        viewBox="0 0 1280 1280"
        role="img"
        aria-label="SacAdo"
        onAnimationEnd={(e) => {
          if ((e.target as Element).classList?.contains("sa-mot")) onFin?.();
        }}
        dangerouslySetInnerHTML={{ __html: SVG }}
      />
    </>
  );
}
