import { rr, j, Link } from "./_repo-kit.js";
const GIST_KEY = "kiln.gists.v1";
function loadGists(){ try{ const v = JSON.parse(localStorage.getItem(GIST_KEY) || "[]"); return Array.isArray(v) ? v.filter(x=>x && typeof x.name==="string" && typeof x.body==="string") : []; }catch{ return []; } }
function saveGists(rows){ try{ localStorage.setItem(GIST_KEY, JSON.stringify(rows.slice(0,100))); }catch{} }
function component(){
  const [body,setBody]=rr.useState("");
  const [name,setName]=rr.useState("note.md");
  const [rows,setRows]=rr.useState(loadGists);
  const add=e=>{ e.preventDefault(); if(!body.trim()) return; const next=[{name:name.trim()||"note.md",body,at:new Date().toISOString()},...rows]; setRows(next); saveGists(next); setBody(""); };
  const remove=i=>{ const next=rows.filter((_,k)=>k!==i); setRows(next); saveGists(next); };
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Gists"}),
    j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Quick snippets, saved on this device. A gist here lives in this browser only — it is not sealed, synced, or published to the forge. For permanent, shareable code, put it in a repository."}),
    j.jsxs("form",{className:"mt-4 space-y-2",onSubmit:add,children:[
      j.jsx("input",{className:"input",value:name,onChange:e=>setName(e.target.value)}),
      j.jsx("textarea",{className:"input h-40 py-2 font-mono text-[12px]",placeholder:"Write a gist…",value:body,onChange:e=>setBody(e.target.value)}),
      j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4",children:"Create gist"})
    ]}),
    rows.length===0
      ? j.jsx("p",{className:"mt-6 rounded-xl border border-border px-4 py-8 text-center text-sm text-muted",children:"No gists on this device yet. Write one above — it will still be here when you come back."})
      : j.jsx("ul",{className:"mt-6 divide-y divide-border rounded-xl border border-border",children:rows.map((x,i)=>j.jsxs("li",{className:"px-4 py-3",children:[
          j.jsxs("div",{className:"flex items-center justify-between gap-3",children:[
            j.jsx("p",{className:"font-mono text-sm",children:x.name}),
            j.jsx("button",{type:"button",className:"btn h-8 px-2 text-xs",onClick:()=>remove(i),children:"Delete"})
          ]}),
          j.jsx("pre",{className:"mt-2 overflow-auto text-[12px] text-muted",children:x.body.slice(0,400)})
        ]},i))}),
    j.jsxs("p",{className:"mt-6 text-sm text-muted",children:["Need it shared or versioned? ",j.jsx(Link,{to:"/new",className:"text-seal hover:underline",children:"Create a repository"})," — repos are the forge's real, sealed home for code."]})
  ]});
}
export { component };
