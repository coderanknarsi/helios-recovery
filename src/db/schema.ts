import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  pgEnum,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * Helios Recovery — core operations schema (Phase 2).
 * org_id is included everywhere now so a future multi-operator SaaS
 * conversion is a refactor, not a rewrite.
 */

export const userRole = pgEnum("user_role", [
  "owner",
  "director",
  "house_manager",
  "staff",
  "resident",
]);

export const residentStatus = pgEnum("resident_status", [
  "prospect",
  "active",
  "discharged",
  "alumni",
  "rejected",
]);

export const bedStatus = pgEnum("bed_status", [
  "available",
  "occupied",
  "maintenance",
  "reserved",
]);

export const ratePeriod = pgEnum("rate_period", [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
]);

export const logType = pgEnum("log_type", [
  "note",
  "drug_test",
  "infraction",
  "pass",
  "chore",
  "medication",
]);

export const drugTestResult = pgEnum("drug_test_result", [
  "pass",
  "fail",
  "refused",
  "pending",
]);

export const intakeDocType = pgEnum("intake_doc_type", [
  "lease_agreement",
  "house_rules",
  "consent",
  "roi",
  "other",
]);

export const intakeDocStatus = pgEnum("intake_doc_status", [
  "pending",
  "signed",
]);

/** Categories of information a resident can authorize us to disclose. */
export const roiScope = pgEnum("roi_scope", [
  "attendance",
  "drug_tests",
  "program_status",
  "financial",
  "incidents",
  "discharge_summary",
]);

/**
 * `granular` = one named recipient, specific scopes (the safe default).
 * `tpo` = the broader treatment/payment/operations consent allowed by the 2024
 * 42 CFR Part 2 final rule. `legal_proceeding` always needs its own consent.
 */
export const roiConsentType = pgEnum("roi_consent_type", [
  "granular",
  "tpo",
  "legal_proceeding",
]);

export const eventType = pgEnum("event_type", [
  "house_meeting",
  "recovery_support",
  "life_skills",
  "chore_day",
  "outing",
  "other",
]);

