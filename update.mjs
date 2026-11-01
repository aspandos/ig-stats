// Hourly job for the public repo aspandos/ig-stats (see README.md): reads @aspandos0's follower count from the
// Instagram API and writes stats.json (latest) and history.json (the growth record the site can chart later).
// IG_TOKEN comes from the repository secret. It is only ever sent to graph.instagram.com and never printed;
// a renewed token goes to a file outside the repo, which the workflow's next step stores back as the secret.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API = "https://graph.instagram.com";
const HISTORY_GAP_MS = 6 * 3_600_000;
const DAY = 86_400_000;
// Fail the run (GitHub then emails the owner) while there is still time to fix the token.
const WARN_EXPIRY_MS = 10 * DAY;
const MAX_REFRESH_FAILURES = 2;

const token = process.env.IG_TOKEN;
if (!token) {
  // Before setup there is no secret yet: skip quietly instead of failing (and emailing) every hour.
  console.log("::warning::IG_TOKEN is not set yet. Add it under Settings → Secrets and variables → Actions.");
  process.exit(0);
}

async function call(path, params) {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  // No redirects: the URL carries the token and must not be replayed to another host.
  const res = await fetch(url, { redirect: "error" });
  const body = await res.json().catch(() => ({}));
  // Graph errors carry a message and a code, never the token; the URL (which holds it) is not printed.
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${body?.error?.message ?? ""} (code ${body?.error?.code ?? "?"})`);
  return body;
}

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const now = new Date();
const res = await call("/me", { fields: "username,followers_count,media_count" });
// The IG User reference answers with a flat object; one get-started sample wraps it in "data".
const me = res.data?.[0] ?? res;
if (!Number.isSafeInteger(me.followers_count)) throw new Error("/me: no followers_count in the response");

const prev = await readJson("stats.json", {});
let tokenExpires = prev.tokenExpires ?? null;
let refreshFailures = prev.refreshFailures ?? 0;
const problems = [];

// Long-lived tokens last 60 days and die for good if not refreshed in time. Once a day the job refreshes it.
// Meta may answer with a new token string; that one is written to $RUNNER_TEMP and the workflow stores it
// as IG_TOKEN (with the SECRETS_PAT secret). The first refresh fails if the token is under a day old, so
// only a second failure in a row fails the run.
if (now.getUTCHours() === 3) {
  try {
    const r = await call("/refresh_access_token", { grant_type: "ig_refresh_token" });
    const renewed = typeof r.access_token === "string" && r.access_token !== "" && r.access_token !== token;
    if (renewed) {
      console.log(`::add-mask::${r.access_token}`);
      await writeFile(join(process.env.RUNNER_TEMP ?? ".", "ig_token"), r.access_token, { mode: 0o600 });
    }
    console.log(`Token refreshed${renewed ? " (new token string)" : " (same token string)"}.`);
    if (typeof r.expires_in === "number") tokenExpires = new Date(now.getTime() + r.expires_in * 1000).toISOString();
    refreshFailures = 0;
  } catch (e) {
    refreshFailures += 1;
    console.log(`::warning::Token refresh failed (${refreshFailures} in a row): ${e.message}`);
    if (refreshFailures >= MAX_REFRESH_FAILURES) problems.push(`the token refresh failed ${refreshFailures} days in a row`);
  }
}
if (tokenExpires && Date.parse(tokenExpires) - now.getTime() < WARN_EXPIRY_MS) {
  problems.push(`the access token expires on ${tokenExpires.slice(0, 10)}`);
}

const stats = {
  username: me.username,
  followers: me.followers_count,
  media: me.media_count,
  updated: now.toISOString(),
  tokenExpires,
  refreshFailures,
};
await writeFile("stats.json", `${JSON.stringify(stats, null, 2)}\n`);

// One row per change, or every six hours when nothing changes, so the file stays small.
const history = await readJson("history.json", []);
const last = history[history.length - 1];
if (!last || last[1] !== stats.followers || now.getTime() - Date.parse(last[0]) >= HISTORY_GAP_MS) {
  history.push([stats.updated, stats.followers]);
  await writeFile("history.json", `${JSON.stringify(history)}\n`);
}

console.log(`@${stats.username}: ${stats.followers} followers, ${stats.media} posts`);
if (problems.length) {
  // The numbers above still get committed (the workflow's commit step runs on failure too).
  console.log(`::error::Fix the Instagram token: ${problems.join("; ")}. See README.md → If a run fails.`);
  process.exitCode = 1;
}
