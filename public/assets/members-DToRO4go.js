import { j, useKiln } from "./_repo-kit.js";
function component(){
  const s=useKiln();
  const rows=s.orgs||[];
  return j.jsxs("div",{className:"mx-auto max-w-3xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Members"}),
    j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:(rows.length?rows:[{handle:"itsnotailabs",role:"owner",displayName:"ItsNotAI LABS"}]).map(x=>j.jsxs("li",{className:"px-4 py-3",children:[
      j.jsx("p",{className:"font-medium",children:x.displayName||x.handle}),
      j.jsx("p",{className:"font-mono text-xs text-muted",children:(x.role||"member")+" · @"+x.handle})
    ]},x.handle))})
  ]});
}
export { component };
