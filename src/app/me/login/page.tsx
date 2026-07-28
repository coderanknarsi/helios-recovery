import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getResidentSession } from "@/lib/resident-access";
import { siteConfig } from "@/lib/site";
import { ResidentLoginForm } from "./resident-login-form";

export const metadata: Metadata = {
  title: "Resident Sign In",
  robots: { index: false, follow: false },
};

export default async function ResidentLoginPage() {
  if (await getResidentSession()) redirect("/me");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Resident sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your house documents, rules, and support in one place.
          </p>
          <div className="mt-6">
            <ResidentLoginForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Trouble signing in? Contact your house manager or email{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            className="font-medium text-primary hover:text-primary-hover"
          >
            {siteConfig.email}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
