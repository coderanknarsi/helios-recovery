import type { Metadata } from "next";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { Building2, DoorOpen, BedDouble, Trash2 } from "lucide-react";
import { db } from "@/db";
import { houses, rooms, beds, residents } from "@/db/schema";
import { getCurrentProfile } from "@/lib/auth";
import {
  createHouse,
  createRoom,
  createBeds,
  updateBed,
  setBedStatus,
  deleteBed,
  deleteRoom,
  deleteHouse,
} from "./actions";

export const metadata: Metadata = { title: "Property" };

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const bedStatusStyles: Record<string, string> = {
  available: "bg-accent/10 text-accent",
  occupied: "bg-primary/10 text-primary",
  reserved: "bg-blue-50 text-blue-700",
  maintenance: "bg-surface-muted text-muted-foreground",
};

function money(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const floorOptions = [
  { value: "-1", label: "Basement" },
  { value: "1", label: "1st floor" },
  { value: "2", label: "2nd floor" },
  { value: "3", label: "3rd floor" },
  { value: "4", label: "4th floor" },
];

function floorLabel(floor: number | null) {
  if (floor == null) return null;
  const match = floorOptions.find((o) => o.value === String(floor));
  return match ? match.label : `Floor ${floor}`;
}

type Occupant = { firstName: string; lastName: string; status: string };

export default async function PropertyPage() {
  const profile = await getCurrentProfile();
  const orgId = profile.orgId!;

  const houseRows = await db
    .select()
    .from(houses)
    .where(eq(houses.orgId, orgId))
    .orderBy(asc(houses.name));
  const houseIds = houseRows.map((h) => h.id);

  const [roomRows, bedRows, occRows] = await Promise.all([
    houseIds.length
      ? db
          .select()
          .from(rooms)
          .where(inArray(rooms.houseId, houseIds))
          .orderBy(asc(rooms.name))
      : Promise.resolve([]),
    houseIds.length
      ? db
          .select()
          .from(beds)
          .where(inArray(beds.houseId, houseIds))
          .orderBy(asc(beds.label))
      : Promise.resolve([]),
    db
      .select({
        bedId: residents.bedId,
        firstName: residents.firstName,
        lastName: residents.lastName,
        status: residents.status,
      })
      .from(residents)
      .where(and(eq(residents.orgId, orgId), isNotNull(residents.bedId))),
  ]);

  const occupantByBed = new Map<string, Occupant>();
  for (const o of occRows) {
    if (o.bedId) {
      occupantByBed.set(o.bedId, {
        firstName: o.firstName,
        lastName: o.lastName,
        status: o.status,
      });
    }
  }

  const counts = {
    total: bedRows.length,
    occupied: bedRows.filter((b) => b.status === "occupied").length,
    available: bedRows.filter((b) => b.status === "available").length,
    reserved: bedRows.filter((b) => b.status === "reserved").length,
    maintenance: bedRows.filter((b) => b.status === "maintenance").length,
  };
  const occupancyPct =
    counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Property</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your houses, rooms, and beds — and who&apos;s in them.
          </p>
        </div>
      </div>

      {/* Occupancy summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryTile label="Total beds" value={counts.total} />
        <SummaryTile
          label={`Occupied · ${occupancyPct}%`}
          value={counts.occupied}
          tone="text-primary"
        />
        <SummaryTile
          label="Available"
          value={counts.available}
          tone="text-accent"
        />
        <SummaryTile label="Reserved" value={counts.reserved} />
        <SummaryTile label="Maintenance" value={counts.maintenance} />
      </div>

      {/* Add house */}
      <details className="group mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-medium text-primary marker:content-none">
          + Add a house
        </summary>
        <form
          action={createHouse}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label className="text-sm sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              House name
            </span>
            <input
              name="name"
              required
              placeholder="e.g. Sunrise House"
              className={fieldClass}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              Street address
            </span>
            <input name="addressLine1" className={fieldClass} />
          </label>
          <label className="text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              City
            </span>
            <input name="city" className={fieldClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                State
              </span>
              <input name="state" className={fieldClass} />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                ZIP
              </span>
              <input name="postalCode" className={fieldClass} />
            </label>
          </div>
          <label className="text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Phone
            </span>
            <input name="phone" className={fieldClass} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
            >
              Add house
            </button>
          </div>
        </form>
      </details>

      {houseRows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold">No houses yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add your first house above, then create rooms and beds. Beds you add
            here become assignable when you accept an application.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {houseRows.map((house) => {
            const houseRooms = roomRows.filter((r) => r.houseId === house.id);
            const houseBeds = bedRows.filter((b) => b.houseId === house.id);
            const houseInUse = houseBeds.some(
              (b) => b.status === "occupied" || b.status === "reserved",
            );
            return (
              <section
                key={house.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{house.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {[house.addressLine1, house.city, house.state]
                          .filter(Boolean)
                          .join(", ") || "No address set"}
                        {"  ·  "}
                        {houseBeds.length} bed
                        {houseBeds.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  {!houseInUse && (
                    <form action={deleteHouse}>
                      <input type="hidden" name="houseId" value={house.id} />
                      <button
                        type="submit"
                        title="Delete house"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </form>
                  )}
                </div>

                {/* Rooms */}
                <div className="mt-5 space-y-4">
                  {houseRooms.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No rooms yet. Add one below.
                    </p>
                  )}
                  {houseRooms.map((room) => {
                    const roomBeds = houseBeds.filter(
                      (b) => b.roomId === room.id,
                    );
                    const roomInUse = roomBeds.some(
                      (b) => b.status === "occupied" || b.status === "reserved",
                    );
                    return (
                      <div
                        key={room.id}
                        className="rounded-lg border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <DoorOpen className="h-4 w-4 text-muted-foreground" />
                            {room.name}
                            {room.floor != null && (
                              <span className="text-xs font-normal text-muted-foreground">
                                · {floorLabel(room.floor)}
                              </span>
                            )}
                          </div>
                          {roomBeds.length === 0 && !roomInUse && (
                            <form action={deleteRoom}>
                              <input
                                type="hidden"
                                name="roomId"
                                value={room.id}
                              />
                              <button
                                type="submit"
                                title="Delete room"
                                className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground transition hover:bg-surface-muted hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                        </div>

                        {/* Beds grid */}
                        {roomBeds.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {roomBeds.map((bed) => {
                              const occupant = occupantByBed.get(bed.id);
                              const rate = money(bed.monthlyRate);
                              const isFree =
                                bed.status === "available" ||
                                bed.status === "maintenance";
                              return (
                                <div
                                  key={bed.id}
                                  className="rounded-lg border border-border bg-surface"
                                >
                                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <BedDouble className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-sm font-medium">
                                          {bed.label}
                                        </span>
                                        <span
                                          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                                            bedStatusStyles[bed.status] ??
                                            "bg-surface-muted text-muted-foreground"
                                          }`}
                                        >
                                          {bed.status}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 truncate pl-6 text-xs text-muted-foreground">
                                        {occupant
                                          ? `${occupant.firstName} ${occupant.lastName}${
                                              occupant.status === "prospect"
                                                ? " (hold)"
                                                : ""
                                            }`
                                          : rate
                                            ? `${rate}/mo`
                                            : "Unassigned"}
                                      </div>
                                    </div>
                                    {isFree && (
                                      <div className="flex shrink-0 items-center gap-1">
                                        <form action={setBedStatus}>
                                          <input
                                            type="hidden"
                                            name="bedId"
                                            value={bed.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="status"
                                            value={
                                              bed.status === "maintenance"
                                                ? "available"
                                                : "maintenance"
                                            }
                                          />
                                          <button
                                            type="submit"
                                            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                                          >
                                            {bed.status === "maintenance"
                                              ? "Reopen"
                                              : "Maintenance"}
                                          </button>
                                        </form>
                                        <form action={deleteBed}>
                                          <input
                                            type="hidden"
                                            name="bedId"
                                            value={bed.id}
                                          />
                                          <button
                                            type="submit"
                                            title="Delete bed"
                                            className="rounded-md p-1 text-muted-foreground transition hover:bg-surface-muted hover:text-red-600"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </form>
                                      </div>
                                    )}
                                  </div>

                                  {/* Edit label & rate */}
                                  <details className="border-t border-border">
                                    <summary className="cursor-pointer list-none px-3 py-1.5 text-xs font-medium text-primary marker:content-none">
                                      Edit
                                    </summary>
                                    <form
                                      action={updateBed}
                                      className="flex flex-wrap items-end gap-2 px-3 pb-3"
                                    >
                                      <input
                                        type="hidden"
                                        name="bedId"
                                        value={bed.id}
                                      />
                                      <label className="text-sm">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          Label
                                        </span>
                                        <input
                                          name="label"
                                          defaultValue={bed.label}
                                          className={`${fieldClass} w-36`}
                                        />
                                      </label>
                                      <label className="text-sm">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          Monthly rate
                                        </span>
                                        <input
                                          name="monthlyRate"
                                          inputMode="decimal"
                                          placeholder="No rate"
                                          defaultValue={
                                            bed.monthlyRate
                                              ? String(Number(bed.monthlyRate))
                                              : ""
                                          }
                                          className={`${fieldClass} w-28`}
                                        />
                                      </label>
                                      <button
                                        type="submit"
                                        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                                      >
                                        Save
                                      </button>
                                    </form>
                                  </details>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add bed */}
                        <details className="mt-3">
                          <summary className="cursor-pointer list-none text-xs font-medium text-primary marker:content-none">
                            + Add bed
                          </summary>
                          <form
                            action={createBeds}
                            className="mt-2 flex flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="houseId"
                              value={house.id}
                            />
                            <input
                              type="hidden"
                              name="roomId"
                              value={room.id}
                            />
                            <label className="text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                Bed type
                              </span>
                              <select
                                name="bedType"
                                defaultValue="single"
                                className={`${fieldClass} w-40`}
                              >
                                <option value="single">Single bed</option>
                                <option value="bunk">
                                  Bunk bed (2 beds)
                                </option>
                              </select>
                            </label>
                            <label className="text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                How many
                              </span>
                              <input
                                name="quantity"
                                type="number"
                                min={1}
                                max={20}
                                defaultValue={1}
                                className={`${fieldClass} w-20`}
                              />
                            </label>
                            <label className="text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                Label (optional)
                              </span>
                              <input
                                name="label"
                                placeholder="e.g. Bed A / Manager"
                                className={`${fieldClass} w-40`}
                              />
                            </label>
                            <label className="text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                Monthly rate
                              </span>
                              <input
                                name="monthlyRate"
                                inputMode="decimal"
                                placeholder="1200"
                                className={`${fieldClass} w-28`}
                              />
                            </label>
                            <button
                              type="submit"
                              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-surface-muted"
                            >
                              Add
                            </button>
                          </form>
                          <p className="mt-2 text-xs text-muted-foreground">
                            A bunk counts as 2 beds (top &amp; bottom). For a
                            3-bed room, add one bunk plus one single.
                          </p>
                        </details>
                      </div>
                    );
                  })}
                </div>

                {/* Add room */}
                <details className="mt-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary marker:content-none">
                    + Add room
                  </summary>
                  <form
                    action={createRoom}
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="houseId" value={house.id} />
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        Room name
                      </span>
                      <input
                        name="name"
                        required
                        placeholder="e.g. Room 1"
                        className={`${fieldClass} w-44`}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        Floor
                      </span>
                      <select
                        name="floor"
                        defaultValue="1"
                        className={`${fieldClass} w-36`}
                      >
                        {floorOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-surface-muted"
                    >
                      Add room
                    </button>
                  </form>
                </details>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
