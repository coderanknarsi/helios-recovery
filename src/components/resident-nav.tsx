"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, House, LifeBuoy, Sun } from "lucide-react";

const tabs = [
  { href: "/me", label: "Today", icon: Sun, exact: true },
  { href: "/me/documents", label: "Documents", icon: FileText },
  { href: "/me/house", label: "House", icon: House },
  { href: "/me/support", label: "Support", icon: LifeBuoy },
];

export function ResidentNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
      {/* Breathing room for iOS home-indicator gestures. */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