export const choreStatus = pgEnum("chore_status", [
  "assigned",
  "completed",
  "verified",
  "missed",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/** Mirrors an auth.users row; id equals the Supabase auth user id. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  fullName: text("full_name"),
  email: text("email"),
  role: userRole("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

export const houses = pgTable("houses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  notes: text("notes"),
  /** Who residents should actually call, shown in the resident portal. */
  managerName: text("manager_name"),
  managerPhone: text("manager_phone"),
  /** Day-to-day expectations surfaced to residents. */
  curfew: text("curfew"),
  quietHours: text("quiet_hours"),
  smokingArea: text("smoking_area"),
  parkingNotes: text("parking_notes"),
  /** Safety information NARR expects residents to be told, in writing. */
  naloxoneLocations: text("naloxone_locations"),
  evacuationNotes: text("evacuation_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  houseId: uuid("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  floor: integer("floor"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

export const beds = pgTable("beds", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  houseId: uuid("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  status: bedStatus("status").notNull().default("available"),
  monthlyRate: numeric("monthly_rate", { precision: 10, scale: 2 }),
  ratePeriod: ratePeriod("rate_period").notNull().default("monthly"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

export const residents = pgTable("residents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),
  status: residentStatus("status").notNull().default("prospect"),
  bedId: uuid("bed_id").references(() => beds.id, { onDelete: "set null" }),
  admitDate: date("admit_date"),
  dischargeDate: date("discharge_date"),
  // Optional, editable estimate of when an active resident expects to move out.
  // Never required — sober-living stays are open-ended.
  expectedDepartureDate: date("expected_departure_date"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  medications: text("medications"),
  legalHistory: text("legal_history"),
  fundingSource: text("funding_source"),
  // Intake / application fields (captured from the public apply form).
  sobrietyDate: date("sobriety_date"),
  desiredMoveInDate: date("desired_move_in_date"),
  referralSource: text("referral_source"),
  substances: text("substances"),
  treatmentHistory: text("treatment_history"),
  notes: text("notes"),
  // When set, the prospect is on the waitlist (FIFO by this timestamp).
  waitlistedAt: timestamp("waitlisted_at", { withTimezone: true }),
  // Last time we emailed this waitlisted prospect that a spot may be opening.
  waitlistNotifiedAt: timestamp("waitlist_notified_at", {
    withTimezone: true,
  }),
  // Secure token for the resident's public document-signing link.
  signToken: text("sign_token"),
  signTokenExpiresAt: timestamp("sign_token_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/** A timeline entry on a resident: note, drug test, infraction, pass, chore, medication. */
export const residentLogs = pgTable("resident_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  type: logType("type").notNull(),
  occurredAt: date("occurred_at").notNull(),
  title: text("title"),
  detail: text("detail"),
  // Only meaningful for drug_test entries.
  result: drugTestResult("result"),
  /**
   * Whether the resident can see this entry in their portal. Off by default —
   * staff decide per entry. NARR's drug testing policy expects residents to
   * receive their own results so they can dispute or celebrate them.
   */
  visibleToResident: boolean("visible_to_resident").notNull().default(false),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/** Which houses a staff member / house manager is scoped to. */
export const houseAssignments = pgTable("house_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  houseId: uuid("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * An operator-uploaded document (Lease, House Rules, Consent, or a custom
 * form) stored once per organization and reused for every resident. The file
 * itself lives in Supabase Storage; this row holds its metadata. This is the
 * SaaS "template library" each home builds up over time.
 */
export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: intakeDocType("type").notNull().default("other"),
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  sizeBytes: integer("size_bytes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * A signable intake document generated for a resident (lease, house rules,
 * consent). Either a text snapshot (`body`, from a built-in template) or a
 * reference to an uploaded file (`storagePath`/`fileName`, from a
 * documentTemplate). Signing records a typed legal name, timestamp, and IP for
 * a basic e-signature audit trail.
 */
export const intakeDocuments = pgTable("intake_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  type: intakeDocType("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  // Set when this document is an uploaded file rather than generated text.
  templateId: uuid("template_id").references(() => documentTemplates.id, {
    onDelete: "set null",
  }),
  storagePath: text("storage_path"),
  fileName: text("file_name"),
  status: intakeDocStatus("status").notNull().default("pending"),
  signedName: text("signed_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signedIp: text("signed_ip"),
  // Court-provable audit trail captured at signing time.
  signedUserAgent: text("signed_user_agent"),
  // Exact consent statement the signer agreed to.
  consentText: text("consent_text"),
  // SHA-256 of the exact document bytes/text presented to the signer.
  originalHash: text("original_hash"),
  // Generated signed copy: original stamped with the signature + an appended
  // Certificate of Completion. Stored in the same private bucket.
  signedStoragePath: text("signed_storage_path"),
  // SHA-256 of the generated signed copy (detects later tampering).
  signedHash: text("signed_hash"),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * A resident's authorization to release their information to a named person.
 *
 * Two records make up one release: this row (structured, queryable, revocable
 * — what the app enforces against) and an `intakeDocuments` row of type "roi"
 * holding the signed PDF, linked by `documentId`. That keeps signing on the
 * same court-provable pipeline as every other intake document.
 *
 * A release is active when `revokedAt IS NULL AND expiresAt > now()`. There is
 * deliberately no stored "expired" status — deriving it means it can never
 * drift out of sync.
 */
export const residentRois = pgTable("resident_rois", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => intakeDocuments.id, {
    onDelete: "set null",
  }),

  consentType: roiConsentType("consent_type").notNull().default("granular"),
  recipientName: text("recipient_name").notNull(),
  recipientRole: text("recipient_role").notNull(),
  recipientOrganization: text("recipient_organization"),
  recipientPhone: text("recipient_phone"),
  recipientEmail: text("recipient_email"),

  scopes: roiScope("scopes").array().notNull(),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  // True when the resident revoked it themselves from the portal.
  revokedByResident: boolean("revoked_by_resident").notNull().default(false),

  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * What was actually disclosed, to whom, and when. The consent proves the
 * resident authorized a release; this proves what we did with it. Residents
 * have a right to an accounting of disclosures, and in a dispute this is the
 * record that protects the operator.
 */
export const roiDisclosures = pgTable("roi_disclosures", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  roiId: uuid("roi_id")
    .notNull()
    .references(() => residentRois.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),

  disclosedAt: timestamp("disclosed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // How it was shared: phone, email, in person, mail, portal.
  method: text("method").notNull(),
  scopes: roiScope("scopes").array().notNull(),
  summary: text("summary").notNull(),
  disclosedBy: uuid("disclosed_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * A resident's Web Push subscription. One row per browser/device — a resident
 * who installs the portal on a phone and a tablet has two.
 *
 * On iOS, push only works once the portal is installed to the home screen;
 * Safari tabs cannot subscribe at all.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  // The push service URL. Unique because re-subscribing returns the same one.
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * A message for a resident. Deliberately stored rather than fire-and-forget:
 * push delivery is unreliable and a swiped-away notification is gone forever,
 * so the portal keeps the durable copy and push is only the doorbell.
 */
export const residentNotifications = pgTable("resident_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // Where tapping the notification should land them.
  url: text("url").notNull().default("/me"),
  sentBy: uuid("sent_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * The standing weekly rhythm of a house — Tuesday house meeting, Thursday
 * AA at the Alano Club. Stored as day-of-week plus a local wall-clock time
 * rather than dated rows, so nothing needs regenerating and DST never shifts
 * a meeting. This is also NARR's required weekly schedule of recovery
 * support services.
 */
export const scheduleItems = pgTable("schedule_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Null means it applies to every house in the org.
  houseId: uuid("house_id").references(() => houses.id, {
    onDelete: "cascade",
  }),
  type: eventType("type").notNull().default("recovery_support"),
  title: text("title").notNull(),
  description: text("description"),
  dayOfWeek: integer("day_of_week").notNull(),
  // Local wall clock, "HH:MM".
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  location: text("location"),
  mandatory: boolean("mandatory").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/** One-off dated events that sit alongside the standing weekly schedule. */
export const houseEvents = pgTable("house_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  houseId: uuid("house_id").references(() => houses.id, {
    onDelete: "cascade",
  }),
  type: eventType("type").notNull().default("other"),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: date("event_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  location: text("location"),
  mandatory: boolean("mandatory").notNull().default(false),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/** The catalog of recurring jobs in a house. */
export const chores = pgTable("chores", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  houseId: uuid("house_id")
    .notNull()
    .references(() => houses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * Who has which chore this week. Residents mark their own work done; staff
 * verify separately, so "said it was done" and "was checked" stay distinct.
 */
export const choreAssignments = pgTable(
  "chore_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    choreId: uuid("chore_id")
      .notNull()
      .references(() => chores.id, { onDelete: "cascade" }),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residents.id, { onDelete: "cascade" }),
    // Monday of the week this covers.
    weekStart: date("week_start").notNull(),
    dueDate: date("due_date").notNull(),
    status: choreStatus("status").notNull().default("assigned"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("chore_week_idx").on(t.choreId, t.weekStart)],
).enableRLS();

/**
 * Editable policy text shown to residents (house rules, resident rights,
 * grievance procedure, etc.). One row per org per slug; the slug catalog and
 * NARR-aligned starting text live in src/lib/resident-content.ts.
 */
export const contentBlocks = pgTable(
  "content_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    updatedBy: uuid("updated_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("content_blocks_org_slug_idx").on(table.orgId, table.slug)],
).enableRLS();

/**
 * A one-time passcode texted to a resident so they can sign in to the resident
 * portal. Codes are stored hashed, are single-use, and expire quickly.
 */
export const residentOtps = pgTable("resident_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  /** E.164 number the code was sent to; also used for rate limiting. */
  phone: text("phone").notNull(),
  /** SHA-256 of (pepper : residentId : code). The raw code is never stored. */
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  requestIp: text("request_ip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

/**
 * An authenticated resident-portal session. Only the SHA-256 hash of the
 * session token is stored; the raw token lives in an httpOnly cookie.
 */
export const residentSessions = pgTable("resident_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residents.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}).enableRLS();

export type Organization = typeof organizations.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type House = typeof houses.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Bed = typeof beds.$inferSelect;
export type Resident = typeof residents.$inferSelect;
export type ResidentLog = typeof residentLogs.$inferSelect;
export type HouseAssignment = typeof houseAssignments.$inferSelect;
export type IntakeDocument = typeof intakeDocuments.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type ResidentOtp = typeof residentOtps.$inferSelect;
export type ResidentSession = typeof residentSessions.$inferSelect;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type ResidentRoi = typeof residentRois.$inferSelect;
export type RoiDisclosure = typeof roiDisclosures.$inferSelect;
export type RoiScope = (typeof roiScope.enumValues)[number];
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type ResidentNotification = typeof residentNotifications.$inferSelect;
export type ScheduleItem = typeof scheduleItems.$inferSelect;
export type HouseEvent = typeof houseEvents.$inferSelect;
export type Chore = typeof chores.$inferSelect;
export type ChoreAssignment = typeof choreAssignments.$inferSelect;
export type EventType = (typeof eventType.enumValues)[number];
export type ChoreStatus = (typeof choreStatus.enumValues)[number];
