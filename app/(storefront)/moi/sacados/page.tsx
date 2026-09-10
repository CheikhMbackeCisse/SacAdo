"use client";

import { SacadosSection } from "@/components/moi/sacados-section";

export default function SacadosPage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-4 px-4 py-4">
      <h1 className="font-heading text-lg font-bold text-ink">Mes sacados</h1>
      <SacadosSection />
    </div>
  );
}
