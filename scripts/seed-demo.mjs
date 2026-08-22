// Demo data for exercising billing and card payments. Writes to the real
// database, so every row is prefixed TEST and `--clean` removes them again.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const ORG_NAME = "Helios Recovery Residences";
const PREFIX = "TEST ";

function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    if (trimmed.slice(0, i).trim() === "DATABASE_URL")
      return trimmed.slice(i + 1).trim();
  }
  throw new Error("DATABASE_URL not found");
}

const sql = postgres(loadEnv(), { prepare: false });
const clean = process.argv.includes("--clean");

// The org is created on first staff login; a second one would be invisible to
// the signed-in account, so refuse rather than create.
const [org] = await sql`select id from organizations where name = ${ORG_NAME} limit 1`;
if (!org) {
  console.error(`No organization named "${ORG_NAME}". Sign in to the app once, then rerun.`);
  await sql.end();
  process.exit(1);
}

async function wipe() {
  const residents = await sql`
    delete from residents
    where org_id = ${org.id} and first_name like ${PREFIX + "%"}
    returning id`;
  const houses = await sql`
    delete from houses
    where org_id = ${org.id} and name like ${PREFIX + "%"}
    returning id`;
  console.log(`removed ${residents.length} residents, ${houses.length} houses`);
}

if (clean) {
  await wipe();
  await sql.end();
  process.exit(0);
}

await wipe();

const [house] = await sql`
  insert into houses (org_id, name, address_line1, city, state, postal_code)
  values (${org.id}, ${PREFIX + "House"}, '1426 Fairview Ave', 'Spencer', 'IA', '51301')
  returning id`;

const [room] = await sql`
  insert into rooms (house_id, name) values (${house.id}, ${PREFIX + "Room 1"})
  returning id`;

const beds = await sql`
  insert into beds (room_id, house_id, label, status, monthly_rate, rate_period)
  values
    (${room.id}, ${house.id}, ${PREFIX + "Bed A"}, 'occupied', 200.00, 'weekly'),
    (${room.id}, ${house.id}, ${PREFIX + "Bed B"}, 'occupied', 200.00, 'weekly'),
    (${room.id}, ${house.id}, ${PREFIX + "Bed C"}, 'available', 200.00, 'weekly')
  returning id, label`;

const bedA = beds.find((b) => b.label.endsWith("Bed A"));
const bedB = beds.find((b) => b.label.endsWith("Bed B"));

const [avery] = await sql`
  insert into residents (org_id, first_name, last_name, status, bed_id, admit_date, email)
  values (${org.id}, ${PREFIX + "Avery"}, 'Signed', 'active', ${bedA.id}, current_date - 30, 'avery@example.test')
  returning id`;

const [blake] = await sql`
  insert into residents (org_id, first_name, last_name, status, bed_id, admit_date, email)
  values (${org.id}, ${PREFIX + "Blake"}, 'Unsigned', 'active', ${bedB.id}, current_date - 10, 'blake@example.test')
  returning id`;

await sql`
  insert into residents (org_id, first_name, last_name, status, email)
  values (${org.id}, ${PREFIX + "Casey"}, 'Prospect', 'prospect', 'casey@example.test')`;

// Only Avery clears the Standard 3a gate; Blake is left unsigned so the block can be seen.
await sql`
  insert into intake_documents (org_id, resident_id, type, title, status, signed_name, signed_at)
  values (${org.id}, ${avery.id}, 'fee_schedule', 'Schedule of Fees & Refund Policy', 'signed', 'Avery Signed', now())`;

console.log("seeded:");
console.log(`  house   ${house.id}`);
console.log(`  Avery   ${avery.id}  fee schedule SIGNED   -> can be charged a card`);
console.log(`  Blake   ${blake.id}  fee schedule MISSING  -> gate should block`);
console.log("  Casey   prospect, no bed");
console.log("\nremove with: node scripts/seed-demo.mjs --clean");

await sql.end();
