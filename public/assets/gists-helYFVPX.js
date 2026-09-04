import { rr, j, Link } from "./_repo-kit.js";
function component(){
  const [body,setBody]=rr.useState("");
  const [name,setName]=rr.useState("note.md");
  const [rows,setRows]=rr.useState([]);
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Gists"}),
    j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Instant sealed snippets. Same cipher as a repository, without the computer."}),
    j.jsxs("form",{className:"mt-4 space-y-2",onSubmit:e=>{e.preventDefault(); setRows(r=>[{name,body,at:new Date().toISOString()},...r]); setBody("");},children:[
      j.jsx("input",{className:"input",value:name,onChange:e=>setName(e.target.value)}),
      j.jsx("textarea",{className:"input min-h-40 font-mono text-[12px]",placeholder:"Write a gist…",value:body,onChange:e=>setBody(e.target.value)}),
      j.jsx("button",{type:"submit",className:"btn-primary btn h-9 px-4",children:"Create gist"})
    ]}),
    j.jsx("ul",{className:"mt-6 divide-y divide-border rounded-xl border border-border",children:rows.map((x,i)=>j.jsxs("li",{className:"px-4 py-3",children:[
      j.jsx("p",{className:"font-mono text-sm",children:x.name}),
      j.jsx("pre",{className:"mt-2 overflow-auto text-[12px] text-muted",children:x.body.slice(0,400)})
    ]},i))})
  ]});
}
export { component };
