// Ephemeral REAL daemon (lane-b-oauth worktree code) + contract checks
// driven through the APP's own core client.
import { makeStateDir } from "/home/hatch/workspace/.worktrees/kiln-lane-b-oauth/swarm/test/helpers.mjs";
import { startApiServer } from "/home/hatch/workspace/.worktrees/kiln-lane-b-oauth/swarm/lib/httpapi.mjs";
import { createIdentityClient, IdentityApiError } from "../public/assets/kiln-identity-core.js";
const dir = makeStateDir();
process.env.KILN_SWARM_API_PORT = "0";
let api;
try { api = await startApiServer(dir, { apiPort: 0 }); } finally { delete process.env.KILN_SWARM_API_PORT; }
console.log("daemon:", api.url);
const base = api.url + "/v1";
let token = null;
const client = createIdentityClient({ base, getToken: () => token });
let pass = 0, fail = 0;
const t = (n, ok, x="") => { console.log((ok?"PASS":"FAIL")+" "+n+" "+x); ok?pass++:fail++; };
// signup a real account to inspect /me shape
const su = await client.signup({ email: "eph@x.io", name: "Eph", owner: "ephuser", password: "eph-password-1" }).catch((e) => ({ err: e }));
t("signup", !!su.account, su.err ? ("status="+su.err.status+" msg="+su.err.message) : JSON.stringify(su).slice(0,120));
const li = await client.login({ email: "eph@x.io", password: "eph-password-1" }).catch((e)=>({err:e}));
t("login", !!li.sessionToken, li.err ? ("status="+li.err.status+" msg="+li.err.message) : "");
token = li.sessionToken;
const me = await client.me().catch((e) => ({ err: e }));
t("me has oauthLinks array", Array.isArray(me.account && me.account.oauthLinks), JSON.stringify(me.account && me.account.oauthLinks));
// preflight against real daemon (no provider creds in env) -> not configured
const pf = await client.oauthPreflight("google", "/login").catch((e) => ({ err: e }));
t("real preflight google not-configured", pf.configured === false, JSON.stringify(pf));
const pfX = await client.oauthPreflight("x", "/login").catch((e) => ({ err: e }));
t("real preflight x not-configured", pfX.configured === false, JSON.stringify(pfX));
// bogus handoff -> AccountsError (404 per accounts.mjs)
try { await client.oauthHandoff("bogus-code"); t("real handoff bogus rejects", false); } catch (e) { t("real handoff bogus rejects", e instanceof IdentityApiError, "status=" + e.status + " msg=" + e.message); }
// bogus pending complete -> rejects, and a real pending can't be forged
try { await client.oauthComplete({ pendingToken: "bogus", owner: "someonenew", name: "S" }); t("real complete bogus rejects", false); } catch (e) { t("real complete bogus rejects", e instanceof IdentityApiError, "status=" + e.status + " msg=" + e.message); }
console.log(`eph-daemon: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
