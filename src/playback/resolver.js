// Playback resolver intentionally disabled while Reelhouse uses TMDB as its catalog source.
// MovieBox remains in the repository for later work, but the frontend does not call it.
export async function resolveMovieSource(){
  return {status:'coming-soon',source:null,reason:'Playback sources are currently disabled.'};
}
export async function resolveEpisodeSource(){
  return {status:'coming-soon',source:null,reason:'Playback sources are currently disabled.'};
}
export function clearResolverCache(){try{Object.keys(localStorage).filter(k=>k.startsWith('rh:resolver:')).forEach(k=>localStorage.removeItem(k))}catch{}}
