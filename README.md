# ig-stats

Follower count for [@aspandos0](https://www.instagram.com/aspandos0/), refreshed every hour by a GitHub Action and read by [aspandos.github.io](https://aspandos.github.io/about/).

- `stats.json`: the latest numbers (`followers`, `media`, `updated`, and `tokenExpires`, the access token's expiry).
- `history.json`: `[time, followers]` rows, one per change or every six hours, for a growth chart.
- `update.mjs`: the job. It calls the Instagram API with the `IG_TOKEN` secret and writes the two files.

The first row (1 Nov 2026, 826 followers) was copied by hand from Instagram's professional dashboard.

## Setup

1. In [Meta for Developers](https://developers.facebook.com/apps/), create an app with the Instagram use case. Under **Instagram → API setup with Instagram business login**, add the @aspandos0 account and generate an access token. It is a long-lived token (60 days).
2. Save it as the repository secret `IG_TOKEN` (Settings → Secrets and variables → Actions), or run `gh secret set IG_TOKEN --repo aspandos/ig-stats` and paste it at the prompt. Never commit it.
3. Start the first run from the Actions tab (**Update Instagram stats → Run workflow**) or with `gh workflow run update.yml --repo aspandos/ig-stats`.

The job refreshes the token once a day, so it should not expire while the job runs. If a run fails, GitHub emails the repo owner; the site then keeps showing the last good number.
