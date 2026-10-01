const CACHE_PREFIX='rh:resolver:v6:';
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

async function archiveDirectSource(m){
  if(!m?.title)return null;
  try{
    const q=new URL('https://archive.org/advancedsearch.php');
    const title=String(m.title).replace(/["\\]/g,' ').trim();
    q.searchParams.set('q','mediatype:movies AND title:"'+title+'" AND (licenseurl:* OR rights:"Public Domain")');
    ['identifier','title','year','date','licenseurl','rights'].forEach(f=>q.searchParams.append('fl[]',f));
    q.searchParams.set('rows','8');q.searchParams.set('output','json');
    const r=await fetch(q.href,{cache:'no-store'});if(!r.ok)return null;
    const docs=(await r.json())?.response?.docs||[];
    const candidates=docs.filter(x=>String(x?.licenseurl||x?.rights||'').toLowerCase().includes('public domain')||String(x?.licenseurl||'').toLowerCase().includes('creativecommons.org/licenses/')||String(x?.licenseurl||'').toLowerCase().includes('creativecommons.org/publicdomain/'));
    for(const d of candidates){
      const id=d?.identifier;if(!id)continue;
      const meta=await fetch('https://archive.org/metadata/'+encodeURIComponent(id),{cache:'no-store'});if(!meta.ok)continue;
      const files=(await meta.json())?.files||[];
      const f=files.find(x=>/\.(mp4|m4v|webm|ogv)$/i.test(String(x?.name||''))&&!/trailer|sample|preview/i.test(String(x?.name||'')));
      if(f?.name){
        const parts=String(f.name).split('/').map(encodeURIComponent).join('/');
        return {url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+parts,type:'mp4',source:'archive-direct',identifier:id,title:m.title};
      }
    }
  }catch{}
  return null;
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
  const archive=await archiveDirectSource(m);
  if(archive){const result={...archive,status:'ready'};writeCache(key,result);return result;}
  const mapped=mappedSource(m);
  if(mapped){const result={...mapped,status:'ready'};writeCache(key,result);return result;}
  // Do not turn an unresolved title into an iframe source.
  // The UI is intentionally direct-media-only.
  return {status:'coming-soon',source:null,reason:'No extracted or configured direct video is available.'};

}
export async function resolveEpisodeSource(series,season,episode,startAt=0){
  const key=`tv:${series?.id}:${season}:${episode}`;
  const cached=readCache(key);if(cached)return cached;
  const extracted=await extractedSource(series,season,episode);
  if(extracted){const result={...extracted,status:'ready'};writeCache(key,result);return result;}
  const mapped=mappedSource(series,season,episode);
  if(mapped){const result={...mapped,status:'ready'};writeCache(key,result);return result;}
  return {status:'coming-soon',source:null,reason:'No extracted or configured direct video is available.'};

}
export function clearResolverCache(){
  try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}
}