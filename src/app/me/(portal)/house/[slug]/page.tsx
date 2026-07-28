import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { contentBlocks } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";

export const dynamic = "force-dynamic";

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const me = await requireResident();

  const [block] = await db
    .select()
    .from(contentBlocks)
    .where(
      and(eq(contentBlocks.orgId, me.orgId), eq(contentBlocks.slug, slug)),
    )
    .limit(1);

  if (!block) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/me/house"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        House
      </Link>

      <h1 className="text-2xl font-semibold">{block.title}</h1>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="whitespace-pre-wrap text-sm leading-7">
          {block.body}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated{" "}
        {block.updatedAt.toLocaleDateString("en-US", { dateStyle: "long" })}.
      </p>
    </div>
  );
}
