// Hourly job for the public repo aspandos/ig-stats (see README.md): reads @aspandos0's follower count from the
// Instagram API and writes stats.json (latest) and history.json (the growth record the site can chart later).
// IG_TOKEN comes from the repository secret. It is only ever sent to graph.instagram.com, never written or printed.
import { readFile, writeFile } from "node:fs/promises";

const API = "https://graph.instagram.com";
const HISTORY_GAP_MS = 6 * 3_600_000;

const token = process.env.IG_TOKEN;
if (!token) {
  // Before setup there is no secret yet: skip quietly instead of failing (and emailing) every hour.
  console.log("::warning::IG_TOKEN is not set yet. Add it under Settings → Secrets and variables → Actions.");
  process.exit(0);
}

async function call(path, params) {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  const res = await fetch(url);
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
const me = await call("/me", { fields: "username,followers_count,media_count" });
if (typeof me.followers_count !== "number") throw new Error("/me: no followers_count in the response");

const prev = await readJson("stats.json", {});
let tokenExpires = prev.tokenExpires ?? null;

// Long-lived tokens last 60 days unless refreshed. Once a day the job refreshes it; Meta answers with the
// token's new expiry. If Meta ever hands back a different token, the secret has to be replaced by hand.
if (now.getUTCHours() === 3) {
  try {
    const r = await call("/refresh_access_token", { grant_type: "ig_refresh_token" });
    if (typeof r.expires_in === "number") tokenExpires = new Date(now.getTime() + r.expires_in * 1000).toISOString();
    if (r.access_token && r.access_token !== token) {
      console.log("::warning::Instagram returned a new token. Put it in the IG_TOKEN secret before the old one expires.");
    }
  } catch (e) {
    console.log(`::warning::Token refresh failed: ${e.message}`);
  }
}

const stats = {
  username: me.username,
  followers: me.followers_count,
  media: me.media_count,
  updated: now.toISOString(),
  tokenExpires,
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
