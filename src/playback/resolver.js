const CACHE_PREFIX='rh:resolver:v4:';
const CACHE_TTL=30*60*1000;

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
async function extractedSource(m,season,episode){
  try{
    const key=m?.media_type==='tv' ? `tv:${m.id}:${season}:${episode}` : `movie:${m?.id}`;
    const r=await fetch('/vidsrc-streams.json?'+Date.now(),{cache:'no-store'});
    if(!r.ok)return null;
    const map=await r.json();
    const x=map?.[key]??map?.[String(m?.id||'')];
    if(!x)return null;
    const url=typeof x==='string'?x:x.url;
    if(!url)return null;
    return {url,type:/\.m3u8(?:$|\?)/i.test(url)?'hls':'mp4',source:'vidsrc-extracted',tmdb_id:m?.id,season,episode,title:m?.title||m?.name||'Movie'};
  }catch{return null}
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

const DEFAULT_BASE='https://vidsrc.sh';
const MIRRORS=['https://vidsrc.sh','https://vidsrc2.ru','https://vidsrc.ir'];
// Put the actual custom VidSrc domain in VITE_VIDSRC_BASE (or set
// REELHOUSE_VIDSRC_BASE at runtime). The custom domain must be the domain
// you configured with VidSrc; vidsrc-ip.com is the DNS CNAME target, not the
// player URL. Official mirrors remain fallback sources only when the custom
// domain cannot answer.
const configuredBase=String(globalThis.REELHOUSE_VIDSRC_BASE||import.meta.env.VITE_VIDSRC_BASE||'').trim().replace(/\/$/,'');
const VIDSRC_BASE=configuredBase||DEFAULT_BASE;
export const VIDSRC_CUSTOM_DOMAIN=Boolean(configuredBase);
export const VIDSRC_MIRRORS=[VIDSRC_BASE,...MIRRORS.filter(x=>x!==VIDSRC_BASE)];

function vidsrcUrl(path,params={}){
  const u=new URL(VIDSRC_BASE+path);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
  return u.toString();
}
function vidsrcMovieSource(m,startAt=0){
  if(!m?.id)return null;
  return {
    status:'ready',type:'vidsrc',source:'vidsrc',
    url:vidsrcUrl(`/embed/movie/${encodeURIComponent(m.id)}`,{autoplay:1,...(Number(startAt)>0?{startAt:Math.max(0,Number(startAt))}:{})}),
    tmdb_id:m.id,title:m.title||m.name||'Movie'
  };
}
async function probe(url){
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
    const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    clearTimeout(timer);
    if(!r.ok)return null;
    return await r.json();
  }catch{return null}
}
function subtitleParams(){
  let prefs=['en'];
  try{const x=JSON.parse(localStorage.getItem('rh:subtitlePrefs'));if(Array.isArray(x)&&x.length)prefs=x}catch{}
  return {ds_lang:prefs.filter(Boolean).slice(0,3).join(',')};
}
async function findAvailableMovie(m){
  if(!m?.id)return null;
  for(const base of VIDSRC_MIRRORS){
    const info=await probe(base+`/info/movie/${encodeURIComponent(m.id)}.json`);
    if(info?.status_code===200||info?.embed_url_tmdb||info?.embed_url)return {base,id:info.imdb_id||info.tmdb_id||m.id,info};
  }
  return {base:VIDSRC_BASE,id:m.id,info:{}};
}
async function findAvailableEpisode(series,season,episode){
  if(!series?.id)return null;
  for(const base of VIDSRC_MIRRORS){
    const info=await probe(base+`/info/tv/${encodeURIComponent(series.id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}.json`);
    if(info?.status_code===200||info?.embed_url_tmdb||info?.embed_url)return {base,id:info.imdb_id||info.tmdb_id||series.id,info};
  }
  return {base:VIDSRC_BASE,id:series.id,info:{}};
}
export async function resolveMovieSource(m){
  const key='movie:'+m?.id;
  const cached=readCache(key);if(cached)return cached;
  const extracted=await extractedSource(m);
  if(extracted){const result={...extracted,status:'ready'};writeCache(key,result);return result;}
  const mapped=mappedSource(m);
  if(mapped){const result={...mapped,status:'ready'};writeCache(key,result);return result;}
  const found=await findAvailableMovie(m);
  if(!found)return {status:'coming-soon',source:null,reason:'VidSrc reports this title is unavailable.'};
  const progress=Number(globalThis.REELHOUSE_PROGRESS?.[m?.id]||0);
  const params={...subtitleParams(),autoplay:1,...(progress>0?{startAt:Math.max(0,progress)}:{})};
  const result={status:'ready',type:'vidsrc',source:'vidsrc',url:found.base+`/embed/movie/${encodeURIComponent(found.id)}?${new URLSearchParams(params).toString()}`,tmdb_id:m.id,imdb_id:found.info.imdb_id||null,title:m.title||m.name||'Movie',quality:found.info.quality||null};
  writeCache(key,result);return result;
}
export async function resolveEpisodeSource(series,season,episode,startAt=0){
  const key=`tv:${series?.id}:${season}:${episode}`;
  const cached=readCache(key);if(cached)return cached;
  const extracted=await extractedSource(series,season,episode);
  if(extracted){const result={...extracted,status:'ready'};writeCache(key,result);return result;}
  const mapped=mappedSource(series,season,episode);
  if(mapped){const result={...mapped,status:'ready'};writeCache(key,result);return result;}
  const found=await findAvailableEpisode(series,season,episode);
  if(!found)return {status:'coming-soon',source:null,reason:'VidSrc reports this episode is unavailable.'};
  const params={...subtitleParams(),autoplay:1,autonext:1,...(Number(startAt)>0?{startAt:Math.max(0,Number(startAt))}:{})};
  const result={status:'ready',type:'vidsrc',source:'vidsrc',url:found.base+`/embed/tv/${encodeURIComponent(found.id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}?${new URLSearchParams(params).toString()}`,tmdb_id:series.id,imdb_id:found.info.imdb_id||null,season:Number(season),episode:Number(episode),title:series?.name||series?.title||'Series',quality:found.info.quality||null};
  writeCache(key,result);return result;
}
export function clearResolverCache(){
  try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}
}