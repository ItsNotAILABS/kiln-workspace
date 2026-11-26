// Stub harness: oauthPreflight not-yet-active mapping (preflight fix).
// Drives the REAL createIdentityClient from kiln-identity-core.js with a
// fake fetchImpl returning canned daemon answers. Bar:
//   401 operator-gate ("unauthorized: valid token required …") -> {configured:false}
//   404                                                          -> {configured:false}
//   503 {error:"provider_not_configured"}                        -> {configured:false}
//   500                                                          -> throws IdentityApiError(500)
//   401 with any OTHER message (genuine auth error)              -> throws (not swallowed)
//   503 with any other error                                     -> throws
//   302 redirect (configured provider)                           -> {configured:true}
import { createIdentityClient, IdentityApiError, isNotYetActive } from "../public/assets/kiln-identity-core.js";

let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { console.log((ok ? "PASS" : "FAIL") + " " + name + " " + extra); ok ? pass++ : fail++; };

function res(status, body, extra = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    type: extra.type || "basic",
    json: async () => { if (body === undefined) throw new Error("no body"); return body; },
  };
}
const clientFor = (r) => createIdentityClient({ fetchImpl: async () => r, getToken: () => null });

const gate401 = { error: "unauthorized: valid token required (Bearer <redacted> or Basic password)" };

let pf = await clientFor(res(401, gate401)).oauthPreflight("google", "/login");
t("401 operator-gate -> not configured", pf.configured === false, JSON.stringify(pf));

pf = await clientFor(res(404, { error: "not found" })).oauthPreflight("google", "/login");
t("404 -> not configured", pf.configured === false, JSON.stringify(pf));

pf = await clientFor(res(404, undefined)).oauthPreflight("x", "/login");
t("404 no-body -> not configured", pf.configured === false, JSON.stringify(pf));

pf = await clientFor(res(503, { error: "provider_not_configured", provider: "google" })).oauthPreflight("google", "/login");
t("503 provider_not_configured -> not configured", pf.configured === false, JSON.stringify(pf));

try { await clientFor(res(500, { error: "boom" })).oauthPreflight("google", "/login"); t("500 throws", false); }
catch (e) { t("500 throws", e instanceof IdentityApiError && e.status === 500, "status=" + e.status); }

try { await clientFor(res(401, { error: "invalid session token" })).oauthPreflight("google", "/login"); t("401 other-message throws", false); }
catch (e) { t("401 other-message throws", e instanceof IdentityApiError && e.status === 401 && !isNotYetActive(e), "status=" + e.status); }

try { await clientFor(res(503, { error: "upstream_down" })).oauthPreflight("google", "/login"); t("503 other throws", false); }
catch (e) { t("503 other throws", e instanceof IdentityApiError && e.status === 503, "status=" + e.status); }

pf = await clientFor(res(302, undefined)).oauthPreflight("google", "/login");
t("302 -> configured", pf.configured === true, JSON.stringify(pf));

console.log(`harness: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
