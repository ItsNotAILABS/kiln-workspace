import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
