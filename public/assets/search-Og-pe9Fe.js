import { rr, j, Link, useKiln, allRepos } from "./_repo-kit.js";
function component(){
  const s=useKiln();
  const q=typeof location<"u"?new URLSearchParams(location.search).get("q")||"":"";
  const [v,setV]=rr.useState(q);
  const list=(allRepos(s)||[]).filter(r=>{
    const n=v.trim().toLowerCase();
    if(!n) return true;
    return (r.id+" "+r.description+" "+(r.language||"")).toLowerCase().includes(n);
  });
  return j.jsxs("div",{className:"mx-auto max-w-4xl py-8",children:[
    j.jsx("h1",{className:"font-display text-3xl tracking-tight",children:"Search"}),
    j.jsx("input",{className:"input mt-4",value:v,onChange:e=>setV(e.target.value),placeholder:"Search repositories, code, issues…"}),
    j.jsx("ul",{className:"mt-4 divide-y divide-border rounded-xl border border-border",children:list.slice(0,40).map(r=>j.jsxs("li",{className:"px-4 py-3",children:[
      j.jsx(Link,{to:"/$owner/$repo",params:{owner:r.owner,repo:r.name},className:"font-medium text-seal hover:underline",children:r.id}),
      j.jsx("p",{className:"mt-1 text-sm text-muted",children:r.description})
    ]},r.id))})
  ]});
}
export { component };
