import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAccess } from "@/lib/access";
import { visibleGroups } from "@/lib/nav";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const { isAdmin } = await getAccess();
  const groups = visibleGroups(isAdmin);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Everything else</h1>

      {groups.map((group, i) => (
        <section key={group.label ?? `group-${i}`}>
          {group.label && (
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h2>
          )}
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
