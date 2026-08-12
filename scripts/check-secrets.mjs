// Refuses a commit that contains a real credential. Scans staged content only,
// so an untracked scratch file with a key in it will not trip this.
import { execFileSync } from "node:child_process";

const PATTERNS = [
  { label: "Stripe secret or restricted key", re: /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}/ },
  { label: "Stripe webhook signing secret", re: /\bwhsec_[A-Za-z0-9]{32,}/ },
  { label: "Supabase service role key", re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { label: "Telnyx API key", re: /\bKEY[A-Z0-9]{20,}_[A-Za-z0-9]{20,}/ },
  { label: "Private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

// Vendored docs quote example keys, and this file names the patterns it hunts.
const SKIP = [/^\.agents\//, /^scripts\/check-secrets\.mjs$/];

const git = (args) => execFileSync("git", args, { encoding: "utf8" });

const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)));

const hits = [];
for (const file of staged) {
  let content;
  try {
    content = git(["show", `:${file}`]);
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  content.split("\n").forEach((line, i) => {
    for (const { label, re } of PATTERNS) {
      if (re.test(line)) hits.push({ file, line: i + 1, label });
    }
  });
}

if (hits.length) {
  console.error("\nCommit blocked. Staged files contain what look like real credentials:\n");
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.label}`);
  console.error(
    "\nMove the value into .env.local (gitignored) and read it from process.env.",
  );
  console.error("If this is a false positive: git commit --no-verify\n");
  process.exit(1);
}
