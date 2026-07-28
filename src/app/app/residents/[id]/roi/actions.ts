"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  residents,
  beds,
  houses,
  organizations,
  intakeDocuments,
  residentRois,
  roiDisclosures,
  roiScope,
  roiConsentType,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { notifyResident } from "@/lib/push";
import { buildRoiBody, roiIsActive } from "@/lib/roi";
import { siteConfig } from "@/lib/site";

const SCOPES = roiScope.enumValues;
const CONSENT_TYPES = roiConsentType.enumValues;
type Scope = (typeof SCOPES)[number];

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Only accepts scope values from the enum — never trusts the posted strings. */
function readScopes(formData: FormData): Scope[] {
  const raw = formData.getAll("scopes");
  const picked = new Set<Scope>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const match = SCOPES.find((s) => s === value);
    if (match) picked.add(match);
  }
  // Preserve catalog order so the signed document reads consistently.
  return SCOPES.filter((s) => picked.has(s));
}

async function scopedResident(residentId: string, access: Access) {
  const [row] = await db
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      dateOfBirth: residents.dateOfBirth,
      houseId: beds.houseId,
      houseName: houses.name,
      houseAddress1: houses.addressLine1,
      houseCity: houses.city,
      houseState: houses.state,
      housePostalCode: houses.postalCode,
    })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .leftJoin(houses, eq(beds.houseId, houses.id))
    .where(and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)))
    .limit(1);

  if (!row) return null;
  if (access.isAdmin) return row;
  if (row.houseId && (access.houseIds ?? []).includes(row.houseId)) return row;
  return null;
}

function refresh(residentId: string) {
  revalidatePath(`/app/residents/${residentId}/roi`);
  revalidatePath(`/app/residents/${residentId}`);
  revalidatePath("/me/documents");
}

/**
 * Creates a release plus its unsigned document. The resident signs it through
 * the normal document flow, so it gets the same stamped copy and certificate
 * as every other intake document.
 */
export async function createRoi(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const r = await scopedResident(residentId, access);
  if (!r) return;

  const recipientName = field(formData, "recipientName");
  const recipientRole = field(formData, "recipientRole");
  const purpose = field(formData, "purpose");
  const expiresRaw = field(formData, "expiresAt");
  const scopes = readScopes(formData);

  if (!recipientName || !recipientRole || !purpose || scopes.length === 0) {
    return;
  }

  const expiresAt = new Date(`${expiresRaw}T23:59:59`);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return;
  }

  const consentTypeRaw = field(formData, "consentType");
  const consentType =
    CONSENT_TYPES.find((t) => t === consentTypeRaw) ?? "granular";

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, access.orgId))
    .limit(1);

  const orgAddress =
    [r.houseAddress1, [r.houseCity, r.houseState].filter(Boolean).join(", "), r.housePostalCode]
      .filter(Boolean)
      .join(" · ") || siteConfig.address;

  const residentName = `${r.firstName} ${r.lastName}`.trim();
  const recipientOrganization = field(formData, "recipientOrganization") || null;

  const body = buildRoiBody({
    orgName: org?.name ?? siteConfig.name,
    orgAddress,
    residentName,
    dateOfBirth: r.dateOfBirth
      ? new Date(`${r.dateOfBirth}T00:00:00`).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—",
    recipientName,
    recipientRole,
    recipientOrganization,
    scopes,
    purpose,
    expiresAt,
    today: new Date(),
  });

  const [doc] = await db
    .insert(intakeDocuments)
    .values({
      orgId: access.orgId,
      residentId,
      type: "roi",
      title: `Release of Information — ${recipientName}`,
      body,
      createdBy: access.profile.id,
    })
    .returning({ id: intakeDocuments.id });

  await db.insert(residentRois).values({
    orgId: access.orgId,
    residentId,
    documentId: doc.id,
    consentType,
    recipientName,
    recipientRole,
    recipientOrganization,
    recipientPhone: field(formData, "recipientPhone") || null,
    recipientEmail: field(formData, "recipientEmail") || null,
    scopes,
    purpose,
    expiresAt,
    createdBy: access.profile.id,
  });

  await notifyResident({
    orgId: access.orgId,
    residentId,
    title: "A release needs your signature",
    body: `A release of information for ${recipientName} is waiting. Nothing is shared until you sign it.`,
    url: "/me/documents",
    sentBy: access.profile.id,
  });

  revalidatePath("/me");
  refresh(residentId);
}

/** Staff-side revocation. The record is kept; only its state changes. */
export async function revokeRoi(formData: FormData) {
  const access = await getAccess();
  const roiId = field(formData, "roiId");
  const residentId = field(formData, "residentId");
  if (!roiId || !residentId) return;
  if (!(await scopedResident(residentId, access))) return;

  await db
    .update(residentRois)
    .set({ revokedAt: new Date(), revokedBy: access.profile.id })
    .where(
      and(
        eq(residentRois.id, roiId),
        eq(residentRois.residentId, residentId),
        eq(residentRois.orgId, access.orgId),
      ),
    );

  refresh(residentId);
}

/**
 * Records what was actually shared. Refuses to log against a release that is
 * revoked, expired, or unsigned, and drops any scope the resident never
 * authorized.
 */
export async function logDisclosure(formData: FormData) {
  const access = await getAccess();
  const roiId = field(formData, "roiId");
  const residentId = field(formData, "residentId");
  const method = field(formData, "method");
  const summary = field(formData, "summary");
  if (!roiId || !residentId || !method || !summary) return;
  if (!(await scopedResident(residentId, access))) return;

  const [roi] = await db
    .select({
      id: residentRois.id,
      scopes: residentRois.scopes,
      expiresAt: residentRois.expiresAt,
      revokedAt: residentRois.revokedAt,
      documentStatus: intakeDocuments.status,
    })
    .from(residentRois)
    .leftJoin(
      intakeDocuments,
      eq(residentRois.documentId, intakeDocuments.id),
    )
    .where(
      and(
        eq(residentRois.id, roiId),
        eq(residentRois.residentId, residentId),
        eq(residentRois.orgId, access.orgId),
      ),
    )
    .limit(1);

  if (!roi) return;
  if (!roiIsActive(roi)) return;
  if (roi.documentStatus !== "signed") return;

  // Never log a disclosure wider than what was authorized.
  const authorized = new Set(roi.scopes);
  const scopes = readScopes(formData).filter((s) => authorized.has(s));
  if (scopes.length === 0) return;

  await db.insert(roiDisclosures).values({
    orgId: access.orgId,
    roiId,
    residentId,
    method,
    scopes,
    summary,
    disclosedBy: access.profile.id,
  });

  refresh(residentId);
}
