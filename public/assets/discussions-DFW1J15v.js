import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
