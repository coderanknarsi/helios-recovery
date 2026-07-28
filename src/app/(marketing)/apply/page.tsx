import type { Metadata } from "next";
import Link from "next/link";
import { Phone, ShieldCheck, Clock, HeartHandshake } from "lucide-react";
import { ApplicationForm } from "@/components/application-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Apply for a Bed",
  description:
    "Apply for a bed at Helios Recovery Residences. A short application to start the conversation — handled with care and confidentiality.",
};

const assurances = [
  { icon: Clock, text: "Takes about 5 minutes" },
  { icon: ShieldCheck, text: "Private & confidential" },
  { icon: HeartHandshake, text: "A real person follows up" },
];

export default function ApplyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          Apply for a Bed
        </p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          Start your application
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Recovery starts with a single step. Tell us a little about yourself
          and our team will reach out to talk through next steps. Everything you
          share is kept confidential.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
        {assurances.map((a) => (
          <span
            key={a.text}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <a.icon className="h-4 w-4 text-accent" />
            {a.text}
          </span>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-9">
        <ApplicationForm />
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Prefer to talk first?{" "}
        <Link href="/contact" className="font-medium text-foreground hover:underline">
          send a message
        </Link>
        .
      </p>
    </section>
  );
}
