import type { GrievanceAbout, GrievanceStatus } from "@/db/schema";

export const GRIEVANCE_ABOUT_LABELS: Record<GrievanceAbout, string> = {
  peer: "Another resident",
  staff: "A staff member",
  facility: "The house or my room",
  policy: "A rule or decision",
  other: "Something else",
};

export const GRIEVANCE_ABOUT_HINTS: Record<GrievanceAbout, string> = {
  peer: "Conflict, behaviour, or feeling unsafe around someone you live with.",
  staff: "Goes straight to leadership. Your house manager will not see it.",
  facility: "Repairs, cleanliness, heat, pests, or anything unsafe.",
  policy: "A house rule, a charge, a consequence, or a decision about you.",
  other: "Anything that does not fit the categories above.",
};

export const GRIEVANCE_STATUS_LABELS: Record<GrievanceStatus, string> = {
  submitted: "Submitted",
  under_review: "Being looked into",
  resolved: "Resolved",
  escalated: "Escalated",
  withdrawn: "Withdrawn",
};

export const GRIEVANCE_STATUS_STYLES: Record<GrievanceStatus, string> = {
  submitted: "bg-primary/10 text-primary",
  under_review: "bg-primary/10 text-primary",
  resolved: "bg-accent/10 text-accent",
  escalated: "bg-red-100 text-red-700",
  withdrawn: "bg-surface-muted text-muted-foreground",
};

export const OPEN_GRIEVANCE_STATUSES: GrievanceStatus[] = [
  "submitted",
  "under_review",
  "escalated",
];

export const GRIEVANCE_ABOUT_VALUES: GrievanceAbout[] = [
  "peer",
  "staff",
  "facility",
  "policy",
  "other",
];
