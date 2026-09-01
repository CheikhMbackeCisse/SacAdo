import { getMesMessages } from "@/lib/vendeur/messages-actions";
import { BoiteReceptionVendeur } from "@/components/vendeur/boite-reception-vendeur";

export default async function MessagesVendeurPage() {
  const messages = await getMesMessages();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-[#001314]">Boîte de réception</h1>
      <BoiteReceptionVendeur messages={messages} />
    </div>
  );
}
