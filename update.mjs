// Hourly job for the public repo aspandos/ig-stats (see README.md): reads @aspandos0's follower count from the
// Instagram API and writes stats.json (latest) and history.json (the growth record the site charts).
// IG_TOKEN comes from the repository secret. It is only ever sent to Meta's API and never printed.
import { readFile, writeFile } from "node:fs/promises";

const HISTORY_GAP_MS = 6 * 3_600_000;
// @aspandos0's Instagram account id, as Meta's API setup page lists it. IG_USER_ID overrides it.
const IG_USER_ID = process.env.IG_USER_ID || "17841402931178005";

const token = process.env.IG_TOKEN;
if (!token) {
  // Before setup there is no secret yet: skip quietly instead of failing (and emailing) every hour.
  console.log("::warning::IG_TOKEN is not set yet. Add it under Settings → Secrets and variables → Actions.");
  process.exit(0);
}

// The token from "Generate token" under API setup with Unified login is a Facebook token (it starts with EAA)
// that never expires; it reads the account by id on graph.facebook.com. A token from Instagram business login
// starts with IG and reads /me on graph.instagram.com instead.
const instagramLogin = token.startsWith("IG");
const API = instagramLogin ? "https://graph.instagram.com/v26.0/" : "https://graph.facebook.com/v26.0/";
const path = instagramLogin ? "me" : IG_USER_ID;

async function call(path, params) {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  // No redirects: the URL carries the token and must not be replayed to another host.
  const res = await fetch(url, { redirect: "error" });
  const body = await res.json().catch(() => ({}));
  // Graph errors carry a message and a code, never the token; the URL (which holds it) is not printed.
  if (!res.ok) throw new Error(`/${path}: HTTP ${res.status} ${body?.error?.message ?? ""} (code ${body?.error?.code ?? "?"})`);
  return body;
}

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

let me;
try {
  me = await call(path, { fields: "username,followers_count,media_count" });
  if (!Number.isSafeInteger(me.followers_count)) throw new Error(`/${path}: no followers_count in the response`);
} catch (e) {
  // No retry: a bad token stays bad until it is replaced. The site keeps showing the last good number.
  console.log(`::error::${e.message}. See README.md → If a run fails.`);
  process.exit(1);
}

const stats = {
  username: me.username,
  followers: me.followers_count,
  media: me.media_count,
  updated: new Date().toISOString(),
};
await writeFile("stats.json", `${JSON.stringify(stats, null, 2)}\n`);

// One row per change, or every six hours when nothing changes, so the file stays small.
const history = await readJson("history.json", []);
const last = history[history.length - 1];
if (!last || last[1] !== stats.followers || Date.parse(stats.updated) - Date.parse(last[0]) >= HISTORY_GAP_MS) {
  history.push([stats.updated, stats.followers]);
  await writeFile("history.json", `${JSON.stringify(history)}\n`);
}

console.log(`@${stats.username}: ${stats.followers} followers, ${stats.media} posts`);
