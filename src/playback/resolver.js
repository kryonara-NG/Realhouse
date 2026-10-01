const CACHE_PREFIX='rh:resolver:v8:';
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
const DEFAULT_BASE='https://vidsrc.sh',MIRRORS=['https://vidsrc.sh','https://vidsrc2.ru','https://vidsrc.ir'];
const configuredBase=String(globalThis.REELHOUSE_VIDSRC_BASE||import.meta.env.VITE_VIDSRC_BASE||'').trim().replace(/\/$/,'');
const MOVIEBOX_BASE=String(globalThis.REELHOUSE_MOVIEBOX_BASE||import.meta.env.VITE_MOVIEBOX_API_BASE||'').trim().replace(/\/$/,'');
const VIDSRC_BASE=configuredBase||DEFAULT_BASE;
export const VIDSRC_CUSTOM_DOMAIN=Boolean(configuredBase);
export const VIDSRC_MIRRORS=[VIDSRC_BASE,...MIRRORS.filter(x=>x!==VIDSRC_BASE)];
function mediaTypeFromUrl(url){return /\.m3u8(?:$|\?)/i.test(url)?'hls':/\.(mp4|m4v|webm|ogv)(?:$|\?)/i.test(url)?'mp4':null}
function normalizeMovieBoxResult(payload,m,season,episode){
 const candidates=[payload,payload?.source,payload?.stream,payload?.result,payload?.data,...(Array.isArray(payload?.sources)?payload.sources:[])];
 for(const x of candidates){
  const url=typeof x==='string'?x:x?.url||x?.streamUrl||x?.stream_url||x?.playbackUrl||x?.playback_url;
  if(typeof url!=='string'||!/^https?:\/\//i.test(url))continue;
  const type=mediaTypeFromUrl(url);
  if(!type)continue;
  return {status:'ready',type,source:'moviebox',url,tmdb_id:m?.id,season,episode,title:m?.title||m?.name||'Movie'};
 }
 return null;
}
async function movieBoxSource(m,season,episode){
 const base=MOVIEBOX_BASE||'/api/moviebox';
 if(!m?.title&&!m?.name)return null;
 const title=m.title||m.name;
 const qs=new URLSearchParams({title});
 if(m.release_date)qs.set('year',String(m.release_date).slice(0,4));
 if(m.media_type==='tv'){qs.set('season',String(season||1));qs.set('episode',String(episode||1))}
 try{
  const r=await fetch(base+'/stream?'+qs.toString(),{cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)return null;
  return normalizeMovieBoxResult(await r.json(),m,season,episode);
 }catch{return null}
}
function subtitleParams(){let prefs=['en'];try{const x=JSON.parse(localStorage.getItem('rh:subtitlePrefs'));if(Array.isArray(x)&&x.length)prefs=x}catch{}return {ds_lang:prefs.filter(Boolean).slice(0,3).join(',')}}
function vidsrcUrl(path,params={}){const u=new URL(VIDSRC_BASE+path);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});return u.toString()}
function embedSource(m,season,episode,startAt=0){
 if(!m?.id)return null;
 const tv=m.media_type==='tv',path=tv?'/embed/tv/'+encodeURIComponent(m.id)+'/'+encodeURIComponent(season)+'/'+encodeURIComponent(episode):'/embed/movie/'+encodeURIComponent(m.id);
 return {status:'ready',type:'embed',source:'player',url:vidsrcUrl(path,{autoplay:1,...(Number(startAt)>0?{startAt:Math.max(0,Number(startAt))}:{}),...subtitleParams()}),tmdb_id:m.id,season,episode,title:m.title||m.name||'Movie'};
}
async function verifiedEmbedSource(m,season,episode,startAt=0){
 const tv=m?.media_type==='tv';
 for(const base of VIDSRC_MIRRORS){
  try{
   const path=tv?'/info/tv/'+encodeURIComponent(m.id)+'/'+encodeURIComponent(season)+'/'+encodeURIComponent(episode)+'.json':'/info/movie/'+encodeURIComponent(m.id)+'.json';
   const r=await fetch(base+path,{cache:'no-store'});
   if(!r.ok)continue;
   const info=await r.json();
   const url=info?.embed_url_tmdb||info?.embed_url;
   if(url)return {status:'ready',type:'embed',source:'player',url:(startAt>0?url+(url.includes('?')?'&':'?')+'startAt='+encodeURIComponent(startAt):url),tmdb_id:m.id,season,episode,title:m.title||m.name||'Movie'};
  }catch{}
 }
 return embedSource(m,season,episode,startAt);
}
export async function resolveMovieSource(m){
 const key='movie:'+m?.id,cached=readCache(key);if(cached)return cached;
 const result=await movieBoxSource(m)||await verifiedEmbedSource(m)||mappedSource(m)||await extractedSource(m)||await archiveDirectSource(m);
 if(result){const out={...result,status:'ready'};writeCache(key,out);return out}
 return {status:'coming-soon',source:null,reason:'Movie playback is not available right now.'};
}
export async function resolveEpisodeSource(series,season,episode,startAt=0){
 const key='tv:'+series?.id+':'+season+':'+episode,cached=readCache(key);if(cached)return cached;
 const result=await movieBoxSource(series,season,episode)||await verifiedEmbedSource(series,season,episode,startAt)||mappedSource(series,season,episode)||await extractedSource(series,season,episode);
 if(result){const out={...result,status:'ready'};writeCache(key,out);return out}
 return {status:'coming-soon',source:null,reason:'Episode playback is not available right now.'};
}
export function clearResolverCache(){try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}}
