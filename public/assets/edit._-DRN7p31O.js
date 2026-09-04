import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
  const {repo,p,s}=useRepo();
  const splat=p.splat||p._splat||(typeof location<"u"?location.pathname.split("/edit/")[1]:"")||"untitled.md";
  const file=(repo?.files||[]).find(f=>f.path===splat);
  const [text,setText]=rr.useState(file?.content||"");
  rr.useEffect(()=>setText(file?.content||""),[file?.path, repo?.id]);
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5",children:[
      j.jsxs("div",{className:"flex items-center justify-between gap-3",children:[
        j.jsx("h2",{className:"font-mono text-sm",children:splat}),
        j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>{
          if(typeof s.uploadFiles==="function"){
            s.uploadFiles(repo.id,[{path:splat, blob:new Blob([text],{type:"text/plain"}), binary:false}]);
          } else {
            import("./store-sx46DNi5.js").then(m=>{
              const st=m.b.getState();
              const repos=(st.userRepos||[]).map(r=>r.id===repo.id?{...r,files:(r.files||[]).map(f=>f.path===splat?{...f,content:text,size:text.length}:f)}:r);
              m.b.setState({userRepos:repos});
            });
          }
        },children:"Commit changes"})
      ]}),
      j.jsx("textarea",{className:"input mt-4 min-h-[480px] font-mono text-[12px]",value:text,onChange:e=>setText(e.target.value)})
    ]})
  ]});
}

export { component };
