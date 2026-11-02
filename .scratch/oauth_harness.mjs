// Contract harness: app core client vs stub daemon (locked contract).
import { createIdentityClient, parseOAuthFragment, IdentityApiError } from "../public/assets/kiln-identity-core.js";
const base = "http://127.0.0.1:18947/api/forge/v1"; // via origin proxy -> stub
const client = createIdentityClient({ base, getToken: () => null });
let pass = 0, fail = 0;
const t = (name, ok, extra="") => { console.log((ok?"PASS":"FAIL")+" "+name+" "+extra); ok?pass++:fail++; };
t("fragment handoff", parseOAuthFragment("#oauth_handoff=abc")?.kind==="handoff");
t("fragment pending", parseOAuthFragment("#oauth_pending=tok")?.kind==="pending");
t("fragment none", parseOAuthFragment("#other=1")===null && parseOAuthFragment("")===null);
const pf = await client.oauthPreflight("google","/login");
t("preflight not-configured", pf.configured===false, JSON.stringify(pf));
t("start url", client.oauthStartUrl("x","/login")==="http://127.0.0.1:18947/api/forge/v1/accounts/oauth/x/start?return=%2Flogin", client.oauthStartUrl("x","/login"));
// configured-mode flows are exercised through the browser probe (stub restarted with OAUTH_CONFIGURED=1)
try { await client.oauthHandoff("bogus"); t("handoff bogus 404", false); } catch(e){ t("handoff bogus 404", e instanceof IdentityApiError && e.status===404, "status="+e.status); }
console.log(`harness: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
