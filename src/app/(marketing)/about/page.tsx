import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Helios Recovery Residences was founded to give people in recovery a safe, structured, and dignified place to rebuild their lives.",
};

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 pb-8 pt-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          About Us
        </p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          Recovery, rooted in dignity
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          {siteConfig.name} exists for one reason: to give people in early
          recovery a safe, structured, and supportive place to build a life they
          are proud of.
        </p>
      </section>

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-base leading-relaxed text-muted-foreground sm:px-6">
        <p>
          Recovery does not happen in isolation. It happens in community — with
          accountability, routine, and people who believe in you. That belief is
          the foundation of every Helios home.
        </p>
        <p>
          We keep our homes clean, our expectations clear, and our doors open to
          anyone ready to do the work. Residents find not just a bed, but a
          network of peers and staff invested in their success.
        </p>
        <p>
          As we grow, our commitment stays the same: treat every person with
          respect, hold the line on safety and sobriety, and help each resident
          take the next right step.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Our mission",
              body: "Provide safe, substance-free housing that helps people sustain long-term recovery.",
            },
            {
              title: "Our values",
              body: "Dignity, accountability, community, and honesty in everything we do.",
            },
            {
              title: "Our promise",
              body: "A supportive environment where residents are seen, respected, and set up to succeed.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border bg-surface p-7"
            >
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl bg-foreground px-8 py-14 text-center sm:px-16">
          <h2 className="text-3xl font-semibold text-background">
            Have questions? We&apos;re here.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-background/70">
            Whether you&apos;re seeking housing for yourself or a loved one,
            reach out and we&apos;ll help.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contact" size="lg">
              Contact Helios
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
