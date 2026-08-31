import Image from "next/image";
import { VendeurLoginForm } from "@/components/vendeur/vendeur-login-form";

export default function VendeurConnexionPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Image
        src="/images/bg-page-form.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(254,253,255,0.94)_0%,rgba(254,253,255,0.75)_55%,rgba(254,253,255,0.45)_100%)]"
      />
      <div className="relative z-10">
        <VendeurLoginForm />
      </div>
    </div>
  );
}
