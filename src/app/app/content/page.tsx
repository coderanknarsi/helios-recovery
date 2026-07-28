import { asc, eq } from "drizzle-orm";
import { CheckCircle2, Circle, House as HouseIcon } from "lucide-react";
import { db } from "@/db";
import { contentBlocks, houses } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { RESIDENT_CONTENT } from "@/lib/resident-content";
import {
  deleteContentBlock,
  saveContentBlock,
  updateHouseInfo,
} from "./actions";

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

export default async function ContentPage() {
  const access = await requireAdmin();

  const [houseRows, blocks] = await Promise.all([
    db
      .select()
      .from(houses)
      .where(eq(houses.orgId, access.orgId))
      .orderBy(asc(houses.name)),
    db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.orgId, access.orgId)),
  ]);

  const bySlug = new Map(blocks.map((b) => [b.slug, b]));
  const publishedCount = RESIDENT_CONTENT.filter((c) =>
    bySlug.has(c.slug),
  ).length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Resident information</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          What residents see in their portal. House details appear on the House
          tab; published policies appear beneath them.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">House details</h2>
        {houseRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Add a house under Property first.
            </p>
          </div>
        )}

        {houseRows.map((house) => (
          <details
            key={house.id}
            className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          >
            <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
              <HouseIcon className="h-4 w-4 text-primary" />
              {house.name}
            </summary>

            <form action={updateHouseInfo} className="mt-6 space-y-4">
              <input type="hidden" name="houseId" value={house.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="House manager name"
                  name="managerName"
                  defaultValue={house.managerName}
                  placeholder="Who residents should ask for"
                />
                <Field
                  label="House manager phone"
                  name="managerPhone"
                  defaultValue={house.managerPhone}
                  placeholder="(555) 123-4567"
                />
                <Field
                  label="Curfew"
                  name="curfew"
                  defaultValue={house.curfew}
                  placeholder="11:00 PM Sun–Thu, midnight Fri–Sat"
                />
                <Field
                  label="Quiet hours"
                  name="quietHours"
                  defaultValue={house.quietHours}
                  placeholder="10:00 PM – 7:00 AM"
                />
                <Field
                  label="Smoking area"
                  name="smokingArea"
                  defaultValue={house.smokingArea}
                  placeholder="Back patio only, use the receptacle"
                />
                <Field
                  label="Parking"
                  name="parkingNotes"
                  defaultValue={house.parkingNotes}
                  placeholder="Street parking on the house side only"
                />
              </div>

              <label className="block text-sm">
                <span className="font-medium">Naloxone (Narcan) locations</span>
                <textarea
                  name="naloxoneLocations"
                  rows={2}
                  defaultValue={house.naloxoneLocations ?? ""}
                  placeholder="Kitchen cabinet above the sink; upstairs hallway closet"
                  className={fieldClass}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium">
                  Fire &amp; evacuation instructions
                </span>
                <textarea
                  name="evacuationNotes"
                  rows={3}
                  defaultValue={house.evacuationNotes ?? ""}
                  placeholder="Exit through the nearest door. Meet at the mailbox across the street. Do not re-enter."
                  className={fieldClass}
                />
              </label>

              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                Save house details
              </button>
            </form>
          </details>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Policies</h2>
          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {publishedCount} of {RESIDENT_CONTENT.length} published
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Each policy starts from a NARR-aligned template. Read it, edit it for
          your house, and have it reviewed before publishing — the templates are
          a starting point, not legal advice.
        </p>

        {RESIDENT_CONTENT.map((definition) => {
          const existing = bySlug.get(definition.slug);
          const published = Boolean(existing);
          return (
            <details
              key={definition.slug}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-base font-semibold">
                {published ? (
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                {existing?.title ?? definition.title}
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    published
                      ? "bg-accent/10 text-accent"
                      : "bg-surface-muted text-muted-foreground"
                  }`}
                >
                  {published ? "Published" : "Not published"}
                </span>
              </summary>

              <p className="mt-3 text-sm text-muted-foreground">
                {definition.purpose}
              </p>

              <form action={saveContentBlock} className="mt-4 space-y-4">
                <input type="hidden" name="slug" value={definition.slug} />

                <label className="block text-sm">
                  <span className="font-medium">Title residents see</span>
                  <input
                    name="title"
                    defaultValue={existing?.title ?? definition.title}
                    className={fieldClass}
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium">Body</span>
                  <textarea
                    name="body"
                    rows={18}
                    required
                    defaultValue={existing?.body ?? definition.defaultBody}
                    className={`${fieldClass} font-mono text-xs leading-6`}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                  >
                    {published ? "Save changes" : "Publish to residents"}
                  </button>
                  {existing && (
                    <span className="text-xs text-muted-foreground">
                      Updated{" "}
                      {existing.updatedAt.toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                    </span>
                  )}
                </div>
              </form>

              {existing && (
                <form action={deleteContentBlock} className="mt-3">
                  <input type="hidden" name="slug" value={definition.slug} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-muted-foreground transition hover:text-red-600"
                  >
                    Unpublish (hide from residents)
                  </button>
                </form>
              )}
            </details>
          );
        })}
      </section>
    </div>
  );
}
