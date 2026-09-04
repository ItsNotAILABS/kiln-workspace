import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
