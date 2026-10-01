const DEFAULT_BASE_URL = "https://apig.inmoviebox.com";

function md5(input) {
  const msg = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  const bitLen = msg.length * 8;
  const bytes = Array.from(msg);
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push((bitLen >>> (8 * i)) & 0xff);
  const K = Array.from({length:64}, (_,i) => Math.floor(Math.abs(Math.sin(i+1)) * 2**32) >>> 0);
  const S = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
  const rot=(x,n)=>(x<<n)|(x>>>(32-n));
  for(let off=0;off<bytes.length;off+=64){
    const M=new Uint32Array(16);
    for(let j=0;j<16;j++) M[j]=(bytes[off+4*j]|bytes[off+4*j+1]<<8|bytes[off+4*j+2]<<16|bytes[off+4*j+3]<<24)>>>0;
    let A=a0,B=b0,C=c0,D=d0;
    for(let i=0;i<64;i++){
      let F,g;
      if(i<16){F=(B&C)|((~B)&D);g=i}
      else if(i<32){F=(D&B)|((~D)&C);g=(5*i+1)%16}
      else if(i<48){F=B^C^D;g=(3*i+5)%16}
      else {F=C^(B|(~D));g=(7*i)%16}
      const T=(A+F+K[i]+M[g])>>>0;
      A=D;D=C;C=B;B=(B+rot(T,S[(i>>4)*4+(i%4)]))>>>0;
    }
    a0=(a0+A)>>>0;b0=(b0+B)>>>0;c0=(c0+C)>>>0;d0=(d0+D)>>>0;
  }
  return [a0,b0,c0,d0].map(x=>[0,8,16,24].map(s=>((x>>>s)&255).toString(16).padStart(2,"0")).join("")).join("");
}

