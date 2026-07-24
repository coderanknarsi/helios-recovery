import type { Metadata } from "next";
import {
  BedDouble,
  Utensils,
  Wifi,
  Bus,
  ClipboardList,
  Users,
  ShieldCheck,
  CalendarCheck,
  TestTube,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Our Homes",
  description:
    "Structured, substance-free sober living homes with the accountability, amenities, and community that support lasting recovery.",
};

const amenities = [
  { icon: BedDouble, label: "Comfortable furnished bedrooms" },
  { icon: Utensils, label: "Fully equipped shared kitchens" },
  { icon: Wifi, label: "High-speed Wi-Fi throughout" },
  { icon: Bus, label: "Near transit, meetings & work" },
  { icon: Sparkles, label: "Clean, well-maintained homes" },
  { icon: Users, label: "Supportive peer community" },
];

const program = [
  {
    icon: ShieldCheck,
    title: "Clear house rules",
    body: "A written agreement every resident signs at move-in — so expectations are transparent from day one.",
  },
  {
    icon: TestTube,
    title: "Regular drug & alcohol screening",
    body: "Random and scheduled testing protects everyone's recovery and keeps the home substance-free.",
  },
  {
    icon: CalendarCheck,
    title: "Meeting attendance",
    body: "Residents stay connected to 12-step or other recovery meetings, tracked and supported by staff.",
  },
  {
    icon: ClipboardList,
    title: "Chores & accountability",
    body: "Shared responsibilities and check-ins build the daily structure that recovery depends on.",
  },
  {
    icon: Users,
    title: "House meetings",
    body: "Regular meetings give residents a voice and keep the community strong and connected.",
  },
  {
    icon: CalendarCheck,
    title: "Passes & curfews",
    body: "Overnight and day passes with a simple request process balance freedom with accountability.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-20 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Our Homes
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            Structure and support under one roof
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Every Helios residence combines a comfortable place to live with the
            accountability and community that make recovery stick.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold">What&apos;s included</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.map((a) => (
            <div
              key={a.label}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <a.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{a.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold">Our recovery program</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A proven framework that keeps residents accountable while treating
              them with dignity and respect.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {program.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-border bg-surface p-7"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <h2 className="text-3xl font-semibold">See if Helios is right for you</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Beds fill quickly. Submit an application and our team will follow up
            to talk through the details.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contact" size="lg">
              Apply for a Bed
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
