import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
  const {repo,p}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const splat=p.splat||p._splat||(typeof location<"u"?location.pathname.split("/blob/")[1]:"")||"";
  const file=(repo.files||[]).find(f=>f.path===splat)||(repo.files||[]).find(f=>splat.endsWith(f.path));
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex items-center justify-between",children:[
          j.jsx("h2",{className:"font-mono text-sm",children:file?.path||splat||"file"}),
          j.jsx(Link,{to:"/$owner/$repo/edit/$",params:{owner:repo.owner,repo:repo.name,_splat:file?.path||"untitled.md"},className:"btn h-8 px-3",children:"Edit"})
        ]}),
        file? ( /\.md$/i.test(file.path)? j.jsx("div",{className:"mt-4",children:j.jsx(Markdown,{source:file.content||""})}) : j.jsx("pre",{className:"mt-4 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-[12px] leading-5",children:file.content||""}))
          : j.jsx(Empty,{title:"File not in this tree.",hint:"The working tree is the source of truth."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}

export { component };
