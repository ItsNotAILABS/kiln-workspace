import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
