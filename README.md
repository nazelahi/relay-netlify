# Nexora relay on Netlify (free tier, no domain, no credit card)

Same relay as `relay/` (Render/Express), rebuilt for Netlify Functions. The
difference: serverless functions are ephemeral, so the one-time token store
uses **Netlify Blobs** (strongly consistent, included in the free plan)
instead of process memory.

## Deploy steps

1. Push this folder to a GitHub repo (its own repo; never commit secrets).
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
   Netlify auto-detects `netlify.toml`. No build command needed.
3. **Site configuration → Environment variables**, add:

| Key | Value |
|---|---|
| `META_APP_ID` | your Meta App ID |
| `META_APP_SECRET` | your Meta App Secret |
| `META_REDIRECT_URI` | `https://<your-site>.netlify.app/nexora/callback` |

If you deployed by **drag-and-drop** (manual upload), also add the two Blobs
variables below — Netlify Blobs only auto-initializes on Git/CLI-linked
sites:

| Key | Value |
|---|---|
| `NETLIFY_SITE_ID` | Site configuration → General → Site ID |
| `NETLIFY_API_TOKEN` | personal access token (User settings → Applications → New access token) |

The functions detect the missing Blobs context and fall back to manual
configuration automatically (`netlify/functions/_store.mjs`).

4. Deploy. Note the site URL, e.g. `https://nexora-relay.netlify.app`.

## Register in Meta

Facebook Login → Settings → Valid OAuth Redirect URIs:

```
https://<your-site>.netlify.app/nexora/callback
```

Strict Mode ON. Exact URL.

## Configure Nexora

Pages & Accounts → Meta App Configuration:

- **App ID:** your Meta App ID
- **Registered HTTPS redirect URI:** `https://<your-site>.netlify.app/nexora/callback`
- **HTTPS token relay result URL:** `https://<your-site>.netlify.app/nexora/result`

## Verify

Open `https://<your-site>.netlify.app/healthz` in a browser → should show `ok`.

Then run a live login from Nexora.

## Notes & limits (free tier)

- Netlify Functions: 125k invocations/month — a relay uses ~3 per login; you
  will never hit the cap.
- Synchronous function timeout is 10 s; the two Graph API calls take < 2 s.
- **No cold-start problem** like Render's free tier — Netlify functions are
  on-demand with fast starts, so no uptime pinger is required.
- Blobs entries expire by TTL check (5 min) and are deleted after one read;
  unknown/expired states return 404 as Nexora expects.
- The App Secret lives only in Netlify's environment variables.
- Netlify Blobs requires the site to be deployed once (it initializes the
  store on the platform); it does not work in local `netlify dev` without a
  linked site.
