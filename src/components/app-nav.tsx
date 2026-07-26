"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Building2,
  CalendarRange,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
};

const items: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    href: "/app/admissions",
    label: "Admissions",
    icon: UserPlus,
    adminOnly: true,
  },
  { href: "/app/residents", label: "Residents", icon: Users },
  { href: "/app/availability", label: "Availability", icon: CalendarRange },
  { href: "/app/property", label: "Property", icon: Building2 },
  { href: "/app/team", label: "Team", icon: UserCog, adminOnly: true },
];

export function AppNav({
  orientation = "vertical",
  isAdmin = false,
}: {
  orientation?: "vertical" | "horizontal";
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => isAdmin || !item.adminOnly);

  return (
    <nav
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto"
      )}
    >
      {visible.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
