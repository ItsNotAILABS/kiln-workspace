import{i as R,t as React}from"./react-SIfiwpqq.js";
import{t as jsxmod}from"./jsx-runtime-0vZSBttN.js";
import{t as Link}from"./link-BhiAFiqq.js";
import{o as Chrome,r as Tree,t as About,a as Readme}from"./RepoChrome-BaVvC5oG.js";
import{b as useKiln,d as allRepos}from"./store-sx46DNi5.js";
import{i as lattice,a as coherence}from"./pxm-D_rOQ1Ty.js";
import{t as useMatch}from"./useMatch-CaN9MMxo.js";
var rr=R(React(),1); var j=jsxmod();
function params(){
  try{
    const m=useMatch({select:s=>s});
    const p=m?.params||m?.matches?.at?.(-1)?.params||{};
    if(p.owner&&p.repo) return p;
  }catch{}
  const m=(typeof location<"u"?location.pathname:"").match(/^\/([^/]+)\/([^/]+)/);
  return {owner:m?.[1]||"", repo:m?.[2]||""};
}
function useRepo(){
  const p=params();
  const s=useKiln();
  const repo=(allRepos(s)||s.userRepos||[]).find(r=>r.owner===p.owner&&r.name===p.repo)
    || (allRepos(s)||[]).find(r=>r.id===p.owner+"/"+p.repo);
  return {p,s,repo};
}
function Shell({children,tab}){
  const {repo}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  return j.jsxs("div",{children:[j.jsx(Chrome,{repo}), children]});
}
function component(){
  const {repo,p}=useRepo();
  if(!repo) return j.jsx("p",{className:"py-16 text-center text-muted",children:"No public tree with that name."});
  const readme=repo.files?.find(f=>f.path.toLowerCase()==="readme.md");
  return j.jsxs("div",{children:[
    j.jsx(Chrome,{repo}),
    j.jsxs("div",{className:"mt-5 grid gap-6 lg:grid-cols-[1fr_16rem]",children:[
      j.jsxs("div",{children:[j.jsx(Tree,{repo}), readme?j.jsx("div",{className:"mt-6",children:j.jsx(Readme,{source:readme.content})}):null]}),
      j.jsx(About,{repo})
    ]})
  ]});
}
export{component};

