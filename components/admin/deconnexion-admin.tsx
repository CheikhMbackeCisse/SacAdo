import { LogOut } from "lucide-react";
import { signOut } from "@/lib/admin/auth-actions";

export function DeconnexionAdmin() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex w-full items-center gap-2.5 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left text-sm text-ink/70 transition-colors hover:bg-ink/5"
      >
        <LogOut size={17} aria-hidden="true" />
        Se déconnecter
      </button>
    </form>
  );
}
