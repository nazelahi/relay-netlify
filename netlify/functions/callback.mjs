/**
 * Netlify Function: /nexora/callback
 *
 * Meta redirects here with ?code=...&state=... (or ?error=...&state=...).
 * Exchanges the code for a long-lived user token using META_APP_SECRET
 * (server-side only), stores the result in Netlify Blobs keyed by state,
 * then redirects the browser to nexora://oauth/relay?state=...
 * which ASWebAuthenticationSession in Nexora captures.
 *
 * Serverless-safe: state goes to Netlify Blobs (shared, strongly consistent),
 * NOT in-memory — each function invocation is a separate ephemeral instance.
 * Never log codes or tokens.
 */
import { createStoreOrReport } from "./_store.mjs";

const TTL_MS = 5 * 60 * 1000;

function storageProblem(r) {
  return {
    statusCode: 503,
    body: JSON.stringify({ error: "storage_unavailable", problem: r.problem, detail: r.detail })
  };
}

async function graph(params) {
  const url = new URL("https://graph.facebook.com/v27.0/oauth/access_token");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
  return body;
}

function redirect(state, error) {
  const suffix = error ? `&error=${encodeURIComponent(error)}` : "";
  return {
    statusCode: 302,
    headers: { Location: `nexora://oauth/relay?state=${encodeURIComponent(state)}${suffix}` }
  };
}

export async function handler(event) {
  const q = event.queryStringParameters || {};
  const state = String(q.state || "");
  if (!state) return { statusCode: 400, body: "Missing state" };

  // Strongly consistent store: the /nexora/result read must see this write.
  const r = await createStoreOrReport();
  if (!r.store) return storageProblem(r);
  const store = r.store;

  if (q.error) {
    await store.setJSON(`oauth:${state}`, {
      error: String(q.error),
      error_description: String(q.error_description || "Meta Login failed"),
      at: Date.now()
    });
    return redirect(state, String(q.error));
  }

  const code = String(q.code || "");
  if (!code) return { statusCode: 400, body: "Missing code" };

  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;
  const REDIRECT_URI = process.env.META_REDIRECT_URI;

  try {
    const short = await graph({
      client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code
    });
    const long = await graph({
      grant_type: "fb_exchange_token",
      client_id: APP_ID, client_secret: APP_SECRET,
      fb_exchange_token: short.access_token
    });
    await store.setJSON(`oauth:${state}`, {
      state,
      access_token: long.access_token,
      token_type: long.token_type,
      expires_in: long.expires_in,
      at: Date.now()
    });
    return redirect(state, null);
  } catch (error) {
    await store.setJSON(`oauth:${state}`, {
      error: "server_error",
      error_description: "Token exchange failed",
      at: Date.now()
    });
    return redirect(state, "server_error");
  }
}
