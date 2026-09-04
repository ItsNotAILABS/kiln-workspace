import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
  const {repo}=useRepo();
  const [sel,setSel]=rr.useState("Home");
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const pages=(repo.files||[]).filter(f=>/\.(md|txt)$/i.test(f.path));
  const home=pages.find(f=>/^readme(\.md)?$/i.test(f.path.split("/").pop()||""))||pages[0];
  const current=pages.find(f=>f.path===sel)||home;
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[14rem_1fr_16rem]",children:[
      j.jsxs("aside",{className:"rounded-xl border border-border bg-surface p-3",children:[
        j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Pages"}),
        j.jsx("ul",{className:"mt-2 space-y-1 text-sm",children:[
          j.jsx("li",{children:j.jsx("button",{type:"button",className:"text-seal hover:underline",onClick:()=>setSel(home?.path||"Home"),children:"Home"})}),
          ...pages.map(f=>j.jsx("li",{children:j.jsx("button",{type:"button",className:"text-left text-muted hover:text-fg",onClick:()=>setSel(f.path),children:f.path.replace(/\.md$/i,"")})},f.path))
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

export { component };
