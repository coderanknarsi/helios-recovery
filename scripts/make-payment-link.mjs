// Stands in for the staff UI, which needs a login this test cannot perform.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i !== -1 && t.slice(0, i).trim() === "DATABASE_URL") return t.slice(i + 1).trim();
  }
  throw new Error("DATABASE_URL not found");
}

const sql = postgres(loadEnv(), { prepare: false });
const thirdParty = process.argv.includes("--third-party");

const people = await sql`
  select r.id, r.org_id, r.first_name, r.last_name
  from residents r
  where r.first_name like 'TEST %' and r.status = 'active'
  order by r.first_name`;

const gate = await sql`
  select resident_id from intake_documents
  where type = 'fee_schedule' and status = 'signed'
    and resident_id in ${sql(people.map((p) => p.id))}`;
const signed = new Set(gate.map((g) => g.resident_id));

console.log("fee schedule gate:");
for (const p of people) {
  console.log(`  ${p.first_name} ${p.last_name}: ${signed.has(p.id) ? "SIGNED -> can pay" : "MISSING -> blocked"}`);
}

const avery = people.find((p) => signed.has(p.id));
if (!avery) {
  console.error("no seeded resident with a signed fee schedule");
  await sql.end();
  process.exit(1);
}

const [charge] = await sql`
  insert into charges (org_id, resident_id, type, description, amount, due_date)
  values (${avery.org_id}, ${avery.id}, 'rent', 'Weekly rent', 200.00, current_date)
  returning id`;

const token = randomBytes(24).toString("base64url");
const initials = `${avery.first_name.charAt(0)}${avery.last_name.charAt(0)}`.toUpperCase();
const label = `${initials} ${avery.id.slice(0, 4).toUpperCase()}`;

await sql`
  insert into payment_links (org_id, resident_id, token, amount, label, third_party, expires_at)
  values (${avery.org_id}, ${avery.id}, ${token}, 200.00, ${label},
          ${thirdParty}, now() + interval '30 days')`;

console.log(`\ncharge ${charge.id} for $200.00`);
console.log(`label  "${label}"  third_party=${thirdParty}`);
console.log(`\nhttp://localhost:3000/pay/${token}`);

await sql.end();
