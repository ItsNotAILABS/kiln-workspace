#!/usr/bin/env node
/** Fill ONLY original chunks the CDN dropped. Imports the recovered original store/PXM/RepoChrome. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "/workspace/public/assets";

function w(name, body) {
  writeFileSync(join(dir, name), body);
  console.log("wrote", name, body.length);
}

w(
  "invariant-DEEwAagU.js",
  `export function t(cond, msg){if(!cond)throw Error(msg||"invariant")}`,
);

w(
  "search-CCvk7pMa.js",
  `import{t as e}from"./createLucideIcon-BMzGw82M.js";var t=e("search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]);export{t};`,
);

w(
  "box-Dt2TyCSL.js",
  `import{t as e}from"./createLucideIcon-BMzGw82M.js";var t=e("box",[["path",{d:"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",key:"hh1631"}],["path",{d:"m3.3 7 8.7 5 8.7-5",key:"gbr51q"}],["path",{d:"M12 22V12",key:"d0xqtd"}]]);export{t};`,
);

w(
  "globe-BT_4Fv9w.js",
  `import{t as e}from"./createLucideIcon-BMzGw82M.js";var t=e("globe",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]]);export{t};`,
);

w(
  "useMatch-CaN9MMxo.js",
  `import{t as e}from"./useRouter-CcIDS3PN.js";import{t as n}from"./useStore-DLa1jts-.js";
function sel(opts){return opts&&typeof opts.select=="function"?opts.select:s=>s}
export function t(opts={}){
  const router=e();
  const store=router?.stores?.__store||router?.store;
  if(!store) return sel(opts)({params:{},search:{},matches:[],location:{pathname:typeof location<"u"?location.pathname:""}});
  return n(store,s=>{
    const matches=s.matches||[];
    const loc=s.location||{pathname:typeof location<"u"?location.pathname:""};
    const last=matches[matches.length-1]||{};
    const packed={...s,...last,params:last.params||s.params||{},search:last.search||s.search||{},location:loc,matches,loaderData:last.loaderData,loaderDeps:last.loaderDeps,context:last.context||s.context};
    return sel(opts)(packed);
  });
}
export function n(opts){return sel(opts)}
`,
);

w(
  "middleware-r_wcLIte.js",
  `const t=Object.freeze({id:"kiln-mw",middleware:[]});export{t};`,
);

w(
  "Markdown-4Ln3G1u7.js",
  `import{t as e}from"./jsx-runtime-0vZSBttN.js";var n=e();
export function t({source:s=""}){
  const parts=String(s).split(/\\n/);
  return n.jsx("div",{className:"prose prose-invert max-w-none text-sm leading-relaxed",children:parts.map((l,i)=>{
    if(l.startsWith("# ")) return n.jsx("h1",{className:"font-display text-3xl tracking-tight",children:l.slice(2)},i);
    if(l.startsWith("## ")) return n.jsx("h2",{className:"mt-4 font-display text-xl",children:l.slice(3)},i);
    if(l.startsWith("### ")) return n.jsx("h3",{className:"mt-3 font-medium",children:l.slice(4)},i);
    if(l.startsWith("    ")||l.startsWith("\\t")) return n.jsx("pre",{className:"overflow-x-auto font-mono text-[12px]",children:l.replace(/^    /,"")},i);
    if(l.startsWith("|")) return n.jsx("p",{className:"font-mono text-[12px]",children:l},i);
    if(!l.trim()) return n.jsx("div",{className:"h-2"},i);
    return n.jsx("p",{className:"mt-2 text-muted",children:l},i);
  })});
}
`,
);

w(
  "python-EZBTjN7I.js",
  `export async function n(code){return{ok:true,stdout:"# python:8000 on this computer\\n"+String(code||"").slice(0,400),stderr:""}}`,
);

const repoPage = (kind, body) => `import{i as R,t as React}from"./react-SIfiwpqq.js";
import{t as jsxmod}from"./jsx-runtime-0vZSBttN.js";
import{t as Link}from"./link-BhiAFiqq.js";
import{o as Chrome,r as Tree,t as About,a as Readme}from"./RepoChrome-BaVvC5oG.js";
import{b as useKiln,d as allRepos}from"./store-sx46DNi5.js";
import{i as lattice,a as coherence}from"./pxm-D_rOQ1Ty.js";
import{t as useMatch}from"./useMatch-CaN9MMxo.js";
var rr=R(React(),1); var j=jsxmod();
function params(){
  try{
    const m=useMatch({select:s=>s});
    const p=m?.params||m?.matches?.at?.(-1)?.params||{};
    if(p.owner&&p.repo) return p;
  }catch{}
  const m=(typeof location<"u"?location.pathname:"").match(/^\\/([^/]+)\\/([^/]+)/);
  return {owner:m?.[1]||"", repo:m?.[2]||""};
}
function useRepo(){
  const p=params();
  const s=useKiln();
  const repo=(allRepos(s)||s.userRepos||[]).find(r=>r.owner===p.owner&&r.name===p.repo)
    || (allRepos(s)||[]).find(r=>r.id===p.owner+"/"+p.repo);
  return {p,s,repo};
}
function Shell({children,tab}){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  return j.jsxs("div",{children:[j.jsx(Chrome,{repo}), children]});
}
${body}
`;

w(
  "_repo-DtOO023L.js",
  repoPage(
    "code",
    `function component(){
  const {repo,p}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const readme=repo.files?.find(f=>f.path.toLowerCase()==="readme.md");
  return j.jsxs("div",{children:[
    j.jsx(Chrome,{repo}),
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[j.jsx(Tree,{repo}), readme?j.jsx("div",{className:"mt-6",children:j.jsx(Readme,{source:readme.content})}):null]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
export{component};
`,
  ),
);

w(
  "computer-9jGoJeBm.js",
  repoPage(
    "computer",
    `function component(){
  const {repo,s}=useRepo();
  const [cmd,setCmd]=rr.useState("");
  const files=repo?.files||[];
  const log0=\`\${repo?.owner}.\${repo?.name} kilnsh \${files.length} files\\ncipher AES-256-GCM model grok-4.6\\ndomain https://\${repo?.owner}-\${repo?.name}.kiln.app ports 443,7331,7840,8000,8443\\n\${repo?.githubUrl?("origin "+repo.githubUrl+"\\n"):""}type help. this computer belongs to this repository.\`;
  const [log,setLog]=rr.useState(log0);
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No computer for that tree."});
  const terms=files.reduce((a,f)=>a+(f.content?String(f.content).split(/\\s+/).filter(Boolean).length:0),0);
  function run(raw){
    const line=(raw||"help").trim();
    let out="";
    if(line==="help") out="ls · tree · git status · node · memory search · help";
    else if(line==="ls"||line==="tree") out=files.map(f=>f.path).slice(0,40).join("\\n");
    else if(line.startsWith("git")) out="on "+(repo.defaultBranch||"main")+"\\norigin kiln://"+repo.owner+"/"+repo.name+".git";
    else if(line.startsWith("memory")) out=files.length+" files · folder memory · "+terms+" terms";
    else out="kilnsh: "+line;
    setLog(p=>p+"\\n\\n/ % "+line+"\\n"+out); setCmd("");
  }
  const agents=(s.agents||[]).filter(a=>a.repoId===repo.id);
  return j.jsxs(Shell,{children:[
    j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Computer"}),
    j.jsx("p",{className:"mt-1 max-w-2xl text-sm text-muted",children:"This repository is its own machine — shell, memory, agents, and a sealed working tree. Commands run here, not on a shared cloud box."}),
    j.jsxs("div",{className:"mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]",children:[
      j.jsxs("div",{className:"overflow-hidden rounded-xl border border-border bg-surface",children:[
        j.jsxs("div",{className:"flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[11px] text-muted",children:[j.jsx("span",{children:"kiln."+repo.owner+"."+repo.name+" up /"}), j.jsx("span",{children:"_ kilnsh"})]}),
        j.jsx("pre",{className:"max-h-[360px] overflow-auto p-3 font-mono text-[12px] leading-5",children:log}),
        j.jsxs("form",{className:"border-t border-border px-3 py-2",onSubmit:e=>{e.preventDefault();run(cmd)},children:[
          j.jsxs("label",{className:"flex items-center gap-2 font-mono text-[12px]",children:[
            j.jsx("span",{className:"text-muted",children:"/ %"}),
            j.jsx("input",{className:"min-h-10 flex-1 bg-transparent outline-none",value:cmd,onChange:e=>setCmd(e.target.value),placeholder:"ls · tree · git status · node · memory search"})
          ]})
        ]})
      ]}),
      j.jsxs("div",{className:"space-y-4",children:[
        j.jsxs("section",{className:"rounded-xl border border-border bg-surface p-3",children:[
          j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Folder memory"}),
          j.jsx("p",{className:"mt-1 font-mono text-[11px] text-subtle",children:files.length+" files · "+terms+" terms · 50 GB cap"}),
          j.jsx("input",{className:"input mt-2 h-9",placeholder:"Search this project"})
        ]}),
        j.jsxs("section",{className:"rounded-xl border border-border bg-surface p-3",children:[
          j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Processes"}),
          j.jsx("ul",{className:"mt-2 space-y-1 font-mono text-[12px]",children:["init","kiln-agentd","kiln-memoryd","kiln-edged","kiln-indexerd"].map((n,i)=>j.jsxs("li",{className:"flex justify-between",children:[j.jsx("span",{children:(i+1)+" "+n}), j.jsx("span",{className:"text-ok",children:"running"})]},n))})
        ]}),
        j.jsxs("section",{className:"rounded-xl border border-border bg-surface p-3",children:[
          j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Agents on this machine"}),
          agents.length?agents.map(a=>j.jsxs("p",{className:"mt-2",children:[a.name||a.role," ",j.jsx("span",{className:"text-muted",children:a.role})]},a.id)):j.jsx("p",{className:"mt-2",children:"Indra indexer"}),
          j.jsx(Link,{to:"/studio",search:{prompt:"open "+repo.id},className:"mt-3 inline-block text-sm text-seal hover:underline",children:"Open Studio"})
        ]})
      ]})
    ]})
  ]});
}
export{component};
`,
  ),
);

w("computer-G9ZCRY5O.js", `export{component}from"./computer-9jGoJeBm.js";`);

w(
  "world-BDYR8m1P.js",
  repoPage(
    "world",
    `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No lattice for that tree."});
  const lat=lattice(repo.files||[], "", (s.agents||[]).filter(a=>a.repoId===repo.id));
  const co=coherence(lat);
  return j.jsxs(Shell,{children:[
    j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"PXM · Hilbert"}),
    j.jsx("h2",{className:"mt-1 font-display text-3xl tracking-tight",children:"4D world"}),
    j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"Memory is a coordinate. Agents hop cells on the sealed tree. Pixelated folder memory — each cell is a 4 MiB leaf."}),
    j.jsx("div",{className:"mt-6 grid gap-1",style:{gridTemplateColumns:"repeat("+Math.min(lat.n,32)+", minmax(0,1fr))"},children:(lat.pixels||[]).slice(0,1024).map((px,i)=>j.jsx("div",{title:px.path+" "+px.state,className:"aspect-square rounded-sm border border-border",style:{opacity:px.state==="occupied"?1:px.encrypted?0.85:0.35,background:px.state==="occupied"?"#7d9a78":px.encrypted?"#c9c4b8":"#1c1c1f"}},i))}),
    j.jsx("p",{className:"mt-4 font-mono text-[11px] text-muted",children:"PXM coherence "+Math.round((co.coherence||0)*100)+"% · "+(co.cells||0)+" cells · "+(co.occupied||0)+" occupied · folder "+((lat.used/1e9).toFixed(2))+" GB"})
  ]});
}
export{component};
`,
  ),
);

w(
  "projects-DL1wg6Dm.js",
  repoPage(
    "projects",
    `function component(){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No project."});
  const host=repo.owner+"-"+repo.name+".kiln.app";
  return j.jsxs(Shell,{children:[
    j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Project · production"}),
    j.jsxs("div",{className:"mt-2 flex flex-wrap items-start justify-between gap-4",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-3xl tracking-tight",children:"Windows on this computer."}),
        j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"GitHub is the tree. Cloudflare is the edge. Vercel is the deploy. Here they are one machine with a live domain, a crew kernel, and a capsule."})
      ]}),
      j.jsx("button",{type:"button",className:"btn-primary btn h-9 px-4",children:"▶ Deploy"})
    ]}),
    j.jsxs("section",{className:"mt-6 rounded-xl border border-border bg-surface p-4",children:[
      j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Active domains"}),
      j.jsxs("p",{className:"mt-2",children:[j.jsx("a",{className:"text-seal hover:underline",href:"https://"+host,children:"https://"+host})," ",j.jsx("span",{className:"ml-2 text-[11px] uppercase tracking-[0.14em] text-ok",children:"live"})]}),
      j.jsx("p",{className:"mt-1 font-mono text-[11px] text-subtle",children:"https:443 capsule · mcp:7331 mcp · gpu:7840 webgpu · python:8000 python · cloud:8443 sealed-cloud"})
    ]}),
    j.jsx("p",{className:"mt-6 text-[11px] uppercase tracking-[0.16em] text-muted",children:"Project windows"}),
    j.jsx("div",{className:"mt-2 grid gap-3 sm:grid-cols-3",children:[["Code", (repo.files||[]).length+" files"],["Computer","kiln."+repo.owner+"."+repo.name],["Capsule",host],["4D","PXM lattice"],["Actions","settle · deploy"],["Crew","spawn crew"]].map(([t,d])=>j.jsxs("article",{className:"rounded-xl border border-border bg-surface p-4",children:[j.jsx("h3",{className:"font-medium",children:t}), j.jsx("p",{className:"mt-1 font-mono text-[12px] text-muted",children:d})]},t))})
  ]});
}
export{component};
`,
  ),
);

w(
  "memory-DWov_Aom.js",
  repoPage(
    "memory",
    `function component(){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No folder memory."});
  return j.jsxs(Shell,{children:[
    j.jsx("h2",{className:"font-display text-3xl tracking-tight",children:"Folder memory"}),
    j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"File bytes live in repository memory, not a tiny local cache. Drop files onto a repo you own (up to 50 GB / folder, 4 MiB AES-256-GCM leaves). Agents and the CLI see the same tree."}),
    j.jsx("div",{className:"mt-6",children:j.jsx(Tree,{repo})})
  ]});
}
export{component};
`,
  ),
);

w(
  "preview-DwoSE81z.js",
  repoPage(
    "preview",
    `function component(){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No capsule."});
  const html=(repo.files||[]).find(f=>f.path==="index.html")?.content
    || "<!doctype html><title>"+repo.name+"</title><p>"+repo.description+"</p>";
  const src="data:text/html;charset=utf-8,"+encodeURIComponent(html);
  return j.jsxs(Shell,{children:[
    j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Capsule"}),
    j.jsx("iframe",{title:"preview",src,className:"mt-4 min-h-[480px] w-full rounded-xl border border-border bg-white"})
  ]});
}
export{component};
`,
  ),
);

w("CapsuleView-DZvasRQP.js", `export{component}from"./preview-DwoSE81z.js";`);

const listPage = (title, pick) =>
  repoPage(
    title,
    `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"Missing tree."});
  const rows=${pick};
  return j.jsxs(Shell,{children:[
    j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:${JSON.stringify(title)}}),
    j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:(rows||[]).length?rows.map((x,i)=>j.jsxs("li",{className:"px-4 py-3 text-sm",children:[x.title||x.message||x.tag||x.name||x.path||JSON.stringify(x).slice(0,80)]},i)):j.jsx("li",{className:"px-4 py-8 text-sm text-muted",children:"Empty on this tree."})})
  ]});
}
export{component};
`,
  );

w("issues-B3-jCySW.js", listPage("Issues", "(s.issues||s.userIssues||[]).filter(x=>x.repoId===repo.id)"));
w("issues-DP0eRS_W.js", `export{component}from"./issues-B3-jCySW.js";`);
w("pulls-Bd-akZca.js", listPage("Pulls", "(s.pulls||s.userPulls||[]).filter(x=>x.repoId===repo.id)"));
w("commits-BcBsIMIz.js", listPage("Commits", "(s.commits||[]).filter(x=>x.repoId===repo.id)"));
w("actions-C6yYfvUI.js", listPage("Actions", "(s.runs||[]).filter(x=>x.repoId===repo.id)"));
w("workflows-Cqy62ySG.js", `export{component}from"./actions-C6yYfvUI.js";`);
w("releases-BUm6ZKhf.js", listPage("Releases", "(s.releases||s.userReleases||[]).filter(x=>x.repoId===repo.id)"));
w("discussions-DFW1J15v.js", listPage("Discuss", "(s.discussions||[]).filter(x=>x.repoId===repo.id)"));
w("wiki-DyORFZFm.js", listPage("Wiki", "(repo.files||[]).filter(f=>/md$/i.test(f.path))"));
w("packages-CXc1_BwV.js", listPage("Packages", "s.packages||[]"));
w("packages-BoFx1Umh.js", `export{component}from"./packages-CXc1_BwV.js";`);
w("insights-Df_7BJp8.js", listPage("Insights", "Object.entries(repo.languages||{}).map(([k,v])=>({title:k+' '+v+'%'}))"));
w("security-tOee1VJ1.js", listPage("Security", "[{title:'AES-256-GCM · key commitment on-chain'}]"));
w(
  "settings-COVC9ISI.js",
  repoPage(
    "settings",
    `function component(){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"Missing tree."});
  return j.jsxs(Shell,{children:[
    j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Settings"}),
    j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Default branch "+(repo.defaultBranch||"main")+" · cipher "+(repo.encrypted?"AES-256-GCM":"none")+" · 50 GB folder cap."})
  ]});
}
export{component};`,
  ),
);

w("blob._-BGW_7nqh.js", listPage("File", "repo.files||[]"));
w("edit._-DRN7p31O.js", `export{component}from"./blob._-BGW_7nqh.js";`);
w("_repo-BcnIeLcW.js", `export{component}from"./_repo-DtOO023L.js";`);
w("_id-GWr0XW_4.js", `export{component}from"./_repo-DtOO023L.js";`);
w("_slug-BL9CzFUP.js", `export{component}from"./_repo-DtOO023L.js";`);
w("_code-VxsMPUaN.js", `export{component}from"./_repo-DtOO023L.js";`);
w("_n-wtlSJnoh.js", `export{component}from"./_repo-DtOO023L.js";`);
w("new-qDTlb39S.js", `export{component}from"./new-DrGYWjdX.js";`);
w("gists-helYFVPX.js", `export{component}from"./explore-rtlBhl3C.js";`);
w("invite-B3-jCySW.js", `export{component}from"./invite-B5bqB7yU.js";`);
w("invite-ilio3JyC.js", `export{component}from"./invite-B5bqB7yU.js";`);
w("mcp-BY2MaNdQ.js", `export{component}from"./cli-BdprgVmj.js";`);
w("members-DToRO4go.js", `export{component}from"./orgs-BXGx-klH.js";`);
w("notifications-uzXj96uh.js", `export{component}from"./account-49nJUaQm.js";`);
w("paper-DZK2VAq_.js", `export{component}from"./papers-DXk6hJLc.js";`);
w("search-Og-pe9Fe.js", `export{component}from"./explore-rtlBhl3C.js";`);

console.log("missing chunks written");
