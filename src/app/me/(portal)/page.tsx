import { Logo } from "@/components/logo";
import { requireResident } from "@/lib/resident-access";
import { signOutResident } from "../actions";

export default async function ResidentHomePage() {
  const resident = await requireResident();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo />
        <form action={signOutResident}>
          <button
            type="submit"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-8 text-3xl font-semibold">
        Welcome, {resident.firstName}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {resident.houseName
          ? `${resident.houseName}${resident.bedLabel ? ` · ${resident.roomName ?? "Room"}, bed ${resident.bedLabel}` : ""}`
          : "Your placement is being finalized."}
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your documents, house information, and support resources will appear
          here soon.
        </p>
      </div>
    </main>
  );
}
