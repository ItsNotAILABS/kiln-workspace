import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
