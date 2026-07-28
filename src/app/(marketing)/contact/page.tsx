import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact & Apply",
  description:
    "Apply for a bed or reach out to Helios Recovery Residences. We respond quickly and treat every inquiry with care and confidentiality.",
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Contact & Apply
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            Let&apos;s talk
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Fill out the form and our team will follow up. Every inquiry is
            handled with care and confidentiality.
          </p>

          <dl className="mt-10 space-y-5">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <dt className="text-sm font-medium">Email</dt>
                <dd>
                  <a
                    className="text-sm text-muted-foreground hover:text-foreground"
                    href={`mailto:${siteConfig.email}`}
                  >
                    {siteConfig.email}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <dt className="text-sm font-medium">Address</dt>
                <dd className="text-sm text-muted-foreground">
                  {siteConfig.address}
                </dd>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {siteConfig.location}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-7 sm:p-9">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
