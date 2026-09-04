import { rr, j, Link, useKiln } from "./_repo-kit.js";
function component(){
  const s=useKiln();
  const rows=s.notices||[];
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Inbox"}),
    j.jsx("p",{className:"mt-2 text-sm text-muted",children:"Stars, watches, bounty claims, and crew handoffs land here."}),
    rows.length?j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:rows.map((x,i)=>j.jsx("li",{className:"px-4 py-3 text-sm",children:x.title||x.message||JSON.stringify(x).slice(0,120)},i))})
      :j.jsx("p",{className:"mt-8 text-sm text-muted",children:"You’re all caught up."})
  ]});
}
export { component };
