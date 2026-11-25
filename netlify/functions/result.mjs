/**
 * Netlify Function: /nexora/result
 *
 * Nexora polls this with ?state=... after capturing nexora://oauth/relay.
 * Returns the one-time stored token result and deletes it. Expired or
 * unknown states return 404 {error: "not_found"} — Nexora treats that as
 * "relay did not return a result".
 */
import { createStoreOrReport } from "./_store.mjs";

const TTL_MS = 5 * 60 * 1000;

function storageProblem(r) {
  return {
    statusCode: 503,
    body: JSON.stringify({ error: "storage_unavailable", problem: r.problem, detail: r.detail })
  };
}

export async function handler(event) {
  const q = event.queryStringParameters || {};
  const state = String(q.state || "");
  if (!state) return { statusCode: 400, body: JSON.stringify({ error: "missing_state" }) };

  const r = createStoreOrReport();
  if (!r.store) return storageProblem(r);
  const store = r.store;
  const key = `oauth:${state}`;

  let item = null;
  try {
    item = await store.get(key, { type: "json" });
  } catch {
    return { statusCode: 404, body: JSON.stringify({ error: "not_found" }) };
  }
  if (!item || Date.now() - (item.at ?? 0) > TTL_MS) {
    // Opportunistically clean up the expired entry, then report not found.
    try { await store.delete(key); } catch { /* ignore */ }
    return { statusCode: 404, body: JSON.stringify({ error: "not_found" }) };
  }

  await store.delete(key); // one-time read: the token result never lingers
  return { statusCode: 200, body: JSON.stringify(item) };
}
