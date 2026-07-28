import { AlertTriangle, MessageSquare, Phone } from "lucide-react";
import { requireResident } from "@/lib/resident-access";
import { siteConfig } from "@/lib/site";
import { signOutResident } from "../../actions";

export const dynamic = "force-dynamic";

type Resource = {
  name: string;
  detail: string;
  action: string;
  href: string;
  icon: typeof Phone;
};

/** Public crisis lines. Always available, no account or insurance needed. */
const crisisResources: Resource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    detail: "24/7 support for suicidal thoughts, crisis, or emotional distress.",
    action: "Call or text 988",
    href: "tel:988",
    icon: Phone,
  },
  {
    name: "Your Life Iowa",
    detail: "Iowa's line for addiction, mental health, and crisis support.",
    action: "Call 855-581-8111",
    href: "tel:8555818111",
    icon: Phone,
  },
  {
    name: "Crisis Text Line",
    detail: "Text with a trained crisis counselor, 24/7.",
    action: "Text HOME to 741741",
    href: "sms:741741?&body=HOME",
    icon: MessageSquare,
  },
  {
    name: "SAMHSA National Helpline",
    detail: "Free, confidential treatment referrals, 24/7.",
    action: "Call 1-800-662-4357",
    href: "tel:18006624357",
    icon: Phone,
  },
];

export default async function ResidentSupportPage() {
  const me = await requireResident();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are not alone. Reaching out is a strength, not a violation.
        </p>
      </div>

      <a
        href="tel:911"
        className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="text-sm font-semibold text-red-700">
            Life-threatening emergency? Call 911
          </p>
          <p className="text-xs text-red-700/80">
            Overdose, injury, or immediate danger. Call first, tell staff after.
          </p>
        </div>
      </a>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Crisis &amp; recovery lines</h2>
        {crisisResources.map((r) => {
          const Icon = r.icon;
          return (
            <a
              key={r.name}
              href={r.href}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.detail}
                </p>
                <p className="mt-1.5 text-sm font-medium text-primary">
                  {r.action}
                </p>
              </div>
            </a>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold">Your house team</h2>
        {me.housePhone ? (
          <a
            href={`tel:${me.housePhone.replace(/[^\d+]/g, "")}`}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-hover"
          >
            <Phone className="h-4 w-4 shrink-0" />
            {me.houseName ?? "House"} · {me.housePhone}
          </a>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Contact your house manager directly, or email us below.
          </p>
        )}
        <a
          href={`mailto:${siteConfig.email}`}
          className="mt-2 block text-sm font-medium text-primary transition hover:text-primary-hover"
        >
          {siteConfig.email}
        </a>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold">Your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {me.firstName} {me.lastName}
          {me.phone ? ` · ${me.phone}` : ""}.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          You&rsquo;ll stay signed in on this device. If you sign out,
          you&rsquo;ll need a new text code to get back in.
        </p>
        <form action={signOutResident} className="mt-4">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition hover:border-red-300 hover:text-red-600"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
