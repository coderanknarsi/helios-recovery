import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { InstallGuide } from "@/components/install-guide";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Get the Resident App",
  description:
    "Add the Helios Recovery resident portal to your phone's home screen.",
  robots: { index: false, follow: false },
};

export default function InstallPage() {
  return (
    <main className="flex min-h-screen flex-col bg-surface-muted/40 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Get the resident app</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Takes about thirty seconds. There&rsquo;s nothing to download from
            an app store.
          </p>
        </div>

        <InstallGuide />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Stuck? Ask your house manager or email{" "}
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
