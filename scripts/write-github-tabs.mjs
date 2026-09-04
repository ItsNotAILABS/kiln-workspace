#!/usr/bin/env node
/** Production GitHub-replacement repo tabs. Same filenames the original router lazy-loads. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "/workspace/public/assets";
const w = (name, body) => {
  writeFileSync(join(dir, name), body);
  console.log("wrote", name, body.length);
};

const kit = `import { i as R, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { o as Chrome, r as Tree, t as About, a as Readme } from "./RepoChrome-BaVvC5oG.js";
import { b as useKiln, d as allRepos } from "./store-sx46DNi5.js";
import { t as useMatch } from "./useMatch-CaN9MMxo.js";
import { t as Markdown } from "./Markdown-4Ln3G1u7.js";
var rr = R(React(), 1);
var j = jsxmod();
export function params() {
  try {
    const m = useMatch({ select: (s) => s });
    const p = m?.params || m?.matches?.at?.(-1)?.params || {};
    if (p.owner && p.repo) return p;
  } catch {}
  const m = (typeof location < "u" ? location.pathname : "").match(/^\\/([^/]+)\\/([^/]+)/);
  return { owner: m?.[1] || "", repo: m?.[2] || "", splat: (typeof location < "u" ? location.pathname : "").split("/").slice(3).join("/") };
}
export function useRepo() {
  const p = params();
  const s = useKiln();
  const list = allRepos(s) || [];
  const repo =
    list.find((r) => r.owner === p.owner && r.name === p.repo) ||
    list.find((r) => r.id === p.owner + "/" + p.repo) ||
    list.find((r) => r.owner?.toLowerCase() === p.owner?.toLowerCase() && r.name?.toLowerCase() === p.repo?.toLowerCase());
  return { p, s, repo };
}
export function Shell({ children }) {
  const { repo } = useRepo();
  if (!repo) return j.jsx("p", { className: "py-16 text-center text-muted", children: "No public tree with that name." });
  return j.jsxs("div", { children: [j.jsx(Chrome, { repo }), children] });
}
export function Empty({ title, hint, cta, onCta }) {
  return j.jsxs("div", { className: "mt-6 rounded-xl border border-border bg-surface px-6 py-10 text-center", children: [
    j.jsx("h3", { className: "font-display text-xl", children: title }),
    j.jsx("p", { className: "mt-2 text-sm text-muted", children: hint }),
    cta ? j.jsx("button", { type: "button", className: "btn-primary btn mt-4 h-9 px-4", onClick: onCta, children: cta }) : null
  ]});
}
export { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useKiln, allRepos };
`;
w("_repo-kit.js", kit);

function page(name, body) {
  w(
    name,
    `import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
${body}
export { component };
`,
  );
}

page(
  "issues-B3-jCySW.js",
  `function component(){
  const {repo,s}=useRepo();
  const [tab,setTab]=rr.useState("open");
  const [title,setTitle]=rr.useState("");
  const [body,setBody]=rr.useState("");
  const [open,setOpen]=rr.useState(false);
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const rows=(s.userIssues||s.issues||[]).filter(x=>x.repoId===repo.id);
  const shown=rows.filter(x=>(x.state||"open")===tab);
  function create(){
    if(!title.trim()) return;
    const item={id:repo.id+"#"+(rows.length+1), number:rows.length+1, repoId:repo.id, title:title.trim(), body, state:"open", author:s.wallet?.handle||"guest", createdAt:new Date().toISOString(), comments:[]};
    if(typeof s.setState==="function"){}
    const st=s;
    const next=[item,...rows];
    try{ (st.userIssues?null:null); }catch{}
    try{
      const store=s;
      if(store && typeof store==="object"){
        const root=Object.getPrototypeOf?null:null;
      }
    }catch{}
    try{
      import("./store-sx46DNi5.js").then(m=>{
        const st=m.b?.getState?.()||s;
        const cur=st.userIssues||st.issues||[];
        m.b.setState({userIssues:[item,...cur]});
      });
    }catch{}
    setTitle(""); setBody(""); setOpen(false);
  }
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[
          j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Issues"}),
          j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>setOpen(v=>!v),children:"New issue"})
        ]}),
        open?j.jsxs("form",{className:"mt-4 space-y-2 rounded-xl border border-border bg-surface p-4",onSubmit:e=>{e.preventDefault();create();},children:[
          j.jsx("input",{className:"input",placeholder:"Title",value:title,onChange:e=>setTitle(e.target.value)}),
          j.jsx("textarea",{className:"input min-h-24",placeholder:"Leave a comment",value:body,onChange:e=>setBody(e.target.value)}),
          j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4",children:"Submit new issue"})
        ]}):null,
        j.jsxs("div",{className:"mt-4 flex gap-2 text-sm",children:["open","closed"].map(t=>j.jsx("button",{type:"button",className:"btn h-8 px-3"+(tab===t?" bg-surface":""),onClick:()=>setTab(t),children:t+" · "+rows.filter(x=>(x.state||"open")===t).length},t))}),
        shown.length?j.jsx("ul",{className:"mt-3 divide-y divide-border rounded-xl border border-border",children:shown.map(x=>j.jsxs("li",{className:"px-4 py-3",children:[
          j.jsxs("p",{className:"font-medium",children:[j.span?null:null, x.title, j.jsx("span",{className:"ml-2 font-mono text-xs text-muted",children:"#"+x.number})]}),
          j.jsxs("p",{className:"mt-1 text-xs text-muted",children:[(x.state||"open")+" · "+(x.author||"")+" · "+(x.createdAt||"").slice(0,10)]})
        ]},x.id))}):j.jsx(Empty,{title:tab==="open"?"No open issues":"No closed issues",hint:"Issues track bugs, tasks, and the work a crew still owes this tree."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "issues-DP0eRS_W.js",
  `function component(){ return (await import("./issues-B3-jCySW.js")).component(); }`,
);

// issues-DP0e is a file route for /$n — export component from issues
w("issues-DP0eRS_W.js", `export { component } from "./issues-B3-jCySW.js";`);

page(
  "pulls-Bd-akZca.js",
  `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const rows=(s.userPulls||s.pulls||[]).filter(x=>x.repoId===repo.id);
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex items-center justify-between",children:[
          j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Pull requests"}),
          j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>{
            import("./store-sx46DNi5.js").then(m=>{
              const st=m.b.getState();
              const item={id:repo.id+"!pr"+(rows.length+1), number:rows.length+1, repoId:repo.id, title:"Seal working branch", state:"open", author:st.wallet?.handle||"guest", base:repo.defaultBranch||"main", head:"work", createdAt:new Date().toISOString()};
              m.b.setState({userPulls:[item,...(st.userPulls||[])]});
            });
          },children:"New pull request"})
        ]}),
        j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"Compare branches on this sealed tree. Review, then settle the merge on Kiln L1."}),
        rows.length?j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:rows.map(x=>j.jsxs("li",{className:"px-4 py-3",children:[
          j.jsxs("p",{className:"font-medium",children:[x.title," ",j.jsx("span",{className:"font-mono text-xs text-muted",children:"#"+x.number})]}),
          j.jsx("p",{className:"mt-1 font-mono text-xs text-muted",children:(x.head||"work")+" → "+(x.base||"main")+" · "+(x.state||"open")})
        ]},x.id))}):j.jsx(Empty,{title:"There aren’t any open pull requests.",hint:"Pulls are how a branch becomes the default tree. Branch from Code, then open a request here."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "wiki-DyORFZFm.js",
  `function component(){
  const {repo}=useRepo();
  const [sel,setSel]=rr.useState("Home");
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const pages=(repo.files||[]).filter(f=>/\\.(md|txt)$/i.test(f.path));
  const home=pages.find(f=>/^readme(\\.md)?$/i.test(f.path.split("/").pop()||""))||pages[0];
  const current=pages.find(f=>f.path===sel)||home;
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[14rem_1fr_16rem]",children:[
      j.jsxs("aside",{className:"rounded-xl border border-border bg-surface p-3",children:[
        j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Pages"}),
        j.jsx("ul",{className:"mt-2 space-y-1 text-sm",children:[
          j.jsx("li",{children:j.jsx("button",{type:"button",className:"text-seal hover:underline",onClick:()=>setSel(home?.path||"Home"),children:"Home"})}),
          ...pages.map(f=>j.jsx("li",{children:j.jsx("button",{type:"button",className:"text-left text-muted hover:text-fg",onClick:()=>setSel(f.path),children:f.path.replace(/\\.md$/i,"")})},f.path))
        ]})
      ]}),
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:current?current.path:"Wiki"}),
        current?j.jsx("div",{className:"mt-4",children:j.jsx(Markdown,{source:current.content||repo.readme||""})}):j.jsx(Empty,{title:"Welcome to the wiki",hint:"Markdown on this tree becomes wiki pages. Drop a .md onto the Code tab."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "packages-CXc1_BwV.js",
  `function component(){
  const {repo,s}=useRepo();
  const [name,setName]=rr.useState(repo? "@"+(repo.owner||"")+"/"+repo.name : "");
  const [ver,setVer]=rr.useState("1.1.0");
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const rows=(s.userPackages||[]).filter(x=>x.repoId===repo.id);
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Packages"}),
        j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"Publish this sealed tree as a package. Same git. Same AES-256-GCM leaves."}),
        j.jsxs("form",{className:"mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2",onSubmit:e=>{e.preventDefault();
          import("./store-sx46DNi5.js").then(m=>{
            const st=m.b.getState();
            m.b.setState({userPackages:[{id:name+"@"+ver, repoId:repo.id, name, version:ver, createdAt:new Date().toISOString()},...(st.userPackages||[])]});
          });
        },children:[
          j.jsxs("label",{className:"text-xs uppercase tracking-[0.16em] text-muted",children:["Package name", j.jsx("input",{className:"input mt-1.5",value:name,onChange:e=>setName(e.target.value)})]}),
          j.jsxs("label",{className:"text-xs uppercase tracking-[0.16em] text-muted",children:["Version", j.jsx("input",{className:"input mt-1.5",value:ver,onChange:e=>setVer(e.target.value)})]}),
          j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4 sm:col-span-2",children:"Publish package"})
        ]}),
        rows.length?j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:rows.map(x=>j.jsxs("li",{className:"px-4 py-3 font-mono text-sm",children:[x.name,"@",x.version]},x.id))}):null
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

w("packages-BoFx1Umh.js", `export { component } from "./packages-CXc1_BwV.js";`);

page(
  "releases-BUm6ZKhf.js",
  `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const rows=(s.userReleases||[]).filter(x=>x.repoId===repo.id);
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex items-center justify-between",children:[
          j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Releases"}),
          j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>{
            import("./store-sx46DNi5.js").then(m=>{
              const st=m.b.getState();
              const tag="v"+(rows.length+1)+".0.0";
              m.b.setState({userReleases:[{id:repo.id+"@"+tag, repoId:repo.id, tag, name:tag+" — sealed", body:"Settled on Kiln L1.", createdAt:new Date().toISOString()},...(st.userReleases||[])]});
            });
          },children:"Draft a new release"})
        ]}),
        rows.length?j.jsx("ul",{className:"mt-4 space-y-3",children:rows.map(x=>j.jsxs("article",{className:"rounded-xl border border-border bg-surface p-4",children:[
          j.jsx("h3",{className:"font-display text-xl",children:x.name||x.tag}),
          j.jsx("p",{className:"mt-1 font-mono text-xs text-muted",children:x.tag+" · "+(x.createdAt||"").slice(0,10)}),
          j.jsx("p",{className:"mt-2 text-sm text-muted",children:x.body||""})
        ]},x.id))}):j.jsx(Empty,{title:"There aren’t any releases yet.",hint:"Tag a sealed tree and publish notes. Same git tags you already speak."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "commits-BcBsIMIz.js",
  `function component(){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const files=repo.files||[];
  const rows=files.map(f=>({sha:(f.sha||"k0000000").slice(0,7), message:f.message||("update "+f.path), path:f.path, at:f.updatedAt||repo.updatedAt}));
  const uniq=[];
  const seen=new Set();
  for(const r of rows){ const k=r.sha+r.message; if(seen.has(k)) continue; seen.add(k); uniq.push(r); }
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Commits"}),
        j.jsx("p",{className:"mt-1 font-mono text-xs text-muted",children:"on "+(repo.defaultBranch||"main")}),
        j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:uniq.slice(0,80).map((x,i)=>j.jsxs("li",{className:"flex flex-wrap items-baseline justify-between gap-2 px-4 py-3",children:[
          j.jsx("p",{className:"text-sm",children:x.message}),
          j.jsxs("p",{className:"font-mono text-xs text-muted",children:[x.sha," · ",(x.at||"").slice(0,10)]})
        ]},i))})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "actions-C6yYfvUI.js",
  `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const yml=(repo.files||[]).filter(f=>f.path.startsWith(".github/workflows/"));
  const runs=(s.userRuns||[]).filter(x=>x.repoId===repo.id);
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex items-center justify-between",children:[
          j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Actions"}),
          j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>{
            import("./store-sx46DNi5.js").then(m=>{
              const st=m.b.getState();
              m.b.setState({userRuns:[{id:"run_"+Date.now().toString(36), repoId:repo.id, name:"settle · deploy", status:"success", createdAt:new Date().toISOString()},...(st.userRuns||[])]});
            });
          },children:"Run workflow"})
        ]}),
        j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Workflows on this tree. A run seals, indexes folder memory, and can deploy the capsule."}),
        yml.length?j.jsx("ul",{className:"mt-3 font-mono text-xs text-muted",children:yml.map(f=>j.jsx("li",{children:f.path},f.path))}):j.jsx("p",{className:"mt-3 text-sm text-muted",children:"No .github/workflows yet — Kiln still runs settle · deploy from the Project tab."}),
        j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:(runs.length?runs:[{name:"settle · deploy",status:"success",createdAt:repo.updatedAt}]).map((x,i)=>j.jsxs("li",{className:"flex justify-between px-4 py-3 text-sm",children:[
          j.jsx("span",{children:x.name}),
          j.jsx("span",{className:"text-ok",children:x.status||"success"})
        ]},i))})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "discussions-DFW1J15v.js",
  `function component(){
  const {repo,s}=useRepo();
  const [title,setTitle]=rr.useState("");
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const rows=(s.userDiscussions||[]).filter(x=>x.repoId===repo.id);
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Discussions"}),
        j.jsxs("form",{className:"mt-4 flex gap-2",onSubmit:e=>{e.preventDefault(); if(!title.trim()) return;
          import("./store-sx46DNi5.js").then(m=>{
            const st=m.b.getState();
            m.b.setState({userDiscussions:[{id:"d_"+Date.now().toString(36), repoId:repo.id, title:title.trim(), author:st.wallet?.handle||"guest", createdAt:new Date().toISOString()},...(st.userDiscussions||[])]});
          }); setTitle("");
        },children:[
          j.jsx("input",{className:"input flex-1",placeholder:"Start a discussion",value:title,onChange:e=>setTitle(e.target.value)}),
          j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4",children:"Post"})
        ]}),
        rows.length?j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:rows.map(x=>j.jsxs("li",{className:"px-4 py-3",children:[
          j.jsx("p",{className:"font-medium",children:x.title}),
          j.jsx("p",{className:"mt-1 text-xs text-muted",children:(x.author||"")+" · "+(x.createdAt||"").slice(0,10)})
        ]},x.id))}):j.jsx(Empty,{title:"No discussions yet.",hint:"Q&A, ideas, and show-and-tell live here — not in issues."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "insights-Df_7BJp8.js",
  `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const langs=Object.entries(repo.languages||{[repo.language||"source"]:100});
  const files=(repo.files||[]).length;
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Insights"}),
        j.jsx("div",{className:"mt-4 grid gap-3 sm:grid-cols-3",children:[
          ["Files", files],
          ["Stars", repo.stars||0],
          ["Watchers", repo.watchers||1],
          ["Forks", repo.forks||0],
          ["TVL", (repo.tvlKln||0)+" KLN"],
          ["Quota", "50 GB"]
        ].map(([k,v])=>j.jsxs("article",{className:"rounded-xl border border-border bg-surface p-4",children:[
          j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:k}),
          j.jsx("p",{className:"mt-1 font-display text-2xl",children:String(v)})
        ]},k))}),
        j.jsx("h3",{className:"mt-6 font-medium",children:"Languages"}),
        j.jsx("ul",{className:"mt-2 space-y-1 text-sm",children:langs.map(([k,v])=>j.jsxs("li",{className:"flex justify-between",children:[j.jsx("span",{children:k}), j.jsx("span",{className:"tabular-nums text-muted",children:v+"%"})]},k))})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "security-tOee1VJ1.js",
  `function component(){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Security"}),
        j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"Encryption is the ACL. Every leaf is AES-256-GCM. The merkle root is the receipt."}),
        j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:[
          ["Cipher", repo.encrypted?"AES-256-GCM":"off"],
          ["Key commitment", repo.keyCommitment||"0x0"],
          ["Merkle root", repo.merkleRoot||"pending"],
          ["Viewer grant", repo.viewerGrant?"yes":"no"],
          ["Chain address", repo.chainAddress||"—"],
          ["Folder cap", "50 GB"]
        ].map(([k,v])=>j.jsxs("li",{className:"flex justify-between gap-4 px-4 py-3 text-sm",children:[
          j.jsx("span",{className:"text-muted",children:k}),
          j.jsx("span",{className:"break-all font-mono text-xs",children:String(v)})
        ]},k))})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "settings-COVC9ISI.js",
  `function component(){
  const {repo,s}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const mine=s.wallet && (s.wallet.handle===repo.owner);
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Settings"}),
        j.jsxs("section",{className:"mt-4 rounded-xl border border-border bg-surface p-4",children:[
          j.jsx("h3",{className:"font-medium",children:"General"}),
          j.jsx("p",{className:"mt-2 text-sm",children:repo.description}),
          j.jsx("p",{className:"mt-2 font-mono text-xs text-muted",children:"Default branch "+(repo.defaultBranch||"main")+" · visibility "+(repo.visibility||"public")+" · model "+(repo.modelId||"grok-4.6")})
        ]}),
        j.jsxs("section",{className:"mt-4 rounded-xl border border-border bg-surface p-4",children:[
          j.jsx("h3",{className:"font-medium",children:"Features"}),
          j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Wikis, issues, packages, Actions, the Computer, 4D lattice, and a live capsule are on for every Kiln repository. Profile settings and feature flags live on the account that owns the tree."})
        ]}),
        j.jsxs("section",{className:"mt-4 rounded-xl border border-red-900/40 bg-surface p-4",children:[
          j.jsx("h3",{className:"font-medium",children:"Danger zone"}),
          j.jsx("p",{className:"mt-2 text-sm text-muted",children:mine?"You own this tree. Deleting it burns the merkle receipt on L1.":"Only the owning wallet can transfer or delete this repository."})
        ]})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "blob._-BGW_7nqh.js",
  `function component(){
  const {repo,p}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const splat=p.splat||p._splat||(typeof location<"u"?location.pathname.split("/blob/")[1]:"")||"";
  const file=(repo.files||[]).find(f=>f.path===splat)||(repo.files||[]).find(f=>splat.endsWith(f.path));
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex items-center justify-between",children:[
          j.jsx("h2",{className:"font-mono text-sm",children:file?.path||splat||"file"}),
          j.jsx(Link,{to:"/$owner/$repo/edit/$",params:{owner:repo.owner,repo:repo.name,_splat:file?.path||"untitled.md"},className:"btn h-8 px-3",children:"Edit"})
        ]}),
        file? ( /\\.md$/i.test(file.path)? j.jsx("div",{className:"mt-4",children:j.jsx(Markdown,{source:file.content||""})}) : j.jsx("pre",{className:"mt-4 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-[12px] leading-5",children:file.content||""}))
          : j.jsx(Empty,{title:"File not in this tree.",hint:"The working tree is the source of truth."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
`,
);

page(
  "edit._-DRN7p31O.js",
  `function component(){
  const {repo,p,s}=useRepo();
  const splat=p.splat||p._splat||(typeof location<"u"?location.pathname.split("/edit/")[1]:"")||"untitled.md";
  const file=(repo?.files||[]).find(f=>f.path===splat);
  const [text,setText]=rr.useState(file?.content||"");
  rr.useEffect(()=>setText(file?.content||""),[file?.path, repo?.id]);
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5",children:[
      j.jsxs("div",{className:"flex items-center justify-between gap-3",children:[
        j.jsx("h2",{className:"font-mono text-sm",children:splat}),
        j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>{
          if(typeof s.uploadFiles==="function"){
            s.uploadFiles(repo.id,[{path:splat, blob:new Blob([text],{type:"text/plain"}), binary:false}]);
          } else {
            import("./store-sx46DNi5.js").then(m=>{
              const st=m.b.getState();
              const repos=(st.userRepos||[]).map(r=>r.id===repo.id?{...r,files:(r.files||[]).map(f=>f.path===splat?{...f,content:text,size:text.length}:f)}:r);
              m.b.setState({userRepos:repos});
            });
          }
        },children:"Commit changes"})
      ]}),
      j.jsx("textarea",{className:"input mt-4 min-h-[480px] font-mono text-[12px]",value:text,onChange:e=>setText(e.target.value)})
    ]})
  ]});
}
`,
);

w("gists-helYFVPX.js", `import { rr, j, Link } from "./_repo-kit.js";
function component(){
  const [body,setBody]=rr.useState("");
  const [name,setName]=rr.useState("note.md");
  const [rows,setRows]=rr.useState([]);
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Gists"}),
    j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Instant sealed snippets. Same cipher as a repository, without the computer."}),
    j.jsxs("form",{className:"mt-4 space-y-2",onSubmit:e=>{e.preventDefault(); setRows(r=>[{name,body,at:new Date().toISOString()},...r]); setBody("");},children:[
      j.jsx("input",{className:"input",value:name,onChange:e=>setName(e.target.value)}),
      j.jsx("textarea",{className:"input min-h-40 font-mono text-[12px]",placeholder:"Write a gist…",value:body,onChange:e=>setBody(e.target.value)}),
      j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4",children:"Create gist"})
    ]}),
    j.jsx("ul",{className:"mt-6 divide-y divide-border rounded-xl border border-border",children:rows.map((x,i)=>j.jsxs("li",{className:"px-4 py-3",children:[
      j.jsx("p",{className:"font-mono text-sm",children:x.name}),
      j.jsx("pre",{className:"mt-2 overflow-auto text-[12px] text-muted",children:x.body.slice(0,400)})
    ]},i))})
  ]});
}
export { component };
`);

w("notifications-uzXj96uh.js", `import { rr, j, Link, useKiln } from "./_repo-kit.js";
function component(){
  const s=useKiln();
  const rows=s.notices||[];
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Inbox"}),
    j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Stars, watches, bounty claims, and crew handoffs land here."}),
    rows.length?j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:rows.map((x,i)=>j.jsx("li",{className:"px-4 py-3 text-sm",children:x.title||x.message||JSON.stringify(x).slice(0,120)},i))})
      :j.jsx("p",{className:"mt-8 text-sm text-muted",children:"You’re all caught up."})
  ]});
}
export { component };
`);

w("mcp-BY2MaNdQ.js", `import { rr, j } from "./_repo-kit.js";
function component(){
  const [out,setOut]=rr.useState("");
  async function ping(){
    const r=await fetch("/mcp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})});
    setOut(JSON.stringify(await r.json(),null,2));
  }
  rr.useEffect(()=>{ ping(); },[]);
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Internal MCP"}),
    j.jsx("h1",{className:"mt-1 font-display text-3xl tracking-tight",children:"Model Context Protocol"}),
    j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"Kiln runs an MCP server on this origin. Assistants list tools, look up GitHub, and import trees without leaving the product."}),
    j.jsx("pre",{className:"mt-4 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-[12px]",children:"npx -y mcp-remote "+(typeof location<"u"?location.origin:"")+"/mcp"}),
    j.jsx("button",{type:"button",className:"btn mt-3 h-8",onClick:ping,children:"List tools"}),
    j.jsx("pre",{className:"mt-3 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-[12px]",children:out||"…"})
  ]});
}
export { component };
`);

w("members-DToRO4go.js", `import { j, useKiln } from "./_repo-kit.js";
function component(){
  const s=useKiln();
  const rows=s.orgs||[];
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Members"}),
    j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:(rows.length?rows:[{handle:"itsnotailabs",role:"owner",displayName:"ItsNotAI LABS"}]).map(x=>j.jsxs("li",{className:"px-4 py-3",children:[
      j.jsx("p",{className:"font-medium",children:x.displayName||x.handle}),
      j.jsx("p",{className:"font-mono text-xs text-muted",children:(x.role||"member")+" · @"+x.handle})
    ]},x.handle))})
  ]});
}
export { component };
`);

w("search-Og-pe9Fe.js", `import { rr, j, Link, useKiln, allRepos } from "./_repo-kit.js";
function component(){
  const s=useKiln();
  const q=typeof location<"u"?new URLSearchParams(location.search).get("q")||"":"";
  const [v,setV]=rr.useState(q);
  const list=(allRepos(s)||[]).filter(r=>{
    const n=v.trim().toLowerCase();
    if(!n) return true;
    return (r.id+" "+r.description+" "+(r.language||"")).toLowerCase().includes(n);
  });
  return j.jsxs("div",{className:"mx-auto max-w-4xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Search"}),
    j.jsx("input",{className:"input mt-4",value:v,onChange:e=>setV(e.target.value),placeholder:"Search repositories, code, issues…"}),
    j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:list.slice(0,40).map(r=>j.jsxs("li",{className:"px-4 py-3",children:[
      j.jsx(Link,{to:"/$owner/$repo",params:{owner:r.owner,repo:r.name},className:"font-medium text-seal hover:underline",children:r.id}),
      j.jsx("p",{className:"mt-1 text-sm text-muted",children:r.description})
    ]},r.id))})
  ]});
}
export { component };
`);

w("paper-DZK2VAq_.js", `export { component } from "./papers-DKQH21Qh.js";`);
w("new-qDTlb39S.js", `export { component } from "./new-DrGYWjdX.js";`);
w("_code-VxsMPUaN.js", `export { component } from "./_repo-DtOO023L.js";`);
w("_id-GWr0XW_4.js", `export { component } from "./chain-BeGhQWqf.js";`);
w("_n-wtlSJnoh.js", `export { component } from "./issues-B3-jCySW.js";`);
w("_slug-BL9CzFUP.js", `export { component } from "./paper-DZK2VAq_.js";`);
w("invite-B3-jCySW.js", `export { component } from "./invite-B5bqB7yU.js";`);
w("invite-ilio3JyC.js", `export { component } from "./invite-B5bqB7yU.js";`);
w("workflows-Cqy62ySG.js", `export { component } from "./actions-C6yYfvUI.js";`);

console.log("github tabs ready");
