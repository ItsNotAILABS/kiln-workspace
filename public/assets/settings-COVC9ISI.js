import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
