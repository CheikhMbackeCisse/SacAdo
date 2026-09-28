// Icônes SacAdo dessinées sur mesure, au même format que lucide-react (24 × 24, trait
// currentColor) : elles s'utilisent comme les autres icônes de l'app.
import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };

function Base({ size = 24, strokeWidth = 1.75, children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Liste de fournitures : porte-bloc, liste et coche. Pour « Envoyer ma liste de fournitures ». */
export function IconeListeFournitures(props: Props) {
  return (
    <Base {...props}>
      <path d="M8.5 4.5h-2A1.5 1.5 0 0 0 5 6v14.5A1.5 1.5 0 0 0 6.5 22h8l4-4v-3.5" />
      <path d="M15.5 4.5H17A1.5 1.5 0 0 1 18.5 6v1" />
      <rect x="8.5" y="3" width="7" height="3" rx="1" />
      <path d="M10.6 3v-.4a1.4 1.4 0 0 1 2.8 0V3" />
      <path d="M14.5 22v-3a1 1 0 0 1 1-1h3" />
      <circle cx="8.6" cy="10.5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="14" r=".7" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="17.5" r=".7" fill="currentColor" stroke="none" />
      <path d="M11 10.5h1.5M11 14h4M11 17.5h1.5" />
      <circle cx="18.5" cy="10.5" r="3.5" />
      <path d="m17 10.6 1.1 1.1 2-2.2" />
    </Base>
  );
}

/** Boîte de réception : enveloppe dans un bac. */
export function IconeBoiteReception(props: Props) {
  return (
    <Base {...props}>
      <path d="M5.5 12.5V5.8A1.8 1.8 0 0 1 7.3 4h9.4a1.8 1.8 0 0 1 1.8 1.8v6.7" />
      <path d="m6 4.6 5 4.3a1.6 1.6 0 0 0 2 0l5-4.3" />
      <path d="M5.5 9.5 3 13.5v5A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-5l-2.5-4" />
      <path d="M3 13.5h4.6a1 1 0 0 1 1 .9l.1.7a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.1-.7a1 1 0 0 1 1-.9H21" />
    </Base>
  );
}
