# ig-stats

Follower count for [@aspandos0](https://www.instagram.com/aspandos0/), refreshed every hour by a GitHub Action and read by [aspandos.github.io](https://aspandos.github.io/about/).

- `stats.json`: the latest numbers (`followers`, `media`, `updated`).
- `history.json`: `[time, followers]` rows, one per change or every six hours, for the growth chart.
- `update.mjs`: the job. It calls the Instagram API with the `IG_TOKEN` secret and writes the two files.

The first row (1 Nov 2026, 826 followers) was copied by hand from Instagram's professional dashboard.

## Setup

The Instagram account must be a professional (Business or Creator) account.

1. In [Meta for Developers](https://developers.facebook.com/apps/), the app **aspandos stats** (business portfolio Bad Duck ProDuction, development mode) has the Instagram use case with the configuration **Instagram API (единый вход)**: permissions `instagram_basic` and `instagram_manage_messages` (Meta requires the second; the job only reads the profile). @aspandos0 is an Instagram Tester under **App roles → Roles**.
2. Under **Use cases → Instagram → API setup with Unified login → 2. Generate access tokens**, click **Generate token** next to aspandos0, log in and copy the token. Meta shows it once. It does not expire.
3. Save it as the repository secret `IG_TOKEN` (**Settings → Secrets and variables → Actions**), or run `gh secret set IG_TOKEN --repo aspandos/ig-stats` and paste it at the prompt. Never commit it or paste it anywhere else.
4. Optional check: start a run from the Actions tab (**Update Instagram stats → Run workflow**) or with `gh workflow run update.yml --repo aspandos/ig-stats`. `stats.json` should show the current follower count a minute later.

## If a run fails

GitHub emails the repo owner about failed runs; the site keeps showing the last good number. A run with `(code 190)` in its log means the token was revoked: this happens if the app is removed from the business portfolio, the Instagram account moves to another portfolio, or the tester role is removed. Generate a new token (step 2) and save it again (step 3).

## Revoking access

In Meta Business Settings, remove the app under **Integrations → Connected apps** (or delete the app in Meta for Developers), then delete the `IG_TOKEN` secret here.
