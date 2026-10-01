import { API_BASE } from '../config.js';

const CACHE_PREFIX='rh:resolver:v11:';
const CACHE_TTL=30*60*1000;
function readCache(key){try{const x=JSON.parse(localStorage.getItem(CACHE_PREFIX+key));if(x&&Date.now()-x.t<CACHE_TTL)return x.d}catch{}return null}
function writeCache(key,d){try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({t:Date.now(),d}))}catch{}}
function mediaTypeFromUrl(url){const clean=String(url||'').split('?')[0].toLowerCase();if(clean.endsWith('.m3u8'))return 'hls';if(/\.(mp4|m4v|webm|ogv)$/.test(clean))return 'mp4';return null}
function normalizeInternal(payload,m,season,episode){
 const candidates=[payload,payload?.source,payload?.stream,payload?.result,payload?.data,...(Array.isArray(payload?.sources)?payload.sources:[])];
 for(const x of candidates){
  const url=typeof x==='string'?x:x?.url||x?.streamUrl||x?.stream_url||x?.playbackUrl||x?.playback_url;
  if(typeof url!=='string'||!/^https?:\/\//i.test(url))continue;
  const type=x?.type||mediaTypeFromUrl(url);
  if(type!=='hls'&&type!=='mp4')continue;
  return {status:'ready',type,source:'moviebox-internal',url,quality:x?.quality||x?.resolution||'Auto',headers:x?.headers||{},subtitles:x?.subtitles||payload?.subtitles||[],subject_id:x?.subject_id||payload?.subject_id,tmdb_id:m?.id,season,episode,progressKey:m?.media_type==='tv'?('tv:'+m?.id+':'+season+':'+episode):('movie:'+m?.id),title:m?.title||m?.name||'Movie'};
 }
 return null;
}
async function internalMovieBoxSource(m,season=1,episode=1){
 if(!m?.title&&!m?.name)return null;
 const qs=new URLSearchParams({title:m.title||m.name,media_type:m.media_type==='tv'?'tv':'movie'});
 const year=(m.release_date||m.first_air_date||'').slice(0,4);if(year)qs.set('year',year);
 if(m.media_type==='tv'){qs.set('season',String(season||1));qs.set('episode',String(episode||1));}
 try{const r=await fetch((API_BASE||location.origin)+'/api/moviebox-internal/stream?'+qs.toString(),{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)return null;return normalizeInternal(await r.json(),m,season,episode)}catch{return null}
}
export async function resolveMovieSource(m){
 const key='movie:'+m?.id,cached=readCache(key);if(cached)return cached;
 const result=await internalMovieBoxSource(m,1,1);if(result){writeCache(key,result);return result}
 return {status:'coming-soon',source:null,reason:'No native MovieBox stream is available for this title right now.'};
}
export async function resolveEpisodeSource(series,season,episode,startAt=0){
 const key='tv:'+series?.id+':'+season+':'+episode,cached=readCache(key);if(cached)return cached;
 const result=await internalMovieBoxSource(series,season,episode);if(result){writeCache(key,result);return result}
 return {status:'coming-soon',source:null,reason:'No native MovieBox stream is available for this episode right now.'};
}
export function clearResolverCache(){try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}}
