import { resolveMovieSource, resolveEpisodeSource } from './playback/resolver.js';
import { TMDB_READ_TOKEN } from './config.js';

export function mountReelhouse(){

const sv=p=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`,F='fill="currentColor" stroke="none"';
const HP='M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z';
const I={play:sv(`<path ${F} d="M7 4.5v15l13-7.5z"/>`),pause:sv(`<path ${F} d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>`),replay:sv('<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4.5h4.5"/>'),
vol:sv(`<path ${F} d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>`),mute:sv(`<path ${F} d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M17 9.5l5 5m0-5l-5 5"/>`),
full:sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),exit:sv('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
back:sv('<path d="M15 5l-7 7 7 7"/>'),l:sv('<path d="M15 5l-7 7 7 7"/>'),r:sv('<path d="M9 5l7 7-7 7"/>'),x:sv('<path d="M6 6l12 12M18 6L6 18"/>'),
star:sv(`<path ${F} d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>`),
bm:sv('<path d="M6 3h12v18l-6-4.5L6 21z"/>'),bmF:sv(`<path ${F} d="M6 3h12v18l-6-4.5L6 21z"/>`),
heart:sv(`<path d="${HP}"/>`),heartF:sv(`<path ${F} d="${HP}"/>`),dl:sv('<path d="M12 4v11m-5-5l5 5 5-5M5 20h14"/>'),
cam:sv('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/>'),ext:sv('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
warn:sv('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.5"/>')};
const $=(s,e=document)=>e.querySelector(s),IMG='https://image.tmdb.org/t/p/';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
let KEY=TMDB_READ_TOKEN,lists={list:store.get('list',[]),fav:store.get('fav',[]),recent:store.get('recent',[]),dl:store.get('dl',[])},cur={},S={rotate:store.get('rotate',true),theme:store.get('theme','light'),prog:store.get('prog',{})},acct=store.get('acct',null),session=store.get('sess',false);
let installPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
const applyTheme=()=>{document.documentElement.dataset.theme=S.theme==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):S.theme};applyTheme();
const mem=new Map();let pend=0,bt;
const bar=d=>{pend+=d;const b=$('#bar');if(!b)return;clearTimeout(bt);if(pend>0){b.classList.add('on');b.style.width='70%'}else{b.style.width='100%';bt=setTimeout(()=>{b.classList.remove('on');b.style.width='0'},250)}};
function jget(url,h,persist){
 if(mem.has(url))return mem.get(url);
 if(persist)try{const c=JSON.parse(localStorage.getItem('c:'+url));if(c&&Date.now()-c.t<18e5){const q=Promise.resolve(c.d);mem.set(url,q);return q}}catch{}
 bar(1);
 const q=fetch(url,{headers:h}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{if(persist)try{localStorage.setItem('c:'+url,JSON.stringify({t:Date.now(),d}))}catch{try{Object.keys(localStorage).filter(k=>k.startsWith('c:')).forEach(k=>localStorage.removeItem(k))}catch{}}return d}).catch(e=>{mem.delete(url);throw e}).finally(()=>bar(-1));
 mem.set(url,q);return q}
function api(p,q={}){const u=new URL('https://api.themoviedb.org/3'+p),h={};
 if(KEY.length>40)h.Authorization='Bearer '+KEY;else u.searchParams.set('api_key',KEY);
 for(const k in q)u.searchParams.set(k,q[k]);
 return jget(u.href,h,!/^\/movie\/\d/.test(p))}
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2400)};
let pendingWatch=null;
const requireSession=resume=>{if(session&&acct)return true;pendingWatch=resume||null;authSheet('in');toast('Log in to watch');return false};
const isTV=m=>m.media_type==='tv'||!!m.first_air_date||(!m.release_date&&!!m.name);
const titleOf=m=>m.title||m.name||m.original_title||m.original_name||'Untitled';
const dateOf=m=>m.release_date||m.first_air_date||'';
const yr=m=>dateOf(m).slice(0,4)||'—';
const card=m=>m.poster_path?`<a class="card" tabindex="0" role="button" data-id="${m.id}" data-kind="${isTV(m)?'tv':'movie'}"><i>${I.star}${(m.vote_average||0).toFixed(1)}</i><img loading="lazy" decoding="async" src="${IMG}w342${m.poster_path}" alt=""><div class="m"><b>${esc(titleOf(m))}</b><span>${yr(m)} · ${isTV(m)?'Series':'Movie'}</span></div></a>`:'';
const slim=m=>({id:m.id,title:titleOf(m),name:m.name,poster_path:m.poster_path,vote_average:m.vote_average,release_date:m.release_date,first_air_date:m.first_air_date,media_type:isTV(m)?'tv':'movie'});
const has=(k,id)=>lists[k].some(m=>m.id===id);
function toggle(k,m){const on=has(k,m.id);lists[k]=on?lists[k].filter(x=>x.id!==m.id):[slim(m),...lists[k]];store.set(k,lists[k]);
 toast((k==='list'?'My list':'Favorites')+(on?': removed':': added'));return !on}

/* ---------- routing ---------- */
const view=$('#view');
function route(){
 const [r,sub]=(location.hash||'#/home').slice(2).split('/');
 document.querySelectorAll('#tab a').forEach(a=>a.classList.toggle('on',a.dataset.r===r));
 clearInterval(cur.hero);scrollTo(0,0);
 ({home,search:browse,list:mylist,me,app}[r]||home)(sub)}
addEventListener('hashchange',route);
addEventListener('scroll',()=>$('#nav').classList.toggle('solid',scrollY>60),{passive:true});

/* ---------- home ---------- */
const ROWS=[['Trending this week','/trending/movie/week'],['Popular right now','/movie/popular'],['Top rated of all time','/movie/top_rated'],['In theaters','/movie/now_playing'],['Coming soon','/movie/upcoming']];
async function home(){
 view.innerHTML=`<section class="hero"><div class="bg"></div><div class="bg"></div><div class="shade"></div><div class="hc"></div><div class="dots"></div></section><div class="rows">${rowShell("Free full movies to stream","ia")}${recentRow()}${ROWS.map((r,i)=>`<section class="row"><h2>${r[0]}</h2><div class="rw"><button class="arr l" aria-label="Scroll left">${I.l}</button><div class="sc" id="r${i}">${'<div class="sk"></div>'.repeat(8)}</div><button class="arr r" aria-label="Scroll right">${I.r}</button></div></section>`).join('')}</div>`;
 loadIA();
 ROWS.forEach(async(r,i)=>{try{const d=await api(r[1]);
  if(!i)hero(d.results.filter(m=>m.backdrop_path).slice(0,6));
  $('#r'+i).innerHTML=d.results.map(card).join('')}catch{$('#r'+i).innerHTML='<p class="empty">Could not load this row. Check your API key and connection.</p>'}})}
