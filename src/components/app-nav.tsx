"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups, primaryMobileHrefs, visibleGroups } from "@/lib/nav";

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
}

/** Desktop sidebar. */
export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const groups = visibleGroups(isAdmin);

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group, i) => (
        <div key={group.label ?? `group-${i}`} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Phone bottom bar. Four daily destinations plus More, because a horizontally
 * scrolling strip of twelve hid everything past the sixth item.
 */
export function AppMobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const all = navGroups.flatMap((g) => g.items);
  const primary = primaryMobileHrefs
    .map((href) => all.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => !!item)
    .filter((item) => isAdmin || !item.adminOnly);

  const onPrimary = primary.some((item) =>
    isActive(pathname, item.href, item.exact),
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex">
        {primary.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/app/more"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
            onPrimary ? "text-muted-foreground" : "text-primary",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </Link>
      </div>
    </nav>
  );
}
