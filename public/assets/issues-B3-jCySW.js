import { rr, j, Link, Chrome, Tree, About, Readme, Markdown, useRepo, Shell, Empty } from "./_repo-kit.js";
function component(){
  const {repo,s}=useRepo();
  const [tab,setTab]=rr.useState("open");
  const [title,setTitle]=rr.useState("");
  const [body,setBody]=rr.useState("");
  const [open,setOpen]=rr.useState(false);
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const rows=(s.userIssues||s.issues||[]).filter(x=>x.repoId===repo.id);
  const shown=rows.filter(x=>(x.state||"open")===tab);
  function create(){
    if(!title.trim()) return;
    const item={id:repo.id+"#"+(rows.length+1), number:rows.length+1, repoId:repo.id, title:title.trim(), body, state:"open", author:s.wallet?.handle||"guest", createdAt:new Date().toISOString(), comments:[]};
    if(typeof s.setState==="function"){}
    const st=s;
    const next=[item,...rows];
    try{ (st.userIssues?null:null); }catch{}
    try{
      const store=s;
      if(store && typeof store==="object"){
        const root=Object.getPrototypeOf?null:null;
      }
    }catch{}
    try{
      import("./store-sx46DNi5.js").then(m=>{
        const st=m.b?.getState?.()||s;
        const cur=st.userIssues||st.issues||[];
        m.b.setState({userIssues:[item,...cur]});
      });
    }catch{}
    setTitle(""); setBody(""); setOpen(false);
  }
  return j.jsxs(Shell,{children:[
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[
        j.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[
          j.jsx("h2",{className:"font-display text-2xl tracking-tight",children:"Issues"}),
          j.jsx("button",{type:"button",className:"btn-primary btn h-8 px-3",onClick:()=>setOpen(v=>!v),children:"New issue"})
        ]}),
        open?j.jsxs("form",{className:"mt-4 space-y-2 rounded-xl border border-border bg-surface p-4",onSubmit:e=>{e.preventDefault();create();},children:[
          j.jsx("input",{className:"input",placeholder:"Title",value:title,onChange:e=>setTitle(e.target.value)}),
          j.jsx("textarea",{className:"input min-h-24",placeholder:"Leave a comment",value:body,onChange:e=>setBody(e.target.value)}),
          j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4",children:"Submit new issue"})
        ]}):null,
        j.jsxs("div",{className:"mt-4 flex gap-2 text-sm",children:["open","closed"].map(t=>j.jsx("button",{type:"button",className:"btn h-8 px-3"+(tab===t?" bg-surface":""),onClick:()=>setTab(t),children:t+" · "+rows.filter(x=>(x.state||"open")===t).length},t))}),
        shown.length?j.jsx("ul",{className:"mt-3 divide-y divide-border rounded-xl border border-border",children:shown.map(x=>j.jsxs("li",{className:"px-4 py-3",children:[
          j.jsxs("p",{className:"font-medium",children:[j.span?null:null, x.title, j.jsx("span",{className:"ml-2 font-mono text-xs text-muted",children:"#"+x.number})]}),
          j.jsxs("p",{className:"mt-1 text-xs text-muted",children:[(x.state||"open")+" · "+(x.author||"")+" · "+(x.createdAt||"").slice(0,10)]})
        ]},x.id))}):j.jsx(Empty,{title:tab==="open"?"No open issues":"No closed issues",hint:"Issues track bugs, tasks, and the work a crew still owes this tree."})
      ]}),
      j.jsx(About,{repo})
    ]})
  ]});
}

export { component };
