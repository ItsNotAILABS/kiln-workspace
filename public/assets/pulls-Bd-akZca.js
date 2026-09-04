import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
