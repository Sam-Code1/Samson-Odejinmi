// Query contract check: every Supabase `.from("table").select("…")` in src/ is sent to the real API (public anon key,
// `limit=0`, so no rows are ever returned) and must not fail on schema grounds: unknown/ambiguous relationships
// (PGRST200/PGRST201, the error that broke the student Library) or missing tables (PGRST205).
// "Permission denied" (42501) is expected for tables only signed-in users can read: it means the query itself resolved.
// Usage: node scripts/check-queries.mjs   (reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from env or .env.local)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const env = { ...process.env };
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set"); process.exit(2); }

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f.name) && files.push(p); } })(path.join(root, "src"));

// Exported select constants (e.g. ENTITLEMENT_SELECT) so `.select(CONST)` is checked too.
const consts = {};
for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/export const ([A-Z_]+_SELECT)\s*=\s*\n?\s*"([^"]+)"/g)) consts[m[1]] = m[2];

const queries = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\.from\("([a-z_]+)"\)\s*\.select\(\s*(?:"([^"]*)"|`([^`$]*)`|([A-Z_]+_SELECT))/g)) {
    const sel = (m[2] ?? m[3] ?? consts[m[4]] ?? "").replace(/\s+/g, "");
    if (!sel) continue;
    const k = `${m[1]}?select=${sel}`;
    if (!queries.has(k)) queries.set(k, path.relative(root, f));
  }
}

let bad = 0;
for (const [q, file] of queries) {
  const res = await fetch(`${url}/rest/v1/${q}&limit=0`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (res.ok) continue;
  const body = await res.json().catch(() => ({}));
  if (/^PGRST2/.test(body.code ?? "")) { bad++; console.log(`FAIL  ${file}\n      ${q}\n      ${body.code}: ${body.message}${body.hint ? `\n      hint: ${body.hint}` : ""}`); }
}
console.log(`\n${queries.size} queries checked, ${bad} broken`);
process.exit(bad ? 1 : 0);
