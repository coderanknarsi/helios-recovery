import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  Siren,
  Sun,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  description?: string;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

/**
 * Grouped by how often a house manager touches them, not by how the app is
 * built. "Daily" has to fit on a phone screen; everything else can be a tap
 * further away.
 */
export const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: "/app",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
        description: "How the program is doing overall",
      },
    ],
  },
  {
    label: "Daily",
    items: [
      {
        href: "/app/today",
        label: "Today",
        icon: Sun,
        description: "Rent, drug tests, chores and what's on",
      },
      {
        href: "/app/residents",
        label: "Residents",
        icon: Users,
        description: "Everyone in the program",
      },
      {
        href: "/app/billing",
        label: "Rent",
        icon: Wallet,
        description: "Balances, payments and promises to pay",
      },
      {
        href: "/app/chores",
        label: "Chores",
        icon: ClipboardCheck,
        description: "This week's assignments",
      },
      {
        href: "/app/grievances",
        label: "Concerns",
        icon: MessagesSquare,
        description: "Grievances residents have raised",
      },
      {
        href: "/app/schedule",
        label: "Schedule",
        icon: CalendarDays,
        description: "Weekly meetings and one-off events",
      },
    ],
  },
  {
    label: "Beds and intake",
    items: [
      {
        href: "/app/admissions",
        label: "Admissions",
        icon: UserPlus,
        adminOnly: true,
        description: "Applications and the waitlist",
      },
      {
        href: "/app/availability",
        label: "Availability",
        icon: CalendarRange,
        description: "Who is arriving and leaving",
      },
      {
        href: "/app/property",
        label: "Property",
        icon: Building2,
        description: "Houses, rooms, beds and rates",
      },
      {
        href: "/app/drills",
        label: "Safety",
        icon: Siren,
        description: "Drill log and emergency readiness",
      },
    ],
  },
  {
    label: "Setup",
    items: [
      {
        href: "/app/documents",
        label: "Documents",
        icon: FileText,
        adminOnly: true,
        description: "Templates residents sign",
      },
      {
        href: "/app/content",
        label: "Resident Info",
        icon: BookOpen,
        adminOnly: true,
        description: "House rules, rights and policies",
      },
      {
        href: "/app/team",
        label: "Team",
        icon: UserCog,
        adminOnly: true,
        description: "Staff and house assignments",
      },
    ],
  },
];

/** The five that fit across the bottom of a phone. */
export const primaryMobileHrefs = [
  "/app/today",
  "/app/residents",
  "/app/billing",
  "/app/chores",
];

export function visibleGroups(isAdmin: boolean): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isAdmin || !item.adminOnly),
    }))
    .filter((group) => group.items.length > 0);
}
