/*
 * Closes the public API surface on every table in the public schema.
 *
 * Why this exists: Supabase exposes every table in `public` through PostgREST
 * to anyone holding the publishable key — and that key ships in the browser
 * bundle. This app never uses that path. It talks to Postgres directly as
 * `postgres` (owns the tables, has BYPASSRLS) and enforces all authorization
 * in application code, so the correct posture is to close the API entirely:
 *
 *   1. RLS on with zero policies -> PostgREST returns no rows.
 *   2. Grants revoked from anon  -> PostgREST cannot see the tables at all.
 *   3. Default privileges fixed  -> new tables are closed on creation.
 *
 * `db:push` runs this automatically. Drizzle creates tables wide open by
 * inheriting Supabase's default grants, so skipping it silently reopens the
 * hole. Safe to run any time; it is idempotent.
 */
import postgres from "postgres";
import { readFileSync } from "fs";

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
  throw new Error("DATABASE_URL not found in environment or .env.local");
}

const sql = postgres(loadEnv(), { prepare: false });

try {
  const tables = await sql`
    SELECT c.relname AS name, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `;

  let changed = 0;
  for (const { name, rls } of tables) {
    if (!rls) {
      await sql.unsafe(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY`);
      changed += 1;
      console.log(`  secured ${name}`);
    }
    await sql.unsafe(`REVOKE ALL ON public.${name} FROM anon, authenticated`);
  }

  for (const objs of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
    await sql.unsafe(
      `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ${objs} FROM anon, authenticated`,
    );
  }
  await sql`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`;
  await sql`REVOKE USAGE ON SCHEMA public FROM anon, authenticated`;

  const open = await sql`
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
  `;

  if (open.length > 0) {
    console.error(`FAILED — still unsecured: ${open.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }

  console.log(
    `Database secured: ${tables.length} tables, RLS on, no anon access` +
      (changed > 0 ? ` (${changed} newly secured)` : ""),
  );
} finally {
  await sql.end();
}
