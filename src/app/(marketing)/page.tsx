import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  HeartHandshake,
  Users,
  ClipboardCheck,
  CalendarClock,
  HomeIcon,
  ArrowRight,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  description: siteConfig.description,
};

const values = [
  {
    icon: ShieldCheck,
    title: "Safe & Structured",
    body: "Clear house rules, accountability, and regular check-ins create the stability early recovery depends on.",
  },
  {
    icon: HeartHandshake,
    title: "Genuinely Supportive",
    body: "Peer support and staff who have walked the path. You are never doing this alone.",
  },
  {
    icon: Users,
    title: "Community First",
    body: "Shared meals, house meetings, and mutual respect build the connection that sustains sobriety.",
  },
];

const steps = [
  {
    icon: ClipboardCheck,
    title: "Apply",
    body: "Submit a short application. We respond quickly and walk you through what to expect.",
  },
  {
    icon: HomeIcon,
    title: "Move In",
    body: "Get matched to an open bed in a welcoming, substance-free home.",
  },
  {
    icon: CalendarClock,
    title: "Build Your Routine",
    body: "Meetings, work or school, chores, and check-ins that keep recovery on track.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(217,119,6,0.14),transparent_60%)]"
        />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Now welcoming new residents
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight sm:text-6xl">
              A brighter path to lasting recovery
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              {siteConfig.name} provides safe, structured, and supportive sober
              living homes where people rebuild their lives — one steady day at a
              time.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/apply" size="lg">
                Apply for a Bed
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/features" size="lg" variant="outline">
                See Our Homes
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-surface-muted/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          {[
            { value: "24/7", label: "Peer support" },
            { value: "100%", label: "Substance-free homes" },
            { value: "Weekly", label: "Drug screening" },
            { value: "Daily", label: "Recovery structure" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-serif text-3xl font-semibold text-primary sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Recovery works best with the right environment
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything about a Helios home is designed to help you focus on what
            matters most — staying sober and moving forward.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-xl border border-border bg-surface p-7 shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Getting started is simple
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Three steps from your first call to a stable place to grow.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-xl border border-border bg-surface p-7"
              >
                <span className="absolute right-6 top-6 font-serif text-4xl font-semibold text-border">
                  {i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="overflow-hidden rounded-2xl bg-foreground px-8 py-14 text-center sm:px-16">
          <h2 className="text-balance text-3xl font-semibold text-background sm:text-4xl">
            Ready to take the next step?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-background/70">
            Reach out today. We&apos;ll help you understand your options and find
            a bed that fits.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/apply" size="lg">
              Apply for a Bed
            </ButtonLink>
            <Link
              href={`tel:${siteConfig.phone}`}
              className="text-sm font-medium text-background/80 hover:text-background"
            >
              or call {siteConfig.phone}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
