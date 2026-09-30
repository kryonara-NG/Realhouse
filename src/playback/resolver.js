const CACHE_PREFIX='rh:resolver:';
const CACHE_TTL=60*60*1000;

const norm=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

function readCache(key){
  try{
    const x=JSON.parse(localStorage.getItem(CACHE_PREFIX+key));
    if(x&&Date.now()-x.t<CACHE_TTL)return x.d;
  }catch{}
  return null;
}
function writeCache(key,d){
  try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({t:Date.now(),d}))}catch{}
}

function directMap(){
  const map=globalThis.REELHOUSE_SOURCE_MAP;
  return map&&typeof map==='object'?map:{};
}

function mappedSource(m,season,episode){
  const map=directMap();
  const keys=[
    m?.media_type==='tv' ? `tv:${m.id}:${season}:${episode}` : `movie:${m?.id}`,
    String(m?.id||'')
  ];
  for(const k of keys){
    const x=map[k];
    if(typeof x==='string')return {url:x,type:/\.m3u8(?:$|\?)/i.test(x)?'hls':'mp4',source:'configured'};
    if(x?.url)return {...x,source:x.source||'configured'};
  }
  return null;
}

function archiveFileUrl(identifier,name){
  return 'https://archive.org/download/'+encodeURIComponent(identifier)+'/'+String(name).split('/').map(encodeURIComponent).join('/');
}

function pickFile(files=[]){
  const usable=files.filter(f=>f&&typeof f.name==='string'&&
    /\.(mp4|m4v|webm|ogv|m3u8)$/i.test(f.name)&&
    !/(^|[._-])(thumb|thumbnail|sample|trailer|preview)([._-]|$)/i.test(f.name));
  const score=f=>{
    const n=f.name.toLowerCase();
    const type=/\.mp4$/i.test(n)?0:/\.m3u8$/i.test(n)?1:/\.(m4v|webm)$/i.test(n)?2:3;
    const size=Number(f.size)||Number.MAX_SAFE_INTEGER;
    return type*1e15+Math.min(size,9e14);
  };
  return usable.sort((a,b)=>score(a)-score(b))[0]||null;
}

async function archiveSearch(m){
  const title=m?.title||m?.name;
  if(!title)return null;
  const year=String(m?.release_date||m?.first_air_date||'').slice(0,4);
  const q=`title:("${String(title).replace(/["\\]/g,' ')}") AND mediatype:movies`;
  const u='https://archive.org/advancedsearch.php?q='+encodeURIComponent(q)+
    '&fl[]=identifier&fl[]=title&fl[]=year&sort[]=downloads+desc&rows=12&output=json';
  const r=await fetch(u);
  if(!r.ok)throw new Error('Archive search '+r.status);
  const d=await r.json();
  const target=norm(title);
  const candidates=d?.response?.docs||[];
  return candidates.find(x=>{
    const same=norm(x.title)===target;
    const y=Number(x.year),ty=Number(year);
    return same&&( !ty || !y || Math.abs(y-ty)<=1 );
  })||null;
}

async function archiveResolve(m){
  const hit=await archiveSearch(m);
  if(!hit?.identifier)return null;
  const r=await fetch('https://archive.org/metadata/'+encodeURIComponent(hit.identifier));
  if(!r.ok)throw new Error('Archive metadata '+r.status);
  const d=await r.json();
  const file=pickFile(d.files||[]);
  if(!file)return null;
  return {
    status:'ready',
    type:/\.m3u8$/i.test(file.name)?'hls':/\.(webm|ogv)$/i.test(file.name)?'webm':'mp4',
    url:archiveFileUrl(hit.identifier,file.name),
    source:'internet-archive',
    identifier:hit.identifier,
    title:hit.title||m.title||m.name
  };
}

const VIDSRC_BASE=(globalThis.REELHOUSE_VIDSRC_BASE||'https://vidsrc.sh').replace(/\/$/,'');
function vidsrcMovieSource(m,startAt=0){
  if(!m?.id)return null;
  const q=new URLSearchParams({autoplay:'1'});
  if(Number(startAt)>0)q.set('startAt',String(Math.max(0,Number(startAt))));
  return {
    status:'ready',
    type:'vidsrc',
    source:'vidsrc',
    url:`${VIDSRC_BASE}/embed/movie/${encodeURIComponent(m.id)}?${q}`,
    tmdb_id:m.id,
    title:m.title||m.name||'Movie'
  };
}

export async function resolveMovieSource(m){
  const key='movie:'+m?.id;
  const cached=readCache(key);
  if(cached&&cached.source==='vidsrc')return cached;
  const mapped=mappedSource(m);
  if(mapped){
    const result={...mapped,status:'ready'};
    writeCache(key,result);
    return result;
  }
  const result=vidsrcMovieSource(m,Number(globalThis.REELHOUSE_PROGRESS?.[m?.id]||0))||{
    status:'coming-soon',
    source:null,
    reason:'Missing TMDB movie id.'
  };
  writeCache(key,result);
  return result;
}

export async function resolveEpisodeSource(series,season,episode,startAt=0){
  const key=`tv:${series?.id}:${season}:${episode}`;
  const cached=readCache(key);
  if(cached&&cached.source==='vidsrc')return cached;
  const mapped=mappedSource(series,season,episode);
  if(mapped){
    const result={...mapped,status:'ready'};
    writeCache(key,result);
    return result;
  }
  const id=series?.id;
  if(!id)return {status:'coming-soon',source:null,reason:'Missing TMDB series id.'};
  const q=new URLSearchParams({autoplay:'1',autonext:'1'});
  if(Number(startAt)>0)q.set('startAt',String(Math.max(0,Number(startAt))));
  const result={
    status:'ready',
    type:'vidsrc',
    source:'vidsrc',
    url:`${VIDSRC_BASE}/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}?${q}`,
    tmdb_id:id,
    season:Number(season),
    episode:Number(episode),
    title:series?.name||series?.title||'Series'
  };
  writeCache(key,result);
  return result;
}

export async function checkVidSrcAvailability(kind,id,season,episode){
  if(!id)return {available:false,status:400};
  const path=kind==='tv'
    ? (season!=null&&episode!=null?'/info/tv/'+encodeURIComponent(id)+'/'+encodeURIComponent(season)+'/'+encodeURIComponent(episode)+'.json':'/info/tv/'+encodeURIComponent(id)+'.json')
    : '/info/movie/'+encodeURIComponent(id)+'.json';
  try{
    const r=await fetch(VIDSRC_BASE+path,{headers:{Accept:'application/json'}});
    if(r.status===404)return {available:false,status:404};
    if(!r.ok)return {available:null,status:r.status};
    return {available:true,status:r.status,data:await r.json()};
  }catch{return {available:null,status:0}}
}

export function clearResolverCache(){
  try{Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k))}catch{}
}
