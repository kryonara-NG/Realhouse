const CACHE_PREFIX='rh:resolver:v2:';
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
function mappedSource(m,season,episode){
  const map=directMap();
  const keys=[
    m?.media_type==='tv' ? `tv:${m.id}:${season}:${episode}` : `movie:${m?.id}`,
    String(m?.id||'')
  ];
  for(const k of keys){
    const x=map[k];
    if(typeof x==='string')return {url:x,type:/\\.m3u8(?:$|\\?)/i.test(x)?'hls':'mp4',source:'configured'};
    if(x?.url)return {...x,source:x.source||'configured'};
  }
  return null;
}

const DEFAULT_BASE='https://vidsrcme.ru';
const MIRRORS=['https://vidsrcme.ru','https://vidsrc.sh','https://vidsrc.to','https://vidsrc.cc','https://vidsrc.xyz','https://vidsrc.pm'];
const VIDSRC_BASE=String(globalThis.REELHOUSE_VIDSRC_BASE||import.meta.env.VITE_VIDSRC_BASE||DEFAULT_BASE).replace(/\\/$/,'');
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
export async function resolveMovieSource(m){
  const key='movie:'+m?.id;
  const mapped=mappedSource(m);
  if(mapped){const result={...mapped,status:'ready'};writeCache(key,result);return result;}
  const result=vidsrcMovieSource(m,Number(globalThis.REELHOUSE_PROGRESS?.[m?.id]||0))||{status:'coming-soon',source:null,reason:'Missing TMDB movie id.'};
  writeCache(key,result);
  return result;
}
export async function resolveEpisodeSource(series,season,episode,startAt=0){
  const key=`tv:${series?.id}:${season}:${episode}`;
  const mapped=mappedSource(series,season,episode);
  if(mapped){const result={...mapped,status:'ready'};writeCache(key,result);return result;}
  const id=series?.id;
  if(!id)return {status:'coming-soon',source:null,reason:'Missing TMDB series id.'};
  const result={
    status:'ready',type:'vidsrc',source:'vidsrc',
    url:vidsrcUrl(`/embed/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`,{autoplay:1,autonext:1,...(Number(startAt)>0?{startAt:Math.max(0,Number(startAt))}:{})}),
    tmdb_id:id,season:Number(season),episode:Number(episode),title:series?.name||series?.title||'Series'
  };
  writeCache(key,result);
  return result;
}
export function clearResolverCache(){
  try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}
}