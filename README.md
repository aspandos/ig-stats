# ig-stats

Follower count for [@aspandos0](https://www.instagram.com/aspandos0/), refreshed every hour by a GitHub Action and read by [aspandos.github.io](https://aspandos.github.io/about/).

- `stats.json`: the latest numbers (`followers`, `media`, `updated`), plus `tokenExpires` (the access token's expiry) and `refreshFailures` (failed daily refreshes in a row).
- `history.json`: `[time, followers]` rows, one per change or every six hours, for a growth chart.
- `update.mjs`: the job. It calls the Instagram API with the `IG_TOKEN` secret and writes the two files.

The first row (1 Nov 2026, 826 followers) was copied by hand from Instagram's professional dashboard.

## Setup

The Instagram account must be a professional (Business or Creator) account.

1. In [Meta for Developers](https://developers.facebook.com/apps/), create a Business-type app with the Instagram use case. In the use case's permissions, keep only `instagram_business_basic` (the job reads the profile and nothing else). While the app is in development mode, add @aspandos0 under **App roles → Roles → Add People → Instagram Tester** and accept the invite in Instagram (**Settings → Apps and websites → Tester invites**). Then, under **Instagram → API setup with Instagram business login**, add the account and generate an access token. It is a long-lived token (60 days).
2. Save it as the repository secret `IG_TOKEN` (**Settings → Secrets and variables → Actions**), or run `gh secret set IG_TOKEN --repo aspandos/ig-stats` and paste it at the prompt. Never commit it or paste it anywhere else.
3. Optional check: start a run from the Actions tab (**Update Instagram stats → Run workflow**) or with `gh workflow run update.yml --repo aspandos/ig-stats`. `stats.json` should show the current follower count a minute later.
4. Let the job store renewed tokens. Once a day it refreshes the token, and Meta may answer with a new token string. To save it, the job needs a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new): repository access **Only select repositories → aspandos/ig-stats**, repository permission **Secrets: Read and write**, nothing else. Save it as the secret `SECRETS_PAT` the same way as in step 2. GitHub emails you before it expires; replace it then.

## If a run fails

GitHub emails the repo owner about failed runs; the site keeps showing the last good number. The run log says which case it is:

- `/me: HTTP 400 … (code 190)`: the Instagram token expired or was revoked. Generate a new one (step 1) and save it again (step 2).
- `the token refresh failed … days in a row` or `the access token expires on …`: generate a new token before that date (steps 1 and 2).
- `there is no SECRETS_PAT secret`: do step 4. The current token keeps working meanwhile; the next daily refresh saves the new one.
- `gh: Bad credentials` in **Store the renewed token**: `SECRETS_PAT` expired. Make a new one (step 4).

## Revoking access

Remove the app in Instagram (**Settings → Apps and websites → Active**), then delete the `IG_TOKEN` and `SECRETS_PAT` secrets here and the personal access token under GitHub **Settings → Developer settings**.
