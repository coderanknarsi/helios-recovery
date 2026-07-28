"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentBlocks, houses } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { contentDefinition } from "@/lib/resident-content";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function refresh() {
  revalidatePath("/app/content");
  revalidatePath("/me/house");
  revalidatePath("/me");
}

/** Update the resident-facing details for one house. */
export async function updateHouseInfo(formData: FormData) {
  const access = await requireAdmin();
  const houseId = field(formData, "houseId");
  if (!houseId) return;

  const [house] = await db
    .select({ id: houses.id })
    .from(houses)
    .where(and(eq(houses.id, houseId), eq(houses.orgId, access.orgId)))
    .limit(1);
  if (!house) return;

  await db
    .update(houses)
    .set({
      managerName: field(formData, "managerName") || null,
      managerPhone: field(formData, "managerPhone") || null,
      curfew: field(formData, "curfew") || null,
      quietHours: field(formData, "quietHours") || null,
      smokingArea: field(formData, "smokingArea") || null,
      parkingNotes: field(formData, "parkingNotes") || null,
      naloxoneLocations: field(formData, "naloxoneLocations") || null,
      evacuationNotes: field(formData, "evacuationNotes") || null,
    })
    .where(eq(houses.id, houseId));

  refresh();
}

/** Create or update one policy document. Publishing makes it visible to residents. */
export async function saveContentBlock(formData: FormData) {
  const access = await requireAdmin();

  const slug = field(formData, "slug");
  // Only slugs in the catalog are accepted — no arbitrary content injection.
  const definition = contentDefinition(slug);
  if (!definition) return;

  const body = field(formData, "body");
  if (!body) return;
  const title = field(formData, "title") || definition.title;

  await db
    .insert(contentBlocks)
    .values({
      orgId: access.orgId,
      slug,
      title,
      body,
      updatedBy: access.profile.id,
    })
    .onConflictDoUpdate({
      target: [contentBlocks.orgId, contentBlocks.slug],
      set: { title, body, updatedBy: access.profile.id, updatedAt: new Date() },
    });

  refresh();
}

/** Unpublish a policy document, removing it from the resident portal. */
export async function deleteContentBlock(formData: FormData) {
  const access = await requireAdmin();
  const slug = field(formData, "slug");
  if (!slug) return;

  await db
    .delete(contentBlocks)
    .where(
      and(
        eq(contentBlocks.orgId, access.orgId),
        eq(contentBlocks.slug, slug),
      ),
    );

  refresh();
}
