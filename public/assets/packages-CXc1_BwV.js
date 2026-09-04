import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
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

export { component };
