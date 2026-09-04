import { rr, j } from "./_repo-kit.js";
function component(){
  const [out,setOut]=rr.useState("");
  async function ping(){
    const r=await fetch("/mcp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})});
    setOut(JSON.stringify(await r.json(),null,2));
  }
  rr.useEffect(()=>{ ping(); },[]);
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("p",{className:"text-[11px] uppercase tracking-[0.16em] text-muted",children:"Internal MCP"}),
    j.jsx("h1",{className:"mt-1 font-display text-3xl tracking-tight",children:"Model Context Protocol"}),
    j.jsx("p",{className:"mt-2 max-w-xl text-sm text-muted",children:"Kiln runs an MCP server on this origin. Assistants list tools, look up GitHub, and import trees without leaving the product."}),
    j.jsx("pre",{className:"mt-4 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-[12px]",children:"npx -y mcp-remote "+(typeof location<"u"?location.origin:"")+"/mcp"}),
    j.jsx("button",{type:"button",className:"btn mt-3 h-8",onClick:ping,children:"List tools"}),
    j.jsx("pre",{className:"mt-3 overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-[12px]",children:out||"…"})
  ]});
}
export { component };