function hero(ms){$('.hero').classList.add('ready');const bgs=[...view.querySelectorAll('.bg')],hc=$('.hc'),dots=$('.dots');let i=0,f=0;
 dots.innerHTML=ms.map((_,j)=>`<button aria-label="Show featured movie ${j+1}"></button>`).join('');
 const show=n=>{i=n;f^=1;const m=ms[n];bgs[f].style.backgroundImage=`url(${IMG}${innerWidth>900?'w1280':'w780'}${m.backdrop_path})`;
  bgs[f].classList.add('show');bgs[f^1].classList.remove('show');
  hc.classList.remove('in');void hc.offsetWidth;hc.classList.add('in');
  hc.innerHTML=`<div class="mt"><b class="rt">${I.star}${m.vote_average.toFixed(1)}</b> &nbsp;${yr(m)}</div><h1>${esc(m.title)}</h1><p>${esc(m.overview)}</p><div><button class="btn pri" data-play="${m.id}" data-t="${esc(m.title)}">${I.play} Play trailer</button><button class="btn" data-id="${m.id}">More info</button></div>`;
  [...dots.children].forEach((d,j)=>d.classList.toggle('on',j===n))};
 dots.onclick=e=>{const j=[...dots.children].indexOf(e.target);if(j>-1){show(j);restart()}};
 const restart=()=>{clearInterval(cur.hero);if(S.rotate)cur.hero=setInterval(()=>show((i+1)%ms.length),8000)};
 show(0);restart()}

/* ---------- free films (Internet Archive) ---------- */
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const rowShell=(t,id,inner)=>`<section class="row"><h2>${t}</h2><div class="rw"><button class="arr l" aria-label="Scroll left">${I.l}</button><div class="sc" id="${id}">${inner??'<div class="sk"></div>'.repeat(8)}</div><button class="arr r" aria-label="Scroll right">${I.r}</button></div></section>`;
const rc=r=>r.ia?iaCard(r):card(r);
const recentRow=()=>lists.recent.length?rowShell('Continue watching','cw',lists.recent.slice(0,12).map(rc).join('')):'';
const iaCard=x=>{const id=esc(x.identifier||x.id);return `<a class="card" tabindex="0" role="button" data-ia="${id}" data-t="${esc(x.title)}"><i class="f">FREE</i><img loading="lazy" src="https://archive.org/services/img/${id}" alt=""><div class="m"><b>${esc(x.title)}</b><span>${esc(x.year||'Classic')}</span></div></a>`};
async function iaList(q,n){return(await jget('https://archive.org/advancedsearch.php?q='+encodeURIComponent(q)+'&fl[]=identifier&fl[]=title&fl[]=year&sort[]=downloads+desc&rows='+n+'&output=json',undefined,true)).response.docs}
async function loadIA(){try{const d=await iaList('collection:feature_films AND mediatype:movies',24);$('#ia').innerHTML=d.map(iaCard).join('')}catch{const e=$('#ia');if(e)e.innerHTML='<p class="empty">Free films could not load right now.</p>'}}
async function findFilm(m){const t=norm(m.title),y=+yr(m);
 const d=await iaList(`title:("${m.title.replace(/"/g,'')}") AND mediatype:movies AND (collection:feature_films OR collection:moviesandfilms)`,8);
 const h=d.find(x=>norm(x.title)===t&&Math.abs(+x.year-y)<=1);return h&&h.identifier}
async function filmSrc(id){const d=await jget('https://archive.org/metadata/'+id);
 const rank=x=>/\.mp4$/i.test(x.name)?0:/\.(m4v|webm)$/i.test(x.name)?1:2;
 const f=(d.files||[]).filter(x=>/\.(mp4|m4v|webm|ogv)$/i.test(x.name)&&!/thumb|sample|trailer/i.test(x.name)).sort((a,b)=>rank(a)-rank(b)||(+a.size||0)-(+b.size||0));
 const best=f.filter(x=>rank(x)===0),pick=best.filter(x=>+x.size<3e8).pop()||best[0]||f[0];
 return pick&&`https://archive.org/download/${id}/`+pick.name.split('/').map(encodeURIComponent).join('/')}
async function download(id,title){
 toast('Preparing download…');let u;try{u=await filmSrc(id)}catch{}
 if(!u)return toast('No downloadable file found');
 lists.dl=[{id,title,url:u,at:Date.now()},...lists.dl.filter(x=>x.id!==id)];store.set('dl',lists.dl);
 const a=document.createElement('a');a.href=u;a.download=(String(title||'Reelhouse-video').replace(/[^a-z0-9._-]+/gi,'_').slice(0,80)||'Reelhouse-video')+'.mp4';a.rel='noopener';a.target='_blank';document.body.appendChild(a);a.click();a.remove();
 toast('Download started. If your browser opens the video instead, use its download control.');
}

