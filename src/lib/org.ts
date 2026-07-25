import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { siteConfig } from "@/lib/site";

/**
 * Helios runs as a single operator for now, but the schema carries org_id
 * everywhere so this can become multi-tenant later. This returns the id of
 * the default organization, creating it on first use.
 */
export async function getDefaultOrgId(): Promise<string> {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.name, siteConfig.name))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(organizations)
    .values({ name: siteConfig.name })
    .returning({ id: organizations.id });

  return created.id;
}
