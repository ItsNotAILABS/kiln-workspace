import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