/* ---------- search ---------- */
const B={type:'all',g:'',sort:'popularity.desc',q:'',page:1,genres:null,tvGenres:null,filterOpen:false,suggest:[]};
const SEARCH_TYPES=[['all','Everything'],['movie','Movies'],['tv','Series'],['anime','Anime']];
const animeParams={with_genres:'16',with_origin_country:'JP'};
const searchItem=(m)=>`<button class="suggest" data-id="${m.id}" data-kind="${isTV(m)?'tv':'movie'}"><img src="${m.poster_path?IMG+'w92'+m.poster_path:''}" alt=""><span><b>${esc(titleOf(m))}</b><small>${esc(isTV(m)?'Series':'Movie')} · ${esc(yr(m))}</small></span><em>${I.r}</em></button>`;
function genreList(){return B.type==='tv'||B.type==='anime'?(B.tvGenres||[]):(B.genres||[])}
function renderSearchFilters(){
 const ch=$('#searchGenres'),types=$('#searchTypes'),sort=$('#sort');
 if(types)types.innerHTML=SEARCH_TYPES.map(([v,l])=>`<button class="chip ${B.type===v?'on':''}" data-type="${v}">${l}</button>`).join('');
 if(ch)ch.innerHTML=[{id:'',name:'All genres'},...genreList()].map(g=>`<button class="chip ${String(g.id)===B.g?'on':''}" data-g="${g.id}">${esc(g.name)}</button>`).join('');
 if(sort)sort.value=B.sort;
}
async function loadSearchMeta(){
 if(!B.genres||!B.tvGenres){try{const [mg,tg]=await Promise.all([api('/genre/movie/list'),api('/genre/tv/list')]);B.genres=mg.genres||[];B.tvGenres=tg.genres||[]}catch{B.genres=[];B.tvGenres=[]}}
 renderSearchFilters();
}
async function suggestions(q){
 if(q.length<2){B.suggest=[];renderSuggestions();return}
 try{
  let d;
  if(B.type==='movie')d=await api('/search/movie',{query:q,page:1,include_adult:false});
  else if(B.type==='tv'||B.type==='anime')d=await api('/search/tv',{query:q,page:1,include_adult:false});
  else d=await api('/search/multi',{query:q,page:1,include_adult:false});
  let r=(d.results||[]).filter(m=>m.media_type!=='person'&&m.poster_path);
  if(B.type==='anime')r=r.filter(m=>isTV(m)&&(m.genre_ids||[]).includes(16)&&(m.origin_country||[]).includes('JP'));
  B.suggest=r.slice(0,7);
 }catch{B.suggest=[]}
 renderSuggestions();
}
function renderSuggestions(){
 const box=$('#suggestions');if(!box)return;
 box.innerHTML=B.suggest.length?B.suggest.map(searchItem).join(''):'';
 box.classList.toggle('on',B.q.length>=2&&B.suggest.length>0);
}
function searchQuery(){
 const sort=B.type==='tv'||B.type==='anime'?(B.sort==='primary_release_date.desc'?'first_air_date.desc':B.sort==='revenue.desc'?'popularity.desc':B.sort):B.sort;
 const p={page:B.page,include_adult:false,sort_by:sort};
 if(B.g)p.with_genres=B.g;
 if(B.type==='anime')Object.assign(p,animeParams);
 if(B.sort!=='popularity.desc')p.vote_count_gte=300;
 return p;
}
async function fill(reset){
 const gr=$('#gr');if(!gr)return;
 if(reset)gr.innerHTML='<div class="sk"></div>'.repeat(15);
 try{
  let d;
  if(B.q){
   if(B.type==='movie')d=await api('/search/movie',{query:B.q,page:B.page,include_adult:false});
   else if(B.type==='tv'||B.type==='anime')d=await api('/search/tv',{query:B.q,page:B.page,include_adult:false});
   else d=await api('/search/multi',{query:B.q,page:B.page,include_adult:false});
   d.results=(d.results||[]).filter(m=>m.media_type!=='person'&&m.poster_path);
   if(B.type==='anime')d.results=d.results.filter(m=>isTV(m)&&(m.genre_ids||[]).includes(16)&&(m.origin_country||[]).includes('JP'));
  }else if(B.type==='all'){
   const [movies,tv]=await Promise.all([
    api('/discover/movie',searchQuery()),
    api('/discover/tv',searchQuery())
   ]);
   d={total_pages:Math.max(movies.total_pages||0,tv.total_pages||0),results:[...(movies.results||[]).map(m=>({...m,media_type:'movie'})),...(tv.results||[]).map(m=>({...m,media_type:'tv'}))]};
   d.results.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  }else{
   const endpoint=B.type==='movie'?'/discover/movie':'/discover/tv';
   d=await api(endpoint,searchQuery());
   d.results=(d.results||[]).filter(m=>m.poster_path);
  }
  const h=(d.results||[]).map(card).join('');
  if(reset)gr.innerHTML=h||'<p class="empty">Nothing found. Try another search or filter.</p>';else gr.insertAdjacentHTML('beforeend',h);
  const more=$('#more');if(more)more.style.display=B.page<(d.total_pages||0)&&d.results?.length?'':'none';
 }catch{gr.innerHTML='<p class="empty">Could not load results. Check your connection.</p>'}
}
async function browse(){
 view.innerHTML=`<div class="pg search-page"><h1>Search</h1>
 <div class="search-line"><button class="filter-toggle" id="filterToggle" aria-expanded="false">${I.x}<span>Filters</span></button>
 <div class="search-wrap"><input id="sq" class="sbar" type="search" placeholder="Search movies, series or anime" value="${esc(B.q)}" aria-label="Search movies, series or anime" autocomplete="off"><div id="suggestions" class="suggestions"></div></div></div>
 <div class="search-pop" id="searchPop"><div class="filter-head"><b>Browse</b><button class="chip" id="closeFilters">Done</button></div>
 <div class="filter-group"><small>Type</small><div class="chips" id="searchTypes"></div></div>
 <div class="filter-group"><small>Genre</small><div class="chips" id="searchGenres"></div></div>
 <div class="filter-group"><small>Sort</small><select id="sort" aria-label="Sort"><option value="popularity.desc">Most popular</option><option value="vote_average.desc">Highest rated</option><option value="primary_release_date.desc">Newest</option><option value="revenue.desc">Box office</option></select></div></div>
 <div class="search-meta"><span id="searchStatus">Everything</span><span>Suggestions appear as you type</span></div>
 <div class="grid search-grid" id="gr"></div><button class="btn more" id="more">Load more</button></div>`;
 $('#filterToggle').onclick=()=>{B.filterOpen=!B.filterOpen;$('#searchPop').classList.toggle('on',B.filterOpen);$('#filterToggle').classList.toggle('on',B.filterOpen);$('#filterToggle').setAttribute('aria-expanded',B.filterOpen)};
 $('#closeFilters').onclick=()=>{B.filterOpen=false;$('#searchPop').classList.remove('on');$('#filterToggle').classList.remove('on')};
 $('#sort').onchange=e=>{B.sort=e.target.value;B.page=1;fill(true)};
 $('#more').onclick=()=>{B.page++;fill(false)};
 let qt;$('#sq').oninput=e=>{clearTimeout(qt);B.q=e.target.value.trim();B.page=1;renderSuggestions();qt=setTimeout(async()=>{await suggestions(B.q);fill(true)},180)};
 $('#sq').onfocus=()=>renderSuggestions();
 $('#searchTypes').onclick=e=>{const type=e.target.closest('[data-type]')?.dataset.type;if(!type)return;B.type=type;B.g='';B.page=1;B.q='';$('#sq').value='';B.suggest=[];renderSearchFilters();const st=$('#searchStatus');if(st)st.textContent=SEARCH_TYPES.find(x=>x[0]===B.type)?.[1]||'Everything';fill(true)};
 $('#searchGenres').onclick=e=>{const g=e.target.closest('[data-g]')?.dataset.g;if(g===undefined)return;B.g=g;B.page=1;fill(true);renderSearchFilters()};
 B.page=1;renderSearchFilters();$('#sort').value=B.sort;fill(true);loadSearchMeta();
 const st=$('#searchStatus');if(st)st.textContent=SEARCH_TYPES.find(x=>x[0]===B.type)?.[1]||'Everything';
}
/* ---------- library ---------- */
let tab='list';
function mylist(){const L=lists[tab];
 view.innerHTML=`<div class="pg"><h1>Library</h1><div class="chips"><button class="chip ${tab==='list'?'on':''}" data-tab="list">Saved (${lists.list.length})</button><button class="chip ${tab==='fav'?'on':''}" data-tab="fav">Favorites (${lists.fav.length})</button></div><div class="grid">${L.map(card).join('')}</div>${L.length?'':`<p class="empty">Nothing here yet. Open any movie and tap ${tab==='list'?'“Save to list”':'“Favorite”'} to keep it.</p>`}</div>`}

