// Stub daemon speaking the LOCKED OAuth contract + minimal accounts surface.
// Mode via env: OAUTH_CONFIGURED=1 makes /start 302 to a fake provider callback.
import http from "node:http";
const configured = process.env.OAUTH_CONFIGURED==="1";
const accounts = new Map(); // owner -> account
const sessions = new Map(); const pendings = new Map(); const handoffs = new Map();
let n=0;
const acct = (owner,name,email)=>({owner,name,email,kind:"user",oauthLinks:[]});
accounts.set("sponsor", acct("sponsor","Sponsor","sponsor@x.io"));
const send=(res,s,obj)=>{res.writeHead(s,{"content-type":"application/json"});res.end(JSON.stringify(obj));};
const srv=http.createServer(async(req,res)=>{
  const u=new URL(req.url,"http://x"); const p=u.pathname;
  let body=null; const chunks=[]; for await(const c of req) chunks.push(c);
  if(chunks.length){ try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{} }
  const auth=(req.headers.authorization||"").replace(/^Bearer /,"");
  const sess=sessions.get(auth);
  if(p==="/_serverFn"||p.startsWith("/api/auth")) return send(res,200,{result:null});
  const m=p.match(/^\/api\/forge\/v1\/accounts\/oauth\/(google|x)\/start$/);
  if(m&&req.method==="GET"){
    if(!configured) return send(res,503,{error:"provider_not_configured"});
    const ret=u.searchParams.get("return")||"/login";
    // simulate provider: known user -> handoff, new user -> pending
    const mode=u.searchParams.get("sim")||"new";
    if(mode==="known"){ const code="hc_"+(++n); handoffs.set(code,"sponsor"); res.writeHead(302,{location:`http://127.0.0.1:18947${ret}#oauth_handoff=${code}`}); return res.end(); }
    const tok="pt_"+(++n); pendings.set(tok,{provider:m[1]}); res.writeHead(302,{location:`http://127.0.0.1:18947${ret}#oauth_pending=${tok}`}); return res.end();
  }
  if(p==="/api/forge/v1/accounts/oauth/handoff"&&req.method==="POST"){
    const owner=handoffs.get(body?.code); if(!owner) return send(res,404,{error:"handoff_not_found"});
    handoffs.delete(body.code); const st="kiln_sess_stub"+(++n); const a=accounts.get(owner);
    sessions.set(st,owner); return send(res,200,{ok:true,account:a,sessionToken:st,expiresAt:new Date(Date.now()+864e5).toISOString()});
  }
  if(p==="/api/forge/v1/accounts/oauth/complete"&&req.method==="POST"){
    const pend=pendings.get(body?.pendingToken); if(!pend) return send(res,404,{error:"pending_not_found"});
    const owner=String(body?.owner||"").toLowerCase();
    if(accounts.has(owner)) return send(res,409,{error:"owner_taken"});
    const a=acct(owner, body?.name||owner, null); a.oauthLinks=[{provider:pend.provider, linkedAt:new Date().toISOString()}];
    accounts.set(owner,a); pendings.delete(body.pendingToken);
    const st="kiln_sess_stub"+(++n); sessions.set(st,owner);
    return send(res,200,{ok:true,account:a,sessionToken:st,expiresAt:new Date(Date.now()+864e5).toISOString()});
  }
  if(p==="/api/forge/v1/accounts/me"&&req.method==="GET"){
    if(!sess) return send(res,401,{error:"valid token required"});
    const a=accounts.get(sess); return send(res,200,{account:a,wallets:[],hasWalletBackup:false});
  }
  if(p==="/api/forge/v1/accounts/login"&&req.method==="POST"){
    if(body?.email==="sponsor@x.io"&&body?.password==="proof-password-1"){ const st="kiln_sess_stub"+(++n); sessions.set(st,"sponsor"); return send(res,200,{ok:true,account:accounts.get("sponsor"),sessionToken:st,expiresAt:new Date(Date.now()+864e5).toISOString()}); }
    return send(res,401,{error:"invalid credentials"});
  }
  return send(res,404,{error:"not_found",path:p});
});
srv.listen(18946,"127.0.0.1",()=>console.log("stub http://127.0.0.1:18946 configured="+configured));
