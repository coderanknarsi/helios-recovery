import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { AppNav } from "@/components/app-nav";
import { getCurrentProfile } from "@/lib/auth";
import { signOutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen bg-surface-muted/30">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/app">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 px-3 py-4">
          <AppNav />
        </div>
        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-foreground">
              {profile.fullName ?? profile.email}
            </p>
            <p className="text-xs capitalize text-muted-foreground">
              {profile.role}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/app">
              <Logo />
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
          <AppNav orientation="horizontal" />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
