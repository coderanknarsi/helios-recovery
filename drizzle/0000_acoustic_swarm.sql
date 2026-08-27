CREATE TYPE "public"."accommodation_review_status" AS ENUM('not_applicable_or_not_requested', 'request_considered', 'accommodation_offered', 'accommodation_declined');--> statement-breakpoint
CREATE TYPE "public"."application_contact_channel" AS ENUM('phone', 'email', 'text', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_decision_outcome" AS ENUM('declined', 'withdrawn', 'unresponsive', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."application_decline_reason" AS ENUM('published_eligibility_not_met', 'requested_services_outside_nonclinical_scope', 'documented_direct_safety_risk', 'other_policy_criterion');--> statement-breakpoint
CREATE TYPE "public"."bed_status" AS ENUM('available', 'occupied', 'maintenance', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."charge_type" AS ENUM('rent', 'deposit', 'admission_fee', 'late_fee', 'damage', 'other');--> statement-breakpoint
CREATE TYPE "public"."chore_status" AS ENUM('assigned', 'completed', 'verified', 'missed');--> statement-breakpoint
CREATE TYPE "public"."drill_attendance" AS ENUM('present', 'absent', 'briefed_later');--> statement-breakpoint
CREATE TYPE "public"."drill_type" AS ENUM('fire_evacuation', 'severe_weather', 'overdose_response', 'other');--> statement-breakpoint
CREATE TYPE "public"."drug_test_result" AS ENUM('pass', 'fail', 'refused', 'pending');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('house_meeting', 'recovery_support', 'life_skills', 'chore_day', 'outing', 'safety_drill', 'facility_inspection', 'other');--> statement-breakpoint
CREATE TYPE "public"."exit_participation" AS ENUM('none', 'low', 'moderate', 'high');--> statement-breakpoint
CREATE TYPE "public"."exit_reason" AS ENUM('completed_program', 'planned_transfer', 'left_early', 'rule_violation', 'substance_use', 'overdose', 'arrest_incarceration', 'medical_behavioral', 'death', 'other');--> statement-breakpoint
CREATE TYPE "public"."grievance_about" AS ENUM('peer', 'staff', 'facility', 'policy', 'other');--> statement-breakpoint
CREATE TYPE "public"."grievance_status" AS ENUM('submitted', 'under_review', 'resolved', 'escalated', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."intake_doc_status" AS ENUM('pending', 'signed');--> statement-breakpoint
CREATE TYPE "public"."intake_doc_type" AS ENUM('lease_agreement', 'house_rules', 'fee_schedule', 'consent', 'roi', 'other');--> statement-breakpoint
CREATE TYPE "public"."log_type" AS ENUM('note', 'drug_test', 'infraction', 'pass', 'chore', 'medication');--> statement-breakpoint
CREATE TYPE "public"."payment_entry_kind" AS ENUM('receipt', 'refund', 'chargeback_reversal');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'money_order', 'card', 'ach', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_refund_reason" AS ENUM('resident_request', 'duplicate', 'payment_error', 'departure_or_policy', 'other');--> statement-breakpoint
CREATE TYPE "public"."rate_period" AS ENUM('daily', 'weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."resident_status" AS ENUM('prospect', 'active', 'discharged', 'alumni', 'rejected', 'withdrawn', 'unresponsive');--> statement-breakpoint
CREATE TYPE "public"."roi_consent_type" AS ENUM('granular', 'tpo', 'legal_proceeding');--> statement-breakpoint
CREATE TYPE "public"."roi_scope" AS ENUM('attendance', 'drug_tests', 'program_status', 'financial', 'incidents', 'discharge_summary');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'director', 'house_manager', 'staff', 'resident');--> statement-breakpoint
CREATE TABLE "application_contact_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"channel" "application_contact_channel" NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	"note" text NOT NULL,
	"attempted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_contact_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"outcome" "application_decision_outcome" NOT NULL,
	"decline_reason" "application_decline_reason",
	"note" text NOT NULL,
	"accommodation_review" "accommodation_review_status",
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"house_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" "bed_status" DEFAULT 'available' NOT NULL,
	"monthly_rate" numeric(10, 2),
	"rate_period" "rate_period" DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"type" charge_type DEFAULT 'rent' NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" date NOT NULL,
	"period_start" date,
	"period_end" date,
	"waived_at" timestamp with time zone,
	"waived_by" uuid,
	"waived_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chore_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"chore_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "chore_status" DEFAULT 'assigned' NOT NULL,
	"completed_at" timestamp with time zone,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chore_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"house_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "intake_doc_type" DEFAULT 'other' NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grievance_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"grievance_id" uuid NOT NULL,
	"status" "grievance_status",
	"note" text NOT NULL,
	"visible_to_resident" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grievance_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grievances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"house_id" uuid,
	"resident_id" uuid,
	"about" "grievance_about" NOT NULL,
	"subject" text NOT NULL,
	"detail" text NOT NULL,
	"status" "grievance_status" DEFAULT 'submitted' NOT NULL,
	"admin_only" boolean DEFAULT false NOT NULL,
	"assigned_to" uuid,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grievances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "house_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"house_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "house_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "house_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"house_id" uuid,
	"type" "event_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"location" text,
	"mandatory" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "house_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "houses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"phone" text,
	"notes" text,
	"manager_name" text,
	"manager_phone" text,
	"curfew" text,
	"quiet_hours" text,
	"smoking_area" text,
	"parking_notes" text,
	"naloxone_locations" text,
	"evacuation_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "houses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"type" "intake_doc_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"template_id" uuid,
	"storage_path" text,
	"file_name" text,
	"status" "intake_doc_status" DEFAULT 'pending' NOT NULL,
	"signed_name" text,
	"signed_at" timestamp with time zone,
	"signed_ip" text,
	"signed_user_agent" text,
	"consent_text" text,
	"original_hash" text,
	"signed_storage_path" text,
	"signed_hash" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"stripe_dispute_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"evidence_due_by" timestamp with time zone,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"reversal_payment_id" uuid,
	"stripe_event_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_disputes_stripe_dispute_id_unique" UNIQUE("stripe_dispute_id")
);
--> statement-breakpoint
ALTER TABLE "payment_disputes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"token" text NOT NULL,
	"amount" numeric(10, 2),
	"label" text NOT NULL,
	"third_party" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "payment_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_promises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_by" date NOT NULL,
	"reason" text,
	"granted_by" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_promises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"request_key" text,
	"stripe_refund_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" "payment_refund_reason" NOT NULL,
	"staff_note" text NOT NULL,
	"requested_by" uuid,
	"failure_reason" text,
	"reversal_payment_id" uuid,
	"stripe_event_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refunds_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "payment_refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"received_on" date NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"payer_name" text,
	"reference" text,
	"note" text,
	"kind" "payment_entry_kind" DEFAULT 'receipt' NOT NULL,
	"reversal_of_id" uuid,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"stripe_adjustment_id" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_session_id_unique" UNIQUE("stripe_session_id"),
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "payments_stripe_charge_id_unique" UNIQUE("stripe_charge_id"),
	CONSTRAINT "payments_stripe_adjustment_id_unique" UNIQUE("stripe_adjustment_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"full_name" text,
	"email" text,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_exits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"exit_date" date NOT NULL,
	"planned" boolean DEFAULT false NOT NULL,
	"reason" "exit_reason" NOT NULL,
	"reason_detail" text,
	"participation" "exit_participation",
	"progress_summary" text,
	"resident_statement" text,
	"ongoing_recovery_plan" text,
	"referrals" text,
	"forwarding_address" text,
	"forwarding_phone" text,
	"forwarding_email" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_exits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"type" "log_type" NOT NULL,
	"occurred_at" date NOT NULL,
	"title" text,
	"detail" text,
	"result" "drug_test_result",
	"visible_to_resident" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text DEFAULT '/me' NOT NULL,
	"sent_by" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"request_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_otps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_rois" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"document_id" uuid,
	"consent_type" "roi_consent_type" DEFAULT 'granular' NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_role" text NOT NULL,
	"recipient_organization" text,
	"recipient_phone" text,
	"recipient_email" text,
	"scopes" "roi_scope"[] NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoked_by_resident" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_rois" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resident_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resident_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "resident_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"date_of_birth" date,
	"status" "resident_status" DEFAULT 'prospect' NOT NULL,
	"bed_id" uuid,
	"admit_date" date,
	"discharge_date" date,
	"expected_departure_date" date,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relation" text,
	"medications" text,
	"legal_history" text,
	"funding_source" text,
	"sobriety_date" date,
	"desired_move_in_date" date,
	"referral_source" text,
	"substances" text,
	"treatment_history" text,
	"notes" text,
	"waitlisted_at" timestamp with time zone,
	"waitlist_notified_at" timestamp with time zone,
	"sign_token" text,
	"sign_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "residents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roi_disclosures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"roi_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"disclosed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"scopes" "roi_scope"[] NOT NULL,
	"summary" text NOT NULL,
	"disclosed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roi_disclosures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"house_id" uuid NOT NULL,
	"name" text NOT NULL,
	"floor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "safety_drill_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"drill_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"status" "drill_attendance" DEFAULT 'present' NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "safety_drill_attendees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "safety_drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"house_id" uuid NOT NULL,
	"type" "drill_type" NOT NULL,
	"conducted_on" date NOT NULL,
	"evacuation_seconds" integer,
	"notes" text,
	"conducted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_drills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"house_id" uuid,
	"type" "event_type" DEFAULT 'recovery_support' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"location" text,
	"mandatory" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_contact_attempts" ADD CONSTRAINT "application_contact_attempts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_contact_attempts" ADD CONSTRAINT "application_contact_attempts_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_contact_attempts" ADD CONSTRAINT "application_contact_attempts_attempted_by_profiles_id_fk" FOREIGN KEY ("attempted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_decisions" ADD CONSTRAINT "application_decisions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_decisions" ADD CONSTRAINT "application_decisions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_decisions" ADD CONSTRAINT "application_decisions_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_waived_by_profiles_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_verified_by_profiles_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_updates" ADD CONSTRAINT "grievance_updates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_updates" ADD CONSTRAINT "grievance_updates_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_updates" ADD CONSTRAINT "grievance_updates_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_assignments" ADD CONSTRAINT "house_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_assignments" ADD CONSTRAINT "house_assignments_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_assignments" ADD CONSTRAINT "house_assignments_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_events" ADD CONSTRAINT "house_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_events" ADD CONSTRAINT "house_events_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_events" ADD CONSTRAINT "house_events_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "houses" ADD CONSTRAINT "houses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_reversal_payment_id_payments_id_fk" FOREIGN KEY ("reversal_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_reversal_payment_id_payments_id_fk" FOREIGN KEY ("reversal_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_of_id_payments_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_exits" ADD CONSTRAINT "resident_exits_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_exits" ADD CONSTRAINT "resident_exits_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_exits" ADD CONSTRAINT "resident_exits_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_logs" ADD CONSTRAINT "resident_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_logs" ADD CONSTRAINT "resident_logs_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_logs" ADD CONSTRAINT "resident_logs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_notifications" ADD CONSTRAINT "resident_notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_notifications" ADD CONSTRAINT "resident_notifications_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_notifications" ADD CONSTRAINT "resident_notifications_sent_by_profiles_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_otps" ADD CONSTRAINT "resident_otps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_otps" ADD CONSTRAINT "resident_otps_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_rois" ADD CONSTRAINT "resident_rois_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_rois" ADD CONSTRAINT "resident_rois_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_rois" ADD CONSTRAINT "resident_rois_document_id_intake_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."intake_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_rois" ADD CONSTRAINT "resident_rois_revoked_by_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_rois" ADD CONSTRAINT "resident_rois_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_sessions" ADD CONSTRAINT "resident_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_sessions" ADD CONSTRAINT "resident_sessions_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_bed_id_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."beds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_disclosures" ADD CONSTRAINT "roi_disclosures_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_disclosures" ADD CONSTRAINT "roi_disclosures_roi_id_resident_rois_id_fk" FOREIGN KEY ("roi_id") REFERENCES "public"."resident_rois"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_disclosures" ADD CONSTRAINT "roi_disclosures_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_disclosures" ADD CONSTRAINT "roi_disclosures_disclosed_by_profiles_id_fk" FOREIGN KEY ("disclosed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_drill_attendees" ADD CONSTRAINT "safety_drill_attendees_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_drill_attendees" ADD CONSTRAINT "safety_drill_attendees_drill_id_safety_drills_id_fk" FOREIGN KEY ("drill_id") REFERENCES "public"."safety_drills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_drill_attendees" ADD CONSTRAINT "safety_drill_attendees_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_drills" ADD CONSTRAINT "safety_drills_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_drills" ADD CONSTRAINT "safety_drills_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_drills" ADD CONSTRAINT "safety_drills_conducted_by_profiles_id_fk" FOREIGN KEY ("conducted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_items" ADD CONSTRAINT "schedule_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_contact_attempt_idx" ON "application_contact_attempts" USING btree ("resident_id","channel","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "charge_period_idx" ON "charges" USING btree ("resident_id","type","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "chore_week_idx" ON "chore_assignments" USING btree ("chore_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "content_blocks_org_slug_idx" ON "content_blocks" USING btree ("org_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "drill_attendee_idx" ON "safety_drill_attendees" USING btree ("drill_id","resident_id");