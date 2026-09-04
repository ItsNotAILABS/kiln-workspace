import{t as e}from"./jsx-runtime-0vZSBttN.js";var n=e();
export function t({source:s=""}){
  const parts=String(s).split(/\n/);
  return n.jsx("div",{className:"prose prose-invert max-w-none text-sm leading-relaxed",children:parts.map((l,i)=>{
    if(l.startsWith("# ")) return n.jsx("h1",{className:"font-display text-3xl tracking-tight",children:l.slice(2)},i);
    if(l.startsWith("## ")) return n.jsx("h2",{className:"mt-4 font-display text-xl",children:l.slice(3)},i);
    if(l.startsWith("### ")) return n.jsx("h3",{className:"mt-3 font-medium",children:l.slice(4)},i);
    if(l.startsWith("    ")||l.startsWith("\t")) return n.jsx("pre",{className:"overflow-x-auto font-mono text-[12px]",children:l.replace(/^    /,"")},i);
    if(l.startsWith("|")) return n.jsx("p",{className:"font-mono text-[12px]",children:l},i);
    if(!l.trim()) return n.jsx("div",{className:"h-2"},i);
    return n.jsx("p",{className:"mt-2 text-muted",children:l},i);
  })});
}
