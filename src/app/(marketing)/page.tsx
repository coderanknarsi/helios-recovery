import type { Metadata } from "next";
import {
  ShieldCheck,
  HeartHandshake,
  Users,
  ClipboardCheck,
  CalendarClock,
  HomeIcon,
  ArrowRight,
  MessagesSquare,
  Compass,
  Sprout,
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

const socialModel = [
  {
    icon: Users,
    title: "Lived experience leads",
    body: "The most useful guidance usually comes from someone a few steps further down the same road, not from a credential on a wall. Peers who have done this work set the tone here.",
  },
  {
    icon: MessagesSquare,
    title: "The house belongs to the people in it",
    body: "Residents take part in house meetings, share the chores, and hold each other to standards they helped set. Accountability from your peers lands differently than accountability handed down from above.",
  },
  {
    icon: Compass,
    title: "A base, not a bubble",
    body: "Meetings, sponsors, jobs, service work, family. The point of a stable home is that it makes the rest of life possible again — so we push you outward, not inward.",
  },
  {
    icon: Sprout,
    title: "Recovery capital compounds",
    body: "Steady work, mended relationships, a place of your own, a reason to get up. These accumulate quietly, and they are what keeps recovery standing once the structure comes off.",
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
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-foreground/80">
              {siteConfig.location} from our first home at {siteConfig.address}.
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

      {/* Social model of recovery */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
              Our approach
            </span>
            <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">
              Built on the social model of recovery
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              We follow the social model of recovery — the philosophy the
              National Alliance for Recovery Residences (NARR) built its
              standards around. It rests on a plain observation: people tend to
              get well in the company of other people who are getting well.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              In that model the home itself is what does the work. Not a
              curriculum, not a clinician, not a schedule imposed from outside —
              but an environment where sobriety is simply the norm, where the
              people around you understand precisely what you are up against,
              and where the ordinary business of daily life becomes practice for
              living well.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {socialModel.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-border bg-surface p-7 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            ))}
          </div>

          {/* Being clear about scope matters both ethically and legally. */}
          <div className="mt-10 rounded-xl border border-border bg-surface-muted/60 p-7">
            <h3 className="text-lg font-semibold">
              To be clear about what this is
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              A recovery residence is a place to live, not a treatment program.
              We do not provide detox, therapy, or medical care, and we do not
              pretend to. If treatment is what you need right now, tell us and
              we will help you find it — and there will be a place for you here
              when you are ready for this part.
            </p>
          </div>
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
          </div>
        </div>
      </section>
    </>
  );
}