/* ---------- app install ---------- */
const APK_URL=['https:','github.com','kryonara-NG','Realhouse','releases','latest','download','Reelhouse.apk'].join('/');
function app(){
 view.innerHTML=`<div class="pg"><div class="hi"><h1>Download Reelhouse</h1><p>Get the Android app for the full Reelhouse experience. The button always points to the latest APK release.</p><a class="btn pri" href="${APK_URL}" download>Download Android APK</a><button class="btn" data-act="install">${installPrompt?'Install Reelhouse':'Add to home screen'}</button></div><div class="li"><div><b>Android app updates</b><small class="mt" style="display:block">New releases replace the APK at the same download address.</small></div></div><p class="mt" style="margin-top:16px">If you only want the web app, use “Add to home screen” instead.</p></div>`;
}
/* ---------- me, accounts, settings ---------- */
const ic=p=>`<svg class="ico" viewBox="0 0 24 24">${p}</svg>`;
const ICO={recent:ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),dl:ic('<path d="M12 4v11m-5-5l5 5 5-5M5 20h14"/>'),set:ic('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>')};
const back=`<a class="chip" href="#/me">${I.l} Me</a>`;
function me(sub){const on=session&&acct;
 if(sub==='recent'){const L=lists.recent;return view.innerHTML=`<div class="pg">${back}<h1 style="margin-top:14px">Recently watched</h1><div class="grid">${L.map(rc).join('')}</div>${L.length?'':'<p class="empty">Trailers and films you play show up here.</p>'}</div>`}
 if(sub==='downloads'){const L=lists.dl;return view.innerHTML=`<div class="pg">${back}<h1 style="margin-top:14px">Downloads</h1><p class="mt" style="margin-bottom:16px">Free films use the browser download flow. If your browser opens the media instead, use its built-in download control.</p>${L.map(x=>`<div class="li"><div><b>${esc(x.title)}</b><small class="mt" style="display:block">${new Date(x.at).toLocaleDateString()}</small></div><span style="flex:1"></span><a class="chip" href="${esc(x.url)}" target="_blank" rel="noopener">Open file</a><button class="chip" data-act="rmdl" data-id="${esc(x.id)}">Remove</button></div>`).join('')}${L.length?'':'<p class="empty">No downloads yet. Free full movies have a Download button on their details page.</p>'}</div>`}
 if(sub==='settings')return view.innerHTML=`<div class="pg">${back}<h1 style="margin-top:14px">Settings</h1><h3 class="sh">Appearance</h3><div class="seg">${['light','dark','system'].map(v=>`<button class="${S.theme===v?'on':''}" data-act="theme" data-v="${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><h3 class="sh">Playback</h3><label class="li"><span>Rotate featured movies on Home</span><span style="flex:1"></span><input type="checkbox" data-act="rotate" ${S.rotate?'checked':''}></label><h3 class="sh">Data</h3><button class="mi" data-act="clear">Clear watch history</button><p class="mt" style="font-size:13px;margin-top:14px">Movie info by TMDB. Free films and downloads come from the Internet Archive public-domain library. Accounts and lists are stored only in this browser.</p></div>`;
 const head=on?`<div class="prof"><div class="avw"><div class="av">${acct.avatar?`<img src="${acct.avatar}" alt="">`:esc(acct.name[0].toUpperCase())}</div><label class="cam" title="Change photo">${I.cam}<input type="file" id="av" accept="image/*" hidden></label></div><div><h1 style="font-size:28px;margin:0">${esc(acct.name)}</h1><div class="mt">${esc(acct.email)}</div><button class="chip" data-act="name" style="margin-top:8px">Edit name</button></div></div>`
 :`<div class="hi"><h1>Your seat is waiting</h1><p>Create a free account to keep your list and favorites, pick films up where you left off, and make the profile yours.</p><div><button class="btn" data-act="up">Sign up</button><button class="btn" data-act="in">Log in</button></div></div>`;
 view.innerHTML=`<div class="pg">${head}<div class="st"><div><b>${lists.list.length}</b>Saved</div><div><b>${lists.fav.length}</b>Favorites</div><div><b>${lists.recent.length}</b>Watched</div></div>
 <a class="mi" href="#/me/recent">${ICO.recent}<span>Recently watched<small>Pick up where you stopped</small></span><em>${I.r}</em></a>
 <a class="mi" href="#/me/settings">${ICO.set}<span>Settings<small>Theme and playback</small></span><em>${I.r}</em></a>
 <a class="mi" href="#/app">${ICO.dl}<span>Download App<small>Get the latest Reelhouse Android app</small></span><em>${I.r}</em></a>
 ${on?'<button class="mi" data-act="out"><span>Log out</span></button>':''}</div>`}
const sha=async s=>{try{return[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('')}catch{return btoa(s)}};
function sheet(h){const e=$('#sheet');e.innerHTML=`<div class="dt sbox"><button class="x" data-act="sc" aria-label="Close">${I.x}</button>${h}</div>`;e.classList.add('on')}
function authSheet(m){const up=m==='up';sheet(`<h1>${up?'Create account':'Welcome back'}</h1><p>${up?'Your account is stored on this device only.':'Log in to your profile on this device.'}</p>${up?'<input id="an" placeholder="Your name" autocomplete="name">':''}<input id="ae" type="email" placeholder="Email" autocomplete="email"><input id="ap" type="password" placeholder="Password (6+ characters)" autocomplete="${up?'new-password':'current-password'}"><div id="aerr"></div><button class="btn pri" data-act="go" data-mode="${m}">${up?'Sign up':'Log in'}</button> <button class="chip" data-act="${up?'in':'up'}">${up?'Have an account? Log in':'New here? Sign up'}</button>`)}
async function authGo(m){const e=$('#ae').value.trim().toLowerCase(),p=$('#ap').value,n=$('#an')?$('#an').value.trim():'',er=$('#aerr');
 if(!/^\S+@\S+\.\S+$/.test(e))return er.textContent='Enter a valid email address.';
 if(p.length<6)return er.textContent='Use a password with at least 6 characters.';
 const h=await sha(p);
 if(m==='up'){if(!n)return er.textContent='Enter your name.';if(acct&&acct.email!==e)return er.textContent='An account already exists on this device. Log in instead.';acct={name:n,email:e,hash:h,avatar:(acct&&acct.avatar)||''}}
 else if(!acct||acct.email!==e||acct.hash!==h)return er.textContent=acct?'Email or password is incorrect.':'No account on this device yet. Sign up first.';
 store.set('acct',acct);session=true;store.set('sess',true);act('sc');toast('Welcome, '+acct.name);const resume=pendingWatch;pendingWatch=null;if(resume)return resume();me()}
function act(n,el){switch(n){
 case'install':return (async()=>{if(!installPrompt)return toast('Use your browser menu to choose “Install app” or “Add to Home screen”.');installPrompt.prompt();try{await installPrompt.userChoice}catch{}installPrompt=null;return app()})();
 case'in':case'up':return authSheet(n);
 case'sc':return $('#sheet').classList.remove('on');
 case'go':return authGo(el.dataset.mode);
 case'out':session=false;store.set('sess',false);toast('Logged out');return me();
 case'name':return sheet(`<h1 style="font-size:30px">Edit name</h1><input id="nn" value="${esc(acct.name)}"><button class="btn pri" data-act="savename">Save</button>`);
 case'savename':acct.name=$('#nn').value.trim()||acct.name;store.set('acct',acct);act('sc');return me();
 case'theme':S.theme=el.dataset.v;store.set('theme',S.theme);applyTheme();return me('settings');
 case'rotate':S.rotate=el.checked;store.set('rotate',S.rotate);return;
 case'clear':lists.recent=[];S.prog={};store.set('recent',[]);toast('History cleared');return me('settings');
 case'rmdl':lists.dl=lists.dl.filter(x=>x.id!==el.dataset.id);store.set('dl',lists.dl);return me('downloads')}}
function setAvatar(f){if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),z=Math.min(im.width,im.height);c.width=c.height=200;c.getContext('2d').drawImage(im,(im.width-z)/2,(im.height-z)/2,z,z,0,0,200,200);acct.avatar=c.toDataURL('image/jpeg',.85);store.set('acct',acct);toast('Photo updated');me()};im.src=r.result};r.readAsDataURL(f)}
document.addEventListener('change',e=>{if(e.target.id==='av')setAvatar(e.target.files[0])});

