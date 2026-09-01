import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

// Icône d'une entrée de navigation. Si l'entrée fournit une image (PNG fourni
// par la marque), on l'affiche en masque CSS teinté par `currentColor` : les
// états actif / inactif se colorent alors comme les icônes lucide. Sinon on
// retombe sur l'icône lucide de l'entrée.
export function NavIcon({
  img,
  icon: Icon,
  size,
  className,
}: {
  img?: string;
  icon: LucideIcon;
  size: number;
  className?: string;
}) {
  if (img) {
    const mask: CSSProperties = {
      width: size,
      height: size,
      maskImage: `url("${img}")`,
      WebkitMaskImage: `url("${img}")`,
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskPosition: "center",
    };
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 bg-current ${className ?? ""}`}
        style={mask}
      />
    );
  }
  return <Icon size={size} aria-hidden="true" className={className} />;
}
