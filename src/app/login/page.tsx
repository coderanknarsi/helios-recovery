import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Staff Login",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Staff sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Access the Helios Recovery operations dashboard.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          For staff use only. Contact your administrator for access.
        </p>
      </div>
    </main>
  );
}
