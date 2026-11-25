/**
 * Shared Netlify Blobs store for the Nexora OAuth relay.
 *
 * On Git/CLI-linked deploys, getStore() picks up the site context
 * automatically. On drag-and-drop (manual) deploys the context is absent and
 * Netlify throws MissingBlobsEnvironmentError — in that case we fall back to
 * supplying siteID and token manually from environment variables:
 *
 *   NETLIFY_SITE_ID     — Site configuration → General → Site ID
 *   NETLIFY_API_TOKEN   — a Netlify personal access token
 *                         (User settings → Applications → New access token)
 *
 * Both live only in the server's environment, never in Nexora or this repo.
 * Errors are reported as structured data so the remote diag endpoint can
 * show exactly what is missing, without leaking any secret values.
 */
export async function createStoreOrReport() {
  // Load lazily so a missing/broken dependency is reported as JSON by diag
  // instead of turning every function (including diag) into an opaque 500.
  let getStore;
  try {
    ({ getStore } = await import("@netlify/blobs"));
  } catch (moduleError) {
    return {
      problem: "blobs_module_unavailable",
      detail: moduleError.message,
      hasSiteIDVar: Boolean(process.env.NETLIFY_SITE_ID),
      hasTokenVar: Boolean(process.env.NETLIFY_API_TOKEN)
    };
  }

  try {
    return { store: getStore({ name: "nexora-oauth", consistency: "strong" }) };
  } catch (autoError) {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN;
    if (siteID && token) {
      try {
        return { store: getStore({ name: "nexora-oauth", consistency: "strong", siteID, token }) };
      } catch (manualError) {
        return {
          problem: "manual_blobs_failed",
          detail: manualError.message,
          hasSiteIDVar: true,
          hasTokenVar: true
        };
      }
    }
    return {
      problem: "blobs_unconfigured",
      detail: autoError.message,
      hasSiteIDVar: Boolean(siteID),
      hasTokenVar: Boolean(token)
    };
  }
}