/* ---------- watch page: small player on top, details underneath ---------- */
let yp,ytP,tick,idle,drag=false,pm=null;
const topbar=`<div class="top"><button class="ib" data-close aria-label="Back">${I.back}</button></div>`;
const ctl=`<div class="spin" id="spin"><i></i></div><div class="perr" id="perr"></div><div class="shield" id="sh"></div>${topbar}<div class="ctl"><input type="range" id="seek" min="0" max="1000" value="0" aria-label="Seek"><div class="cr"><button class="ib" id="pp" aria-label="Play or pause">${I.pause}</button><button class="ib" id="mu" aria-label="Mute">${I.vol}</button><input type="range" id="vol" min="0" max="100" value="80" style="--p:80%" aria-label="Volume"><span class="tm" id="tm">0:00 / 0:00</span><span style="flex:1"></span><button class="btn" id="spd">1×</button><button class="ib" id="fs" aria-label="Fullscreen">${I.full}</button></div></div>`;
const skelPage=()=>`<div class="wpg"><div class="wp"><div class="poster sk0"></div>${topbar}</div><div class="wi"><div class="ln" style="width:65%;height:26px"></div><div class="ln" style="width:40%"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:80%"></div></div></div>`;
const loadYT=()=>ytP||(ytP=new Promise((res,rej)=>{if(window.YT&&YT.Player)return res();window.onYouTubeIframeAPIReady=res;const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=()=>{ytP=null;rej()};document.head.append(s);setTimeout(()=>{if(!(window.YT&&YT.Player)){ytP=null;rej()}},9000)}));
const fmt=s=>{s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function remember(m){const x=m.ia?m:slim(m);lists.recent=[{...x,at:Date.now()},...lists.recent.filter(r=>r.id!==x.id)].slice(0,40);store.set('recent',lists.recent)}
function saveProg(){if(pm&&yp){try{const t=yp.getCurrentTime(),d=yp.getDuration();S.prog[pm.id]=d&&t/d>.95?0:t;store.set('prog',S.prog)}catch{}}pm=null}
const vAdapter=v=>({getPlayerState:()=>v.ended?0:v.paused?2:1,pauseVideo:()=>v.pause(),playVideo:()=>{v.play().catch(()=>{})},seekTo:t=>{const e=v.ended;v.currentTime=t;if(e)v.play().catch(()=>{})},getCurrentTime:()=>v.currentTime,getDuration:()=>v.duration||0,isMuted:()=>v.muted,mute:()=>{v.muted=true},unMute:()=>{v.muted=false},setVolume:x=>{v.volume=x/100},getPlaybackRate:()=>v.playbackRate,setPlaybackRate:r=>{v.playbackRate=r},destroy:()=>{v.pause();v.removeAttribute('src');v.load()}});
function killPlayer(){saveProg();clearInterval(tick);try{yp&&yp.destroy()}catch{}yp=null;try{cur.vidsrcCleanup&&cur.vidsrcCleanup()}catch{}cur.vidsrcCleanup=null}
function closeDetail(){killPlayer();cur.tok=(cur.tok||0)+1;const b=$('#modal');b.classList.remove('on');b.innerHTML='';document.body.style.overflow=''}
const setPP=s=>{const b=$('#pp');if(b)b.innerHTML=s===1?I.pause:s===0?I.replay:I.play};
const spin=on=>{const e=$('#spin');if(e)e.classList.toggle('on',!!on)};
const setSrc=k=>{cur.mode=k;document.querySelectorAll('#src [data-src]').forEach(b=>b.classList.toggle('on',b.dataset.src===k))};
function wake(){const w=$('#wp');if(!w)return;w.classList.remove('idle');clearTimeout(idle);idle=setTimeout(()=>{if(yp&&yp.getPlayerState&&yp.getPlayerState()===1)w.classList.add('idle')},2600)}
function toggleP(){if(!yp||!yp.getPlayerState)return;const s=yp.getPlayerState();s===1?yp.pauseVideo():(s===0?yp.seekTo(0):yp.playVideo())}
function mount(inner){const w=$('#wp');w.innerHTML=inner+ctl;w.classList.remove('idle');wake();spin(1);clearInterval(tick);
 tick=setInterval(()=>{if(!yp||!yp.getDuration)return;const d=yp.getDuration(),t=yp.getCurrentTime();if(!drag){const s=$('#seek');if(s){s.value=d?t/d*1000:0;s.style.setProperty('--p',(d?t/d*100:0)+'%')}}const m=$('#tm');if(m)m.textContent=fmt(t)+' / '+fmt(d)},250)}
function showErr(msg,key){spin(0);const e=$('#perr');if(!e)return;e.innerHTML=`${I.warn}<div>${msg}</div><div><button class="btn" data-retry>Retry</button>${key?` <a class="btn" href="https://www.youtube.com/watch?v=${key}" target="_blank" rel="noopener">${I.ext} Open on YouTube</a>`:''}</div>`;e.classList.add('on')}
async function startTrailer(){if(!requireSession(()=>startTrailer()))return;const k=cur.tr;if(!k)return toast('No trailer available for this movie');
 killPlayer();pm=null;cur.rt=startTrailer;setSrc('tr');mount('<div id="yt"></div><div class="watch-under"><button class="btn pri" data-watch-movie>Watch Movie</button></div>');remember(cur.m);
 try{await loadYT()}catch{return showErr('YouTube could not load. Check your connection.',k)}
 if(!$('#yt'))return;
 const v={controls:0,disablekb:1,modestbranding:1,rel:0,playsinline:1,iv_load_policy:3,autoplay:1};if(/^https?:/.test(location.protocol))v.origin=location.origin;
 const msg=location.protocol==='file:'?'YouTube blocks trailers when this page is opened as a file. Host it (GitHub Pages or Netlify) or run a local server.':'This trailer cannot be played here.';
 yp=new YT.Player('yt',{videoId:k,playerVars:v,events:{onReady:e=>{e.target.setVolume(80);e.target.playVideo()},onStateChange:e=>{setPP(e.data);spin(e.data===3)},onError:()=>showErr(msg,k)}})}
function mountVidSrc(source,title){
 const w=$('#wp');if(!w)return;
 const u=source?.url;if(!u)return;
 w.innerHTML=`<iframe id="vidsrc-frame" title="${esc(title||'Reelhouse player')}" src="${esc(u)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen frameborder="0" referrerpolicy="origin"></iframe>${topbar}`;
 const onMessage=e=>{
   const frame=$('#vidsrc-frame');if(!frame||e.source!==frame.contentWindow)return;
   const d=e.data;
   if(!d||d.type!=='PLAYER_EVENT'||!d.data)return;
   const info=d.data.player_info||{};
   const id=info.tmdb||info.imdb||cur.m?.id;
   const progress=Number(d.data.player_progress);
   if(id&&Number.isFinite(progress)){S.prog[id]=progress;store.set('prog',S.prog)}
   if(d.data.player_status==='completed'&&id){S.prog[id]=0;store.set('prog',S.prog)}
 };
 window.addEventListener('message',onMessage);
 cur.vidsrcCleanup=()=>window.removeEventListener('message',onMessage);
 const frame=$('#vidsrc-frame');
 if(frame)frame.addEventListener('load',()=>spin(0),{once:true});
 remember(cur.m);
}
async function startFilm(source,title){
 if(!requireSession(()=>startFilm(source,title)))return;
 killPlayer();cur.rt=()=>startFilm(source,title);setSrc('film');
 if(source?.type==='vidsrc'||source?.type==='iframe'){mountVidSrc(source,title);return}
 mount('');
 let u=typeof source==='string'?null:source?.url;
 if(!u&&typeof source==='string'){try{u=await filmSrc(source)}catch{}}
 if(!$('#wp'))return;
 if(!u)return showErr('This title is marked Coming to Reelhouse soon because no playable direct file is available.');
 $('#wp').insertAdjacentHTML('afterbegin',`<video id="vd" playsinline autoplay preload="metadata" src="${esc(u)}"></video>`);
 const v=$('#vd');yp=vAdapter(v);pm={id:cur.m?.id||source?.id||source};v.volume=.8;const t=S.prog[pm.id];
 if(t)v.addEventListener('loadedmetadata',()=>{v.currentTime=t},{once:true});
 v.addEventListener('waiting',()=>spin(1));v.addEventListener('playing',()=>{spin(0);setPP(1)});v.addEventListener('canplay',()=>spin(0));
 v.addEventListener('pause',()=>setPP(2));v.addEventListener('ended',()=>setPP(0));
 v.addEventListener('error',()=>showErr('Playback failed. This file may not play in your browser.'));
 remember(cur.m)
}
async function filmBtns(m,startAfterResolve=false){
 if(cur.m!==m||!$('#src'))return;
 $('#src').insertAdjacentHTML('beforeend','<span class="mt nf" id="sourceStatus">Checking direct playback…</span>');
 let source;try{source=await resolveMovieSource(m)}catch{source={status:'coming-soon'}}
 if(cur.m!==m||!$('#src'))return;
 const st=$('#sourceStatus');
 if(source.status!=='ready'){
   if(st){st.className='source-state coming';st.textContent='Coming to Reelhouse soon'}
   return;
 }
 cur.source=source;cur.film=source.identifier||null;
 if(st)st.remove();
 $('#src').insertAdjacentHTML('afterbegin','<button class="chip" data-src="film">Full movie</button>');
 const d=$('#dlb');
 if(d&&source.identifier){d.hidden=false;d.dataset.dl=source.identifier;d.dataset.t=m.title}
 const p=$('.poster');if(p&&!p.querySelector('.big'))p.insertAdjacentHTML('beforeend',`<button class="big" data-startp aria-label="Play">${I.play}</button>`);
 if(startAfterResolve)startFilm(source,titleOf(m));
}
async function openSeriesDetail(id,auto){
 killPlayer();const tok=cur.tok=(cur.tok||0)+1,box=$('#modal');box.classList.add('on');document.body.style.overflow='hidden';box.scrollTop=0;box.innerHTML=skelPage();
 cur.mode='none';cur.film=null;cur.tr=null;cur.rt=()=>openSeriesDetail(id,auto);
 let m;try{m=await api('/tv/'+id,{append_to_response:'credits,similar,videos'})}catch{}
 if(cur.tok!==tok)return;
 if(!m){box.innerHTML=`<div class="wpg"><div class="wp">${topbar}</div><div class="wi"><p class="mt" style="margin-bottom:12px">Could not load this series. Check your connection.</p><button class="btn" data-retry>Retry</button></div></div>`;return}
 const vs=(m.videos?.results||[]).filter(x=>x.site==='YouTube'),tr=vs.find(x=>x.type==='Trailer'&&x.official)||vs.find(x=>x.type==='Trailer')||vs[0];
 cur.m=m;cur.tr=tr&&tr.key;cur.kind='tv';cur.seriesId=id;cur.season=m.seasons?.find(s=>s.season_number>0)?.season_number??0;
 const cast=(m.credits?.cast||[]).slice(0,14).map(c=>`<div class="cm">${c.profile_path?`<img loading="lazy" src="${IMG}w185${c.profile_path}" alt="">`:`<div>${esc((c.name||'?')[0])}</div>`}<b>${esc(c.name)}</b><small>${esc(c.character||'')}</small></div>`).join('');
 const bg=m.backdrop_path?IMG+'w780'+m.backdrop_path:m.poster_path?IMG+'w500'+m.poster_path:'';
 const isS=has('list',m.id),isF=has('fav',m.id);
 box.innerHTML=`<div class="wpg series-page"><div class="wp" id="wp"><div class="poster" style="background-image:url(${bg})">${cur.tr?`<button class="big" data-startp aria-label="Play trailer">${I.play}</button>`:''}</div>${topbar}</div>
 <div class="wi"><div class="series-kicker">SERIES</div><h1>${esc(titleOf(m))}</h1>${m.tagline?`<div class="tg">${esc(m.tagline)}</div>`:''}
 <div class="wm"><span class="rt">${I.star}${(m.vote_average||0).toFixed(1)}</span><span>${yr(m)}</span><span>${m.number_of_seasons||0} seasons</span><span>${m.number_of_episodes||0} episodes</span></div>
 <div class="gs">${(m.genres||[]).map(g=>`<span>${esc(g.name)}</span>`).join('')}</div>
 <div class="src" id="src">${cur.tr?'<button class="chip" data-src="tr">Trailer</button>':'<span class="mt nf">No trailer available</span>'}</div>
 <div class="acts"><button class="act ${isS?'on':''}" data-tg="list">${isS?I.bmF:I.bm}<span>${isS?'Saved':'Save'}</span></button><button class="act ${isF?'on':''}" data-tg="fav">${isF?I.heartF:I.heart}<span>${isF?'Favorited':'Favorite'}</span></button></div>
 <p class="ovw" id="ovw">${esc(m.overview)||'No overview available.'}</p>
 <div class="season-bar"><label for="seasonSelect">Season</label><select id="seasonSelect">${(m.seasons||[]).filter(s=>s.season_number>=0).map(s=>`<option value="${s.season_number}" ${s.season_number===cur.season?'selected':''}>Season ${s.season_number}${s.episode_count?` · ${s.episode_count} episodes`:''}</option>`).join('')}</select></div>
 <div id="episodes"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div>
 ${cast?`<h3>Cast</h3><div class="cast">${cast}</div>`:''}</div></div>`;
 $('#seasonSelect').onchange=e=>loadSeason(id,+e.target.value);loadSeason(id,cur.season);if(auto==='trailer')startTrailer();
}
async function loadSeason(seriesId,season){
 const wrap=$('#episodes');if(!wrap)return;cur.season=season;wrap.innerHTML='<div class="ln"></div><div class="ln"></div><div class="ln"></div>';
 try{const d=await api('/tv/'+seriesId+'/season/'+season);if(!$('#episodes'))return;const eps=d.episodes||[];
  wrap.innerHTML=`<div class="episode-head"><h3>Episodes</h3><span>${eps.length} episodes</span></div><div class="episodes">${eps.map(e=>`<button class="episode" data-episode="${e.episode_number}" data-series="${seriesId}" data-season="${season}"><span class="ep-img">${e.still_path?`<img loading="lazy" src="${IMG}w300${e.still_path}" alt="">`:'<span></span>'}<b>${e.episode_number}</b></span><span class="ep-copy"><strong>${esc(e.name||'Episode '+e.episode_number)}</strong><small>${e.runtime?e.runtime+' min · ':''}${esc(e.air_date||'')}</small><em>${esc(e.overview||'')}</em></span><i>${I.play}</i></button>`).join('')}</div>`;
 }catch{wrap.innerHTML='<p class="empty">Episodes could not load right now.</p>'}
}
async function playEpisode(seriesId,season,episode){
 if(!requireSession(()=>playEpisode(seriesId,season,episode)))return;
 const title=titleOf(cur.m)+' · S'+String(season).padStart(2,'0')+'E'+String(episode).padStart(2,'0');
 const ep={id:seriesId,media_type:'tv',name:title};
 let source;try{source=await resolveEpisodeSource(ep,season,episode)}catch{source={status:'coming-soon'}}
 const btn=document.querySelector(`[data-episode="${episode}"][data-series="${seriesId}"][data-season="${season}"]`);
 if(source.status!=='ready'){
   if(btn){btn.classList.add('coming');const copy=btn.querySelector('.ep-copy');if(copy&&!copy.querySelector('.source-state'))copy.insertAdjacentHTML('beforeend','<em class="source-state coming">Coming to Reelhouse soon</em>')}
   toast('Coming to Reelhouse soon');
   return;
 }
 cur.source=source;cur.m=cur.m||ep;startFilm(source,title);
}
async function openDetail(id,auto,kind='movie'){if(kind==='tv')return openSeriesDetail(id,auto);killPlayer();const tok=cur.tok=(cur.tok||0)+1,box=$('#modal');
 box.classList.add('on');document.body.style.overflow='hidden';box.scrollTop=0;box.innerHTML=skelPage();cur.mode='none';cur.film=null;cur.tr=null;cur.rt=()=>openDetail(id,auto);
 let m;try{m=await api('/movie/'+id,{append_to_response:'credits,similar,videos'})}catch{}
 if(cur.tok!==tok)return;
 if(!m){box.innerHTML=`<div class="wpg"><div class="wp">${topbar}</div><div class="wi"><p class="mt" style="margin-bottom:12px">Could not load this movie. Check your connection.</p><button class="btn" data-retry>Retry</button></div></div>`;return}
 const vs=m.videos.results.filter(x=>x.site==='YouTube'),tr=vs.find(x=>x.type==='Trailer'&&x.official)||vs.find(x=>x.type==='Trailer')||vs[0];
 cur.m=m;cur.tr=tr&&tr.key;
 const cast=m.credits.cast.slice(0,14).map(c=>`<div class="cm">${c.profile_path?`<img loading="lazy" src="${IMG}w185${c.profile_path}" alt="">`:`<div>${esc(c.name[0])}</div>`}<b>${esc(c.name)}</b><small>${esc(c.character)}</small></div>`).join('');
 const dir=m.credits.crew.find(c=>c.job==='Director'),bg=m.backdrop_path?IMG+'w780'+m.backdrop_path:m.poster_path?IMG+'w500'+m.poster_path:'';
 const isS=has('list',m.id),isF=has('fav',m.id),rel=m.similar.results.filter(x=>x.poster_path);
 box.innerHTML=`<div class="wpg"><div class="wp" id="wp"><div class="poster" style="background-image:url(${bg})">${cur.tr?`<button class="big" data-startp aria-label="Play">${I.play}</button>`:''}</div>${topbar}</div>
 <div class="wi"><h1>${esc(m.title)}</h1>${m.tagline?`<div class="tg">${esc(m.tagline)}</div>`:''}
 <div class="wm"><span class="rt">${I.star}${m.vote_average.toFixed(1)}</span><span>${yr(m)}</span>${m.runtime?`<span>${Math.floor(m.runtime/60)}h ${m.runtime%60}m</span>`:''}${dir?`<span>${esc(dir.name)}</span>`:''}</div>
 <div class="gs">${m.genres.map(g=>`<span>${esc(g.name)}</span>`).join('')}</div>
 <div class="src" id="src">${cur.tr?'<button class="chip" data-src="tr">Trailer</button>':'<span class="mt nf">No trailer available</span>'}</div>
 <div class="acts"><button class="act ${isS?'on':''}" data-tg="list">${isS?I.bmF:I.bm}<span>${isS?'Saved':'Save'}</span></button><button class="act ${isF?'on':''}" data-tg="fav">${isF?I.heartF:I.heart}<span>${isF?'Favorited':'Favorite'}</span></button><button class="act" id="dlb" data-dl="" hidden>${I.dl}<span>Download</span></button></div>
 <p class="ovw" id="ovw">${esc(m.overview)||'No overview available.'}</p>${(m.overview||'').length>140?'<button class="more2" data-more>More</button>':''}
 ${cast?`<h3>Cast</h3><div class="cast">${cast}</div>`:''}
 ${rel.length?`<h3>More like this</h3><div class="sc sm">${rel.map(card).join('')}</div>`:''}</div></div>`;
 if(auto==='trailer')startTrailer();
 filmBtns(m)}
async function openFilm(id,title){killPlayer();const tok=cur.tok=(cur.tok||0)+1,box=$('#modal');
 box.classList.add('on');document.body.style.overflow='hidden';box.scrollTop=0;box.innerHTML=skelPage();cur.mode='none';cur.tr=null;cur.rt=()=>openFilm(id,title);
 let d={};try{d=await jget('https://archive.org/metadata/'+id)}catch{}
 if(cur.tok!==tok)return;
 const md=d.metadata||{},one=v=>String(Array.isArray(v)?v.join(' '):v||''),t=one(md.title)||title,de=one(md.description).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 cur.m={ia:1,id,title:t};cur.film=id;
 box.innerHTML=`<div class="wpg"><div class="wp" id="wp"><div class="poster" style="background-image:url(https://archive.org/services/img/${esc(id)})"></div>${topbar}</div>
 <div class="wi"><h1>${esc(t)}</h1><div class="wm"><span>${esc(one(md.year)||one(md.date).slice(0,4)||'Classic')}</span><span>Free to watch</span></div>
 <div class="acts"><button class="act" data-dl="${esc(id)}" data-t="${esc(t)}">${I.dl}<span>Download</span></button></div>
 <p class="ovw open">${esc(de.slice(0,900))||'No description available.'}</p></div></div>`;
 startFilm(id,t)}
function wpClick(t){const b=t.closest('button,#sh');if(!b||!yp||!yp.getPlayerState)return false;
 switch(b.id){
  case'sh':case'pp':toggleP();return true;
  case'mu':if(yp.isMuted()){yp.unMute();b.innerHTML=I.vol}else{yp.mute();b.innerHTML=I.mute}return true;
  case'spd':{const r=[1,1.25,1.5,2,.75],n=r[(r.indexOf(yp.getPlaybackRate())+1)%r.length];yp.setPlaybackRate(n);b.textContent=n+'×';return true}
  case'fs':{const w=$('#wp');document.fullscreenElement?document.exitFullscreen():(w.requestFullscreen||w.webkitRequestFullscreen||(()=>toast('Fullscreen is not supported here'))).call(w);return true}}
 return false}
function toggleAct(el){const k=el.dataset.tg,on=toggle(k,cur.m);el.classList.toggle('on',on);
 el.innerHTML=(k==='list'?(on?I.bmF:I.bm):(on?I.heartF:I.heart))+`<span>${k==='list'?(on?'Saved':'Save'):(on?'Favorited':'Favorite')}</span>`;if(location.hash==='#/list')mylist()}
const modal=$('#modal');
modal.addEventListener('input',e=>{const t=e.target;if(!yp)return;if(t.id==='seek'){drag=true;t.style.setProperty('--p',t.value/10+'%')}if(t.id==='vol'){yp.setVolume(+t.value);t.style.setProperty('--p',t.value+'%')}});
modal.addEventListener('change',e=>{if(e.target.id==='seek'&&yp){yp.seekTo(yp.getDuration()*e.target.value/1000,true);drag=false}});
modal.addEventListener('mousemove',wake);modal.addEventListener('touchstart',wake,{passive:true});
document.addEventListener('fullscreenchange',()=>{const f=$('#fs');if(f)f.innerHTML=document.fullscreenElement?I.exit:I.full});

/* ---------- surprise ---------- */
async function surprise(){try{const d=await api('/discover/movie',{sort_by:'vote_average.desc','vote_count.gte':2000,page:1+Math.floor(Math.random()*12)});
 const l=d.results.filter(m=>m.poster_path);openDetail(l[Math.floor(Math.random()*l.length)].id)}catch{toast('Could not pick a movie right now')}}

/* ---------- global events ---------- */
document.addEventListener('click',e=>{const t=e.target;
 if(t.id==='sheet')return act('sc');
 const a=t.closest('[data-act]');if(a){act(a.dataset.act,a);return}
 if(t.closest('#wp')&&wpClick(t))return;
 if(t.closest('[data-watch-movie]')){if(cur.source)return startFilm(cur.source,titleOf(cur.m));if(cur.film)return startFilm(cur.film,titleOf(cur.m));return filmBtns(cur.m,true)}
 if(t.closest('[data-startp]')){cur.source?startFilm(cur.source,titleOf(cur.m)):cur.film?startFilm(cur.film,titleOf(cur.m)):startTrailer();return}
 const sc=t.closest('[data-src]');if(sc){sc.dataset.src==='film'?(cur.source?startFilm(cur.source,titleOf(cur.m)):startFilm(cur.film,titleOf(cur.m))):startTrailer();return}
 const arr=t.closest('.arr');if(arr){const s=arr.parentNode.querySelector('.sc');s.scrollBy({left:(arr.classList.contains('l')?-1:1)*s.clientWidth*.8,behavior:'smooth'});return}
 const pl=t.closest('[data-play]');if(pl){openDetail(pl.dataset.play,'trailer');return}
 const fi=t.closest('[data-ia]');if(fi){openFilm(fi.dataset.ia,fi.dataset.t);return}
 const dl=t.closest('[data-dl]');if(dl&&dl.dataset.dl){download(dl.dataset.dl,dl.dataset.t);return}
 const tg=t.closest('[data-tg]');if(tg&&cur.m&&!cur.m.ia){toggleAct(tg);return}
 const mo=t.closest('[data-more]');if(mo){const o=$('#ovw');o.classList.toggle('open');mo.textContent=o.classList.contains('open')?'Less':'More';return}
 if(t.closest('[data-close]')){closeDetail();return}
 if(t.closest('[data-retry]')){cur.rt&&cur.rt();return}
 const tb=t.closest('[data-tab]');if(tb){tab=tb.dataset.tab;mylist();return}
 const ep=t.closest('[data-episode]');if(ep){playEpisode(ep.dataset.series,ep.dataset.season,ep.dataset.episode);return}
 const c=t.closest('[data-id]');if(c)openDetail(c.dataset.id,null,c.dataset.kind||'movie')});
const warm=e=>{const c=e.target.closest&&e.target.closest('[data-id],[data-ia]');if(!c||c._w)return;c._w=1;
 if(c.dataset.id)(c.dataset.kind==='tv'?api('/tv/'+c.dataset.id,{append_to_response:'credits,similar,videos'}):api('/movie/'+c.dataset.id,{append_to_response:'credits,similar,videos'})).catch(()=>{});else jget('https://archive.org/metadata/'+c.dataset.ia).catch(()=>{})};
document.addEventListener('pointerover',warm,{passive:true});document.addEventListener('touchstart',warm,{passive:true});
document.addEventListener('keydown',e=>{if(e.target.matches('input'))return;
 if(e.key==='Enter'&&(e.target.dataset.id||e.target.dataset.ia))return e.target.click();
 if($('#modal').classList.contains('on')){
  if(yp&&yp.getPlayerState){wake();
   if(e.key===' '||e.key==='k'){e.preventDefault();toggleP()}
   else if(e.key==='ArrowRight')yp.seekTo(yp.getCurrentTime()+5,true);
   else if(e.key==='ArrowLeft')yp.seekTo(yp.getCurrentTime()-5,true);
   else if(e.key==='f'){const f=$('#fs');f&&f.click()}else if(e.key==='m'){const m=$('#mu');m&&m.click()}}
  if(e.key==='Escape'&&!document.fullscreenElement)closeDetail();return}
 if(e.key==='/'&&$('#sq')){e.preventDefault();$('#sq').focus()}});
$('#dice').onclick=surprise;
route();

}