function base64Encode(bytes) {
  let s=""; for(const b of bytes) s+=String.fromCharCode(b);
  return btoa(s);
}
function base64Decode(s) {
  const raw=atob(s); return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function hmacMd5(keyBytes, data) {
  const block=64; let k=Uint8Array.from(keyBytes);
  if(k.length>block) k=hexToBytes(md5(k));
  const kb=new Uint8Array(block); kb.set(k);
  const ipad=new Uint8Array(block), opad=new Uint8Array(block);
  for(let i=0;i<block;i++){ipad[i]=kb[i]^0x36;opad[i]=kb[i]^0x5c}
  const inner=md5(concat(ipad,new TextEncoder().encode(data)));
  const outer=md5(concat(opad,hexToBytes(inner)));
  return hexToBytes(outer);
}
function concat(a,b){const x=new Uint8Array(a.length+b.length);x.set(a);x.set(b,a.length);return x}
function hexToBytes(h){const x=new Uint8Array(h.length/2);for(let i=0;i<x.length;i++)x[i]=parseInt(h.slice(i*2,i*2+2),16);return x}

function clientToken() {
  const ts=String(Date.now()); return ts+","+md5([...ts].reverse().join(""));
}
function clientInfo(env) {
  return {
    package_name:"com.community.oneroom",version_name:"4.0.02",version_code:50020126,
    os:"android",os_version:"14",install_ch:"ps",device_id:"86820305"+crypto.randomUUID().replace(/\D/g,"").slice(0,7),
    install_store:"ps",gaid:"",brand:"Google",model:"Pixel 6",system_language:"en",net:"wifi",
    region:env.MOVIEBOX_REGION||"NG",timezone:env.TZ||"Africa/Lagos",sp_code:"404"
  };
}
async function signature(method,url,body,ts,secret){
  const u=new URL(url), pairs=[...u.searchParams.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const query=pairs.map(([k,v])=>k+"="+v).join("&"), resource=u.pathname+(query?"?"+query:"");
  const bodyMd5=body?md5(body.slice(0,102400)):"";
  const canonical=[method.toUpperCase(),"application/json","application/json;charset=UTF-8",body?String(body.length):"",String(ts),bodyMd5,resource].join("\n");
  let key;
  try{key=base64Decode(secret)}catch{key=new TextEncoder().encode(secret||"")}
  const digest=await hmacMd5(key,canonical);
  return ts+"|2|"+base64Encode(digest);
}

async function movieboxRequest(env, method, path, params={}, body=null) {
  const base=(env.MOVIEBOX_INTERNAL_BASE_URL||DEFAULT_BASE_URL).replace(/\/$/,"");
  const u=new URL(base+path);
  for(const [k,v] of Object.entries({...params,host:new URL(base).host})) u.searchParams.set(k,String(v));
  const bodyText=body?JSON.stringify(body):"";
  const ts=Date.now();
  const headers={
    "User-Agent":"MovieBox/4.0.02 (Android 14; Pixel 6)","Accept":"application/json",
    "Content-Type":"application/json;charset=UTF-8","X-M-Version":"4.0.02","X-Sign-Version":"2.0",
    "X-Client-Token":clientToken(),"X-Client-Info":JSON.stringify(clientInfo(env)),"X-Client-Status":"0",
    "X-Play-Mode":"2","appid":env.MOVIEBOX_APP_ID||"4U01pxRu278gCZKY9",
    "region":env.MOVIEBOX_REGION||"NG","lang":env.MOVIEBOX_LANG||"en","os":"android",
    "X-Timestamp":String(ts),"x-tr-signature":await signature(method,u.toString(),bodyText,ts,env.MOVIEBOX_GATEWAY_SECRET||""),
    "Referer":base+"/"
  };
  if(env.MOVIEBOX_GUEST_TOKEN) headers.Authorization="Bearer "+env.MOVIEBOX_GUEST_TOKEN;
  const response=await fetch(u,{method,headers,body:bodyText||undefined});
  const text=await response.text();
  if(!response.ok) throw new Error("MovieBox upstream HTTP "+response.status+": "+text.slice(0,300));
  return JSON.parse(text);
}

function items(payload){const d=payload?.data; if(Array.isArray(d)) return d; return d?.items||d?.list||d?.subjects||[]}
function subjectName(s){return String(s?.title||s?.name||s?.subjectName||"").trim()}
function isTv(s){const raw=["type","subjectType","mediaType","category"].map(k=>String(s?.[k]||"")).join(" ").toLowerCase();return ["tv","series","show","anime"].some(x=>raw.includes(x))}
async function findSubject(env,title,year,mediaType){
  let payload;
  try{payload=await movieboxRequest(env,"GET","/wefeed-mobile-bff/subject-api/search",{q:title,page:1,pageSize:20})}
  catch{payload=await movieboxRequest(env,"POST","/wefeed-mobile-bff/subject-api/search",{}, {keyword:title,type:0,page:1,pageSize:20})}
  const wantTv=mediaType==="tv", wantedYear=String(year||""); let best=null,bestScore=-1;
  for(const raw of items(payload)){const s=raw?.subject&&typeof raw.subject==="object"?raw.subject:raw;if(!s||!subjectName(s))continue;
    const name=subjectName(s), release=String(s.releaseDate||s.releaseTime||s.year||"");let score=0;
    if(name.toLowerCase()===title.toLowerCase())score+=100; else if(name.toLowerCase().includes(title.toLowerCase())||title.toLowerCase().includes(name.toLowerCase()))score+=40;
    if(wantedYear&&release.startsWith(wantedYear))score+=20;if(mediaType&&isTv(s)===wantTv)score+=15;
    if(score>bestScore){bestScore=score;best=s}
  } return best;
}
function mediaType(url){const x=url.toLowerCase().split("?")[0];if(x.endsWith(".m3u8"))return "hls";if(/\.(mp4|m4v|webm|ogv)$/.test(x))return "mp4";return null}

export async function onRequestGet({request,env}) {
  const url=new URL(request.url), title=url.searchParams.get("title")?.trim();
  const year=url.searchParams.get("year")||"", type=url.searchParams.get("media_type")||"movie";
  const season=Number(url.searchParams.get("season")||1), episode=Number(url.searchParams.get("episode")||1);
  if(!title) return Response.json({status:"error",message:"title is required"}, {status:400});
  try{
    const subject=await findSubject(env,title,year,type);
    if(!subject) return Response.json({status:"not_found",sources:[],message:"No native MovieBox stream was returned for this title."},{status:404});
    const subjectId=subject.subjectId||subject.id||subject.subject_id;if(!subjectId)return Response.json({status:"not_found",sources:[]},{status:404});
    const play=await movieboxRequest(env,"GET","/wefeed-mobile-bff/subject-api/play-info",{subjectId:String(subjectId),se:season,ep:episode});
    const data=play?.data||{}, streams=data.streamList||data.streams||[], subtitles=data.subTitleList||data.subtitles||[];
    const normalized=streams.map(s=>{const u=String(s?.url||s?.streamUrl||s?.stream_url||"").trim();return {url:u,type:mediaType(u),quality:s?.quality||s?.resolution||"Auto",cookie:s?.cookie||s?.signCookie||data?.signCookie||""}}).filter(x=>x.url&&x.type);
    normalized.sort((a,b)=>(a.type==="hls"?0:1)-(b.type==="hls"?0:1) || (/(h265|x265|hev1)/i.test(a.url)?1:0)-(/(h265|x265|hev1)/i.test(b.url)?1:0));
    if(!normalized.length)return Response.json({status:"not_found",sources:[],message:"No browser-compatible native stream was returned."},{status:404});
    const best=normalized[0];
    return Response.json({status:"ready",source:"moviebox-internal",url:best.url,type:best.type,quality:best.quality,subject_id:String(subjectId),title:subjectName(subject)||title,season,episode,headers:best.cookie?{Cookie:best.cookie}:{},subtitles});
  }catch(error){return Response.json({status:"error",sources:[],message:"MovieBox native playback provider failed.",detail:String(error?.message||error).slice(0,300)},{status:502})}
}
