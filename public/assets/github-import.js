
const ENGINE="/api/github";
const UNGH="https://ungh.cc";
const GH="https://api.github.com";
const RAW="https://raw.githubusercontent.com";
const CODELOAD="https://codeload.github.com";
const SKIP_DIR=new Set(["node_modules","dist","build",".git","vendor","target",".next","coverage","__pycache__",".venv","out"]);
const SKIP_EXT=/\.(png|jpe?g|gif|webp|pdf|zip|tar|gz|tgz|wasm|woff2?|mp4|webm|ico|bin|pyc|so|dylib|exe|lock|map)$/i;
function skipPath(p){
  const parts=String(p).split("/").filter(Boolean);
  for(const part of parts){ if(SKIP_DIR.has(part)) return true; }
  return SKIP_EXT.test(p);
}

function u16(b,o){return b[o]|b[o+1]<<8}
function u32(b,o){return (b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0}
async function inflateRaw(bytes){
  if (typeof DecompressionStream==="function"){
    const ds=new DecompressionStream("deflate-raw");
    const w=ds.writable.getWriter();
    await w.write(bytes);
    await w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  throw new Error("deflate-raw unavailable");
}
async function unpackZipball(buf){
  const files=[];
  let eocd=-1;
  const start=Math.max(0,buf.length-22-65535);
  for(let i=buf.length-22;i>=start;i--){
    if(buf[i]===0x50&&buf[i+1]===0x4b&&buf[i+2]===0x05&&buf[i+3]===0x06){eocd=i;break}
  }
  if(eocd<0) return files;
  const cdOff=u32(buf,eocd+16);
  const cdEntries=u16(buf,eocd+10);
  let p=cdOff;
  for(let n=0;n<cdEntries;n++){
    if(p+46>buf.length||u32(buf,p)!==0x02014b50) break;
    const method=u16(buf,p+10);
    const compSize=u32(buf,p+20);
    const nameLen=u16(buf,p+28);
    const extraLen=u16(buf,p+30);
    const commentLen=u16(buf,p+32);
    const localOff=u32(buf,p+42);
    const name=new TextDecoder().decode(buf.subarray(p+46,p+46+nameLen));
    p+=46+nameLen+extraLen+commentLen;
    if(!name||name.endsWith("/")) continue;
    const lp=localOff;
    if(lp+30>buf.length||u32(buf,lp)!==0x04034b50) continue;
    const lNameLen=u16(buf,lp+26);
    const lExtra=u16(buf,lp+28);
    const dataStart=lp+30+lNameLen+lExtra;
    const compressed=buf.subarray(dataStart,dataStart+compSize);
    let data;
    try{
      if(method===0) data=compressed;
      else if(method===8) data=await inflateRaw(compressed);
      else continue;
    }catch{ continue; }
    const parts=name.split("/").filter(Boolean);
    const path=parts.length>1?parts.slice(1).join("/"):name;
    files.push({path,data});
  }
  return files;
}
function selectTextFiles(entries){
  const out=[];
  let skipped=0,bytes=0;
  for(const e of entries){
    if(!e.path||skipPath(e.path)){skipped+=1;continue}
    if(!e.data||e.data.length>1_500_000){skipped+=1;continue}
    if(out.length>=2500||bytes+e.data.length>40_000_000){skipped+=1;continue}
    const sample=e.data.subarray(0,800);
    if(sample.includes(0)){skipped+=1;continue}
    const content=new TextDecoder("utf-8",{fatal:false}).decode(e.data);
    bytes+=content.length;
    out.push({path:e.path,content,size:content.length,language:"",sha:"",encrypted:false});
  }
  return {files:out,skipped};
}

function parseQuery(raw){
  let q=String(raw||"").trim().replace(/^@/,"");
  if(!q) return {kind:"empty",query:""};
  const url=q.match(/github\.com[/:]([^/\s?#]+)(?:\/([^/\s?#]+))?/i);
  if(url){
    const owner=url[1];
    const repo=(url[2]||"").replace(/\.git$/i,"");
    return repo?{kind:"repo",owner,repo,query:`${owner}/${repo}`}:{kind:"user",owner,query:owner};
  }
  if(/^https?:\/\//i.test(q)) return {kind:"search",query:q};
  const parts=q.split("/").filter(Boolean);
  if(parts.length>=2) return {kind:"repo",owner:parts[0],repo:parts[1].replace(/\.git$/i,""),query:`${parts[0]}/${parts[1].replace(/\.git$/i,"")}`};
  return {kind:"user",owner:q,query:q};
}
function mapRepo(r){
  const full=r.fullName||r.full_name||r.repo||(r.owner&&r.name?`${typeof r.owner==="string"?r.owner:r.owner.login}/${r.name}`:r.name);
  const [owner,name]=String(full||"").split("/");
  return {fullName:full,name:r.name||name||"",owner:(typeof r.owner==="string"?r.owner:r.owner?.login)||owner||"",description:r.description||"",language:r.language||"",stars:r.stargazers_count||r.stars||0,forks:r.forks_count||r.forks||0,htmlUrl:r.htmlUrl||r.html_url||(full?`https://github.com/${full}`:""),defaultBranch:r.defaultBranch||r.default_branch||"main",topics:r.topics||[],license:r.license?.spdx_id||r.license?.name||r.license||"MIT"};
}
async function readJson(url, headers){
  const r=await fetch(url,{headers:headers||{Accept:"application/vnd.github+json"}});
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{data={message:text.slice(0,200)}}
  return {ok:r.ok,status:r.status,data};
}
async function engineLookup(query){
  const r=await fetch(`${ENGINE}/lookup?q=${encodeURIComponent(query)}`);
  const data=await r.json().catch(()=>null);
  if(data && Array.isArray(data.items)) return {ok:!!data.ok||data.items.length>0,error:data.error,items:(data.items||[]).map(mapRepo),via:data.via||"engine"};
  return {ok:false,items:[]};
}
async function engineImport(owner,repo){
  const r=await fetch(`${ENGINE}/import?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
  const data=await r.json().catch(()=>null);
  if(data && data.ok && Array.isArray(data.files)) return data;
  return null;
}
async function unghUserRepos(owner){
  const {ok,data}=await readJson(`${UNGH}/users/${encodeURIComponent(owner)}/repos`);
  if(!ok||!Array.isArray(data?.repos)) return [];
  return data.repos.map(mapRepo);
}
async function unghOne(owner,repo){
  const {ok,data}=await readJson(`${UNGH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if(!ok||!data?.repo) return null;
  return mapRepo(data.repo);
}
async function ghUserRepos(owner){
  let res=await readJson(`${GH}/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`);
  if(!res.ok) res=await readJson(`${GH}/orgs/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated`);
  if(!res.ok||!Array.isArray(res.data)) return [];
  return res.data.map(mapRepo);
}
async function ghSearch(query){
  const items=[];
  const users=await readJson(`${GH}/search/users?q=${encodeURIComponent(query)}&per_page=5`);
  if(users.ok&&Array.isArray(users.data?.items)){
    for(const u of users.data.items.slice(0,3)){
      const listed=await unghUserRepos(u.login);
      items.push(...(listed.length?listed:await ghUserRepos(u.login)));
    }
  }
  const repos=await readJson(`${GH}/search/repositories?q=${encodeURIComponent(query)}&per_page=30&sort=updated`);
  if(repos.ok&&Array.isArray(repos.data?.items)) items.push(...repos.data.items.map(mapRepo));
  return items;
}
function dedupe(items){
  const seen=new Set(); const out=[];
  for(const it of items){
    const k=String(it.fullName||"").toLowerCase();
    if(!k||seen.has(k)) continue;
    seen.add(k); out.push(it);
  }
  return out;
}
export async function githubListRepos(arg){
  const query=String(arg?.data?.query||arg?.query||"").trim();
  if(!query) return {ok:false,error:"Need a GitHub user, org, or owner/repo",items:[]};
  try{
    const viaEngine=await engineLookup(query).catch(()=>null);
    if(viaEngine&&viaEngine.items&&viaEngine.items.length) return viaEngine;
    const parsed=parseQuery(query);
    const items=[];
    if(parsed.kind==="repo"){
      const one=(await unghOne(parsed.owner,parsed.repo))||null;
      if(one) items.push(one);
      else {
        const {ok,data}=await readJson(`${GH}/repos/${parsed.owner}/${parsed.repo}`);
        if(ok) items.push(mapRepo(data));
      }
    }else if(parsed.kind==="user"){
      let listed=await unghUserRepos(parsed.owner);
      if(!listed.length) listed=await ghUserRepos(parsed.owner);
      items.push(...listed);
      if(!listed.length) items.push(...await ghSearch(parsed.query));
    }else{
      items.push(...await ghSearch(parsed.query));
    }
    const uniq=dedupe(items);
    if(!uniq.length) return {ok:false,error:`No public repositories for "${query}"`,items:[]};
    return {ok:true,items:uniq,via:"client-fallback"};
  }catch(e){
    return {ok:false,error:e instanceof Error?e.message:"GitHub lookup failed",items:[]};
  }
}
async function importViaRaw(owner, repo, branch, have){
  const haveSet=new Set((have||[]).map(f=>f.path));
  const files=[...(have||[])];
  let bytes=files.reduce((a,f)=>a+(f.content||"").length,0);
  const tree=await readJson(`${UNGH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/files/${encodeURIComponent(branch)}`);
  let entries=Array.isArray(tree.data?.files)?tree.data.files:[];
  if(!entries.length){
    const gh=await readJson(`${GH}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if(Array.isArray(gh.data?.tree)) entries=gh.data.tree.filter(e=>e.type==="blob").map(e=>({path:e.path,sha:e.sha,size:e.size}));
  }
  const blobs=entries.filter(e=>e.path&&!skipPath(e.path)&&!haveSet.has(e.path));
  const take=blobs.slice(0, Math.max(0, 2500-files.length));
  for(let i=0;i<take.length;i+=8){
    if(files.length>=2500||bytes>40_000_000) break;
    const batch=take.slice(i,i+8);
    const got=await Promise.all(batch.map(async b=>{
      if(b.size&&b.size>1_500_000) return null;
      const raw=await fetch(`${RAW}/${owner}/${repo}/${branch}/${b.path}`).catch(()=>null);
      if(!raw||!raw.ok) return null;
      const content=await raw.text();
      if(!content||content.slice(0,800).includes("\0")) return null;
      return {path:b.path,content,size:content.length,language:"",sha:b.sha||"",encrypted:false};
    }));
    for(const f of got){
      if(!f) continue;
      bytes+=f.content.length;
      files.push(f);
    }
  }
  return files;
}
export async function githubImportTree(arg){
  const owner=String(arg?.data?.owner||arg?.owner||"").trim();
  const repo=String(arg?.data?.repo||arg?.repo||"").trim().replace(/\.git$/i,"");
  if(!owner||!repo) return {ok:false,error:"Need owner/repo",files:[]};
  try{
    const metaItem=await unghOne(owner,repo);
    const branch=metaItem?.defaultBranch||"main";
    const meta={owner,repo,name:repo,fullName:`${owner}/${repo}`,branch,defaultBranch:branch,description:metaItem?.description||"",htmlUrl:`https://github.com/${owner}/${repo}`,stars:metaItem?.stars||0,forks:metaItem?.forks||0,license:"MIT",language:metaItem?.language||"",topics:[],sha:branch};
    let packed=null;
    const refs=["refs/heads/"+branch,branch,"refs/heads/main","refs/heads/master"];
    for(const ref of refs){
      const zip=await fetch(`${CODELOAD}/${owner}/${repo}/zip/${ref}`).catch(()=>null);
      if(!zip||!zip.ok) continue;
      const buf=new Uint8Array(await zip.arrayBuffer());
      if(buf[0]!==0x50||buf[1]!==0x4b) continue;
      const unpacked=selectTextFiles(await unpackZipball(buf));
      if(unpacked.files.length){
        packed={ok:true,files:unpacked.files,skipped:unpacked.skipped,via:"zip",meta:{...meta,branch:ref.replace(/^refs\/heads\//,"")}};
        break;
      }
    }
    const viaEngine=await engineImport(owner,repo).catch(()=>null);
    if(!packed && viaEngine && viaEngine.ok) packed=viaEngine;
    else if(packed && viaEngine && viaEngine.ok && (viaEngine.files||[]).length>packed.files.length) packed=viaEngine;
    const have=packed&&packed.files?packed.files:[];
    const filled=await importViaRaw(owner,repo,packed?.meta?.branch||branch,have);
    if(!filled.length) return {ok:false,error:`Could not fetch ${owner}/${repo}`,files:[]};
    return {ok:true,files:filled,via:packed?.via||"git tree",skipped:packed?.skipped||0,meta:{...meta,...(packed?.meta||{}),sha:packed?.meta?.sha||branch}};
  }catch(e){
    return {ok:false,error:e instanceof Error?e.message:"import failed",files:[]};
  }
}
async function engineAccount(query,limit){
  const r=await fetch(`${ENGINE}/account?q=${encodeURIComponent(query)}&limit=${limit||24}`);
  const data=await r.json().catch(()=>null);
  if(data&&Array.isArray(data.items)) return data;
  return null;
}
export async function githubImportAccount(arg){
  const query=String(arg?.data?.query||arg?.query||arg?.q||"").trim().replace(/^@/,"");
  const limit=Math.min(24,Math.max(1,Number(arg?.data?.limit||arg?.limit||24)||24));
  if(!query) return {ok:false,error:"Need a GitHub username",items:[],total:0};
  try{
    const via=await engineAccount(query,limit).catch(()=>null);
    if(via&&Array.isArray(via.items)&&via.items.length) return via;
    const listed=await githubListRepos({data:{query}});
    const items=(listed.items||[]).slice(0,limit);
    return {ok:items.length>0,login:query,query,total:(listed.items||[]).length,limit,items,via:listed.via||"client-fallback",error:items.length?undefined:listed.error};
  }catch(e){
    return {ok:false,error:e instanceof Error?e.message:"account lookup failed",items:[],total:0};
  }
}
export async function seedGithubAccount({handle,importGithub,linkGithub,onProgress,limit}){
  const login=String(handle||"").trim().replace(/^@/,"");
  if(!login) return {ok:0,fail:0,skip:0,total:0,listed:0};
  if(typeof linkGithub==="function") linkGithub(login);
  if(onProgress) onProgress(`Looking up github.com/${login}…`);
  const plan=await githubImportAccount({query:login,limit:limit||24});
  const items=plan.items||[];
  if(!items.length) return {ok:0,fail:0,skip:0,total:0,listed:plan.total||0,error:plan.error||`No public repositories on github.com/${login}`};
  let ok=0,fail=0,skip=0;
  for(let i=0;i<items.length;i++){
    const it=items[i];
    if(onProgress) onProgress(`${i+1}/${items.length} sealing ${it.fullName}`);
    try{
      const tree=await githubImportTree({data:{owner:it.owner,repo:it.name}});
      if(!tree.ok){fail+=1;continue}
      await importGithub({meta:tree.meta,files:tree.files,kind:"code"});
      ok+=1;
    }catch(e){
      const msg=e instanceof Error?e.message:"";
      if(/already exists/i.test(msg)) skip+=1; else fail+=1;
    }
  }
  return {ok,fail,skip,total:items.length,listed:plan.total||items.length};
}

