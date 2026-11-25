/**
 * Netlify Function: /nexora/diag
 *
 * Remote health report for the OAuth relay — booleans only, never secrets.
 * Tells us exactly which configuration is present on the DEPLOYED site:
 * which storage mode works, and whether the Meta env vars are set.
 */
import { createStoreOrReport } from "./_store.mjs";

export async function handler() {
  const r = await createStoreOrReport();
  return {
    statusCode: 200,
    body: JSON.stringify({
      blobs: r.store ? "ok" : r.problem,
      blobsDetail: r.store ? null : r.detail,
      metaAppID: Boolean(process.env.META_APP_ID),
      metaSecret: Boolean(process.env.META_APP_SECRET),
      redirectURI: process.env.META_REDIRECT_URI || null,
      netlifySiteIDVar: Boolean(process.env.NETLIFY_SITE_ID),
      netlifyTokenVar: Boolean(process.env.NETLIFY_API_TOKEN)
    })
  };
}
