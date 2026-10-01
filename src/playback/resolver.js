const CACHE_PREFIX='rh:resolver:v7:';
const CACHE_TTL=30*60*1000;
function readCache(key){try{const x=JSON.parse(localStorage.getItem(CACHE_PREFIX+key));if(x&&Date.now()-x.t<CACHE_TTL)return x.d}catch{}return null}
function writeCache(key,d){try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({t:Date.now(),d}))}catch{}}
function directMap(){const map=globalThis.REELHOUSE_SOURCE_MAP;return map&&typeof map==='object'?map:{}}
async function extractedSource(m,season,episode){
 try{
  const key=m?.media_type==='tv'?'tv:'+m.id+':'+season+':'+episode:'movie:'+m?.id;
  const r=await fetch('/vidsrc-streams.json?'+Date.now(),{cache:'no-store'});if(!r.ok)return null;
  const map=await r.json(),x=map?.[key]??map?.[String(m?.id||'')],url=typeof x==='string'?x:x?.url;
  if(!url)return null;
  return {url,type:/\.m3u8(?:$|\?)/i.test(url)?'hls':'mp4',source:'direct',tmdb_id:m?.id,season,episode,title:m?.title||m?.name||'Movie'};
 }catch{return null}
}
async function archiveDirectSource(m){
 if(!m?.title)return null;
 try{
  const q=new URL('https://archive.org/advancedsearch.php'),title=String(m.title).replace(/["\\]/g,' ').trim();
  q.searchParams.set('q','mediatype:movies AND title:"'+title+'" AND (licenseurl:* OR rights:"Public Domain")');
  ['identifier','title','year','date','licenseurl','rights'].forEach(f=>q.searchParams.append('fl[]',f));q.searchParams.set('rows','8');q.searchParams.set('output','json');
  const r=await fetch(q.href,{cache:'no-store'});if(!r.ok)return null;
  const docs=(await r.json())?.response?.docs||[];
  const ok=x=>{const s=String(x?.licenseurl||x?.rights||'').toLowerCase();return s.includes('public domain')||s.includes('creativecommons.org/licenses/')||s.includes('creativecommons.org/publicdomain/')};
  for(const d of docs.filter(ok)){
   if(!d?.identifier)continue;
   const meta=await fetch('https://archive.org/metadata/'+encodeURIComponent(d.identifier),{cache:'no-store'});if(!meta.ok)continue;
   const files=(await meta.json())?.files||[],f=files.find(x=>/\.(mp4|m4v|webm|ogv)$/i.test(String(x?.name||''))&&!/trailer|sample|preview/i.test(String(x?.name||'')));
   if(f?.name)return {url:'https://archive.org/download/'+encodeURIComponent(d.identifier)+'/'+String(f.name).split('/').map(encodeURIComponent).join('/'),type:'mp4',source:'archive-direct',identifier:d.identifier,title:m.title};
  }
 }catch{}return null;
}
function mappedSource(m,season,episode){
 const map=directMap(),keys=[m?.media_type==='tv'?'tv:'+m.id+':'+season+':'+episode:'movie:'+m?.id,String(m?.id||'')];
 for(const k of keys){const x=map[k];if(typeof x==='string')return {url:x,type:/\.m3u8(?:$|\?)/i.test(x)?'hls':'mp4',source:'configured'};if(x?.url)return {...x,source:x.source||'configured'}}return null;
}
const DEFAULT_BASE='https://vidsrcme.ru',MIRRORS=['https://vidsrc.sh','https://vidsrc2.ru','https://vidsrc.ir'];
const configuredBase=String(globalThis.REELHOUSE_VIDSRC_BASE||import.meta.env.VITE_VIDSRC_BASE||'').trim().replace(/\/$/,'');
const VIDSRC_BASE=configuredBase||DEFAULT_BASE;
export const VIDSRC_CUSTOM_DOMAIN=Boolean(configuredBase);
export const VIDSRC_MIRRORS=[VIDSRC_BASE,...MIRRORS.filter(x=>x!==VIDSRC_BASE)];
function subtitleParams(){let prefs=['en'];try{const x=JSON.parse(localStorage.getItem('rh:subtitlePrefs'));if(Array.isArray(x)&&x.length)prefs=x}catch{}return {ds_lang:prefs.filter(Boolean).slice(0,3).join(',')}}
function vidsrcUrl(path,params={}){const u=new URL(VIDSRC_BASE+path);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});return u.toString()}
function embedSource(m,season,episode,startAt=0){
 if(!m?.id)return null;
 const tv=m.media_type==='tv',path=tv?'/embed/tv/'+encodeURIComponent(m.id)+'/'+encodeURIComponent(season)+'/'+encodeURIComponent(episode):'/embed/movie/'+encodeURIComponent(m.id);
 return {status:'ready',type:'embed',source:'player',url:vidsrcUrl(path,{autoplay:1,...(Number(startAt)>0?{startAt:Math.max(0,Number(startAt))}:{}),...subtitleParams()}),tmdb_id:m.id,season,episode,title:m.title||m.name||'Movie'};
}
export async function resolveMovieSource(m){
 const key='movie:'+m?.id,cached=readCache(key);if(cached)return cached;
 const result=mappedSource(m)||await extractedSource(m)||await archiveDirectSource(m)||embedSource(m);
 if(result){const out={...result,status:'ready'};writeCache(key,out);return out}
 return {status:'coming-soon',source:null,reason:'Movie playback is not available right now.'};
}
export async function resolveEpisodeSource(series,season,episode,startAt=0){
 const key='tv:'+series?.id+':'+season+':'+episode,cached=readCache(key);if(cached)return cached;
 const result=mappedSource(series,season,episode)||await extractedSource(series,season,episode)||embedSource(series,season,episode,startAt);
 if(result){const out={...result,status:'ready'};writeCache(key,out);return out}
 return {status:'coming-soon',source:null,reason:'Episode playback is not available right now.'};
}
export function clearResolverCache(){try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}}
