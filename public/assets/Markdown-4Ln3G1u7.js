import{t as e}from"./jsx-runtime-0vZSBttN.js";var n=e();
const IMG=/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const IMG_LINE=/^(!\[[^\]]*\]\(\s*[^)\s]+(?:\s+["'][^"']*["'])?\s*\)\s*)+$/;
function resolveSrcOf(resolveSrc,src){
  if(/^(https?:)?\/\//i.test(src)||/^(data|blob):/i.test(src)||src.startsWith(`/`))return src;
  return resolveSrc?resolveSrc(src):src;
}
function inlineImages(l,i,resolveSrc){
  const parts=[];let last=0,m,k=0;IMG.lastIndex=0;
  while((m=IMG.exec(l))!==null){
    if(m.index>last)parts.push(l.slice(last,m.index));
    parts.push(n.jsx(`img`,{src:resolveSrcOf(resolveSrc,m[2]),alt:m[1],loading:`lazy`,className:`max-w-full rounded-lg`},`img${i}-${k++}`));
    last=m.index+m[0].length;
  }
  if(!k)return null;
  if(last<l.length)parts.push(l.slice(last));
  return parts;
}
export function t({source:s="",resolveSrc}={}){
  const parts=String(s).split(/\n/);
  return n.jsx("div",{className:"prose prose-invert max-w-none text-sm leading-relaxed",children:parts.map((l,i)=>{
    if(l.startsWith("# ")) return n.jsx("h1",{className:"font-display text-3xl tracking-tight",children:l.slice(2)},i);
    if(l.startsWith("## ")) return n.jsx("h2",{className:"mt-4 font-display text-xl",children:l.slice(3)},i);
    if(l.startsWith("### ")) return n.jsx("h3",{className:"mt-3 font-medium",children:l.slice(4)},i);
    if(l.startsWith("    ")||l.startsWith("\t")) return n.jsx("pre",{className:"overflow-x-auto font-mono text-[12px]",children:l.replace(/^    /,"")},i);
    if(l.startsWith("|")) return n.jsx("p",{className:"font-mono text-[12px]",children:l},i);
    if(!l.trim()) return n.jsx("div",{className:"h-2"},i);
    const inl=inlineImages(l,i,resolveSrc);
    if(inl) return IMG_LINE.test(l.trim())?n.jsx("div",{className:"mt-2",children:inl},i):n.jsx("p",{className:"mt-2 text-muted",children:inl},i);
    return n.jsx("p",{className:"mt-2 text-muted",children:l},i);
  })});
}
