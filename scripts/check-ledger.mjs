import { readFileSync } from "node:fs";
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

const rows = await sql`
  select r.first_name, r.last_name, p.amount, p.kind, p.method, p.payer_name,
    p.reversal_of_id, p.stripe_session_id, p.stripe_payment_intent_id,
    p.stripe_charge_id, p.stripe_adjustment_id, p.reference, p.received_on,
    (select pr.stripe_refund_id from payment_refunds pr
     where pr.reversal_payment_id = p.id limit 1) as refund_id,
    (select pd.stripe_dispute_id from payment_disputes pd
     where pd.reversal_payment_id = p.id limit 1) as dispute_id
  from payments p join residents r on r.id = p.resident_id
  where r.first_name like 'TEST %'
  order by p.created_at`;

console.log(`payment rows for seeded residents: ${rows.length}`);
for (const r of rows) {
  console.log(`  ${r.first_name} ${r.last_name}  $${r.amount}  ${r.kind}  ${r.method}  payer=${r.payer_name ?? "(resident)"}`);
  console.log(`     reverses=${r.reversal_of_id ?? "none"}  adjustment=${r.stripe_adjustment_id ?? "none"}`);
  console.log(`     session=${r.stripe_session_id ?? "none"}`);
  console.log(`     pi=${r.stripe_payment_intent_id ?? r.reference ?? "none"}  charge=${r.stripe_charge_id ?? "none"}`);
  console.log(`     refund=${r.refund_id ?? "none"}  dispute=${r.dispute_id ?? "none"}  on=${r.received_on.toISOString?.().slice(0, 10) ?? r.received_on}`);
}

const balances = await sql`
  select r.first_name, r.last_name,
         coalesce((select sum(c.amount) from charges c
                   where c.resident_id = r.id and c.waived_at is null), 0) as charged,
         coalesce((select sum(p.amount) from payments p
                   where p.resident_id = r.id), 0) as paid
  from residents r
  where r.first_name like 'TEST %' and r.status = 'active'
  order by r.first_name`;

console.log("\nbalances:");
for (const b of balances) {
  console.log(`  ${b.first_name} ${b.last_name}: charged $${b.charged}, paid $${b.paid}, owes $${(Number(b.charged) - Number(b.paid)).toFixed(2)}`);
}

await sql.end();
