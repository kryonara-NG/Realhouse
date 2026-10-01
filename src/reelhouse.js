import { resolveMovieSource, resolveEpisodeSource } from './playback/resolver.js';
import { TMDB_READ_TOKEN } from './config.js';
import { registerPlugin } from '@capacitor/core';
import Hls from 'hls.js';
import { isNativeReelhouse, canDownloadNativeSource, downloadNativeMovie, getNativeDownloads, shareNativeDownload, deleteNativeDownload, openNativeDownload, makeCalendarEvent } from './native/downloads.js';

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
let nativeDownloads=isNativeReelhouse()?getNativeDownloads():[];
let installPrompt=null;
const WELCOME_KEY='rh:welcomeSeen';
const INDEPENDENCE_KEY='rh:independenceSeen';
const isInstalledApp=()=>Boolean(window.Capacitor?.isNativePlatform?.()||window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);
const INBOX_KEY='rh:inbox';
const SUBS_KEY='rh:subtitlePrefs';
const inbox=()=>store.get(INBOX_KEY,[]);
function addInbox(item){const list=inbox();const key=item.key||String(Date.now());if(list.some(x=>x.key===key))return;list.unshift({...item,key,at:item.at||Date.now()});store.set(INBOX_KEY,list.slice(0,60));renderNotificationBadge();}
function renderNotificationBadge(){const b=$('#notifBadge');if(!b)return;const n=inbox().filter(x=>!x.read).length;b.hidden=!n;b.textContent=n>99?'99+':String(n)}
function seedNotifications(){if(store.get('rh:inboxSeeded',false))return;addInbox({key:'welcome',title:'Welcome to Reelhouse',body:'Your movie library is ready. Explore a title and start watching.',url:'#/home'});store.set('rh:inboxSeeded',true)}
function openNotifications(){const box=$('#notifications');if(!box)return;const list=inbox();box.innerHTML=`<div class="notification-page"><header class="notification-head"><div><span class="welcome-kicker">REELHOUSE</span><h1>Notifications</h1><p>${list.length?'A few things worth seeing.':'You are all caught up.'}</p></div><button class="icon-btn notification-close" data-notifications-close aria-label="Close notifications">${I.x}</button></header><div class="notification-list">${list.length?list.map(x=>`<button class="notification-card ${x.read?'read':''}" data-notification-key="${esc(x.key)}" data-notification-url="${esc(x.url||'#/home')}"><span class="notification-dot"></span><span><b>${esc(x.title)}</b><small>${esc(x.body||'')}</small><time>${new Date(x.at).toLocaleString()}</time></span></button>`).join(''):'<div class="notification-empty"><div>✓</div><h2>Nothing new</h2><p>Fresh releases and useful Reelhouse updates will show up here.</p></div>'}</div><button class="chip notification-clear" data-notifications-clear>Mark everything read</button></div>`;box.classList.add('on');box.setAttribute('aria-hidden','false');store.set(INBOX_KEY,list.map(x=>({...x,read:true})));renderNotificationBadge()}
function closeNotifications(){const box=$('#notifications');if(!box)return;box.classList.remove('on');box.setAttribute('aria-hidden','true')}
function openWelcome(){const box=$('#welcomeModal');if(!box||store.get(WELCOME_KEY,false))return;box.classList.add('on');box.setAttribute('aria-hidden','false');document.body.classList.add('welcome-open')}
function closeWelcome(){const box=$('#welcomeModal');if(!box)return;box.classList.remove('on');box.setAttribute('aria-hidden','true');document.body.classList.remove('welcome-open');store.set(WELCOME_KEY,true)}
function openIndependence(){const box=$('#independenceModal');if(!box)return;const d=new Date();const key=d.getFullYear()+'-10-01';if(d.getMonth()!==9||d.getDate()!==1||store.get(INDEPENDENCE_KEY,'')===key)return;box.classList.add('on');box.setAttribute('aria-hidden','false');document.body.classList.add('celebration-open');store.set(INDEPENDENCE_KEY,key)}
function closeIndependence(){const box=$('#independenceModal');if(!box)return;box.classList.remove('on');box.setAttribute('aria-hidden','true');document.body.classList.remove('celebration-open')}

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
const subtitlePrefs=()=>store.get(SUBS_KEY,['en']);
function subtitleQuery(){return subtitlePrefs().filter(Boolean).slice(0,3).join(',')}

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
 const [r,sub,sub2]=(location.hash||'#/home').slice(2).split('/');
 document.querySelectorAll('#tab a').forEach(a=>a.classList.toggle('on',a.dataset.r===r));
 clearInterval(cur.hero);scrollTo(0,0);
 ({home,search:browse,list:mylist,me,app,person:renderPerson}[r]||home)(sub,sub2);renderNotificationBadge()}
addEventListener('hashchange',route);
addEventListener('scroll',()=>$('#nav').classList.toggle('solid',scrollY>60),{passive:true});

async function renderPerson(id){if(!id)return home();view.innerHTML='<div class="pg person-page"><p class="empty">Loading Realhouse DNA…</p></div>';try{const p=await api('/person/'+id,{append_to_response:'combined_credits,external_ids'});const credits=(p.combined_credits?.cast||[]).filter(x=>x.id).sort((a,b)=>String(b.release_date||b.first_air_date||'').localeCompare(String(a.release_date||a.first_air_date||'')));const movies=credits.filter(x=>x.media_type==='movie');const shows=credits.filter(x=>x.media_type==='tv');const years=credits.map(x=>String(x.release_date||x.first_air_date||'').slice(0,4)).filter(Boolean);const span=years.length?(Math.max(...years.map(Number))-Math.min(...years.map(Number))+1):0;view.innerHTML='<div class="pg person-page"><button class="chip" onclick="history.back()">‹ Back</button><section class="person-hero"><div class="person-photo">'+(p.profile_path?'<img src="'+IMG+'w500'+p.profile_path+'" alt="">':'<span>R</span>')+'</div><div><span class="welcome-kicker">REALHOUSE DNA</span><h1>'+esc(p.name)+'</h1><p class="mt">'+esc(p.known_for_department||'Screen talent')+' · '+(span||'—')+' years tracked</p><div class="person-stats"><b>'+credits.length+'<small>Total credits</small></b><b>'+movies.length+'<small>Movies</small></b><b>'+shows.length+'<small>Series</small></b></div></div></section><section class="dna-panel"><h2>Their DNA</h2><p>'+esc((p.biography||'No biography available.').slice(0,1100))+'</p></section><h2>Filmography</h2><div class="library-list person-credits">'+credits.slice(0,80).map(x=>libraryRow(x,'saved')).join('')+'</div></div>'}catch{view.innerHTML='<div class="pg"><p class="empty">Could not load this person right now.</p></div>'}}
/* ---------- home ---------- */
const CATALOG_SECTIONS=[
 {id:'trending',title:'Trending now',path:'/trending/all/week',kind:'mixed'},
 {id:'popular-movies',title:'Popular movies',path:'/movie/popular',kind:'movie'},
 {id:'popular-series',title:'Popular series',path:'/tv/popular',kind:'tv'},
 {id:'new-movies',title:'New movies',path:'/movie/now_playing',kind:'movie'},
 {id:'new-series',title:'New series',path:'/tv/on_the_air',kind:'tv'},
 {id:'upcoming',title:'Coming to Reelhouse',path:'/movie/upcoming',kind:'movie'},
 {id:'top-rated',title:'Top rated movies',path:'/movie/top_rated',kind:'movie'},
 {id:'anime',title:'Anime',path:'/discover/tv',kind:'tv',params:{with_genres:'16',with_origin_country:'JP',with_original_language:'ja'}},
 {id:'animation',title:'Animation',path:'/discover/movie',kind:'movie',params:{with_genres:'16'}},
 {id:'kdrama',title:'K-dramas',path:'/discover/tv',kind:'tv',params:{with_origin_country:'KR',with_original_language:'ko'}},
 {id:'cdrama',title:'C-dramas',path:'/discover/tv',kind:'tv',params:{with_origin_country:'CN',with_original_language:'zh'}},
 {id:'jdrama',title:'J-dramas',path:'/discover/tv',kind:'tv',params:{with_origin_country:'JP',with_original_language:'ja'}},
 {id:'indian',title:'Indian cinema',path:'/discover/movie',kind:'movie',params:{with_origin_country:'IN'}},
 {id:'nollywood',title:'Nollywood',path:'/discover/movie',kind:'movie',params:{with_origin_country:'NG'}},
 {id:'turkish',title:'Turkish dramas',path:'/discover/tv',kind:'tv',params:{with_origin_country:'TR',with_original_language:'tr'}},
 {id:'action',title:'Action',path:'/discover/movie',kind:'movie',params:{with_genres:'28'}},
 {id:'comedy',title:'Comedy',path:'/discover/movie',kind:'movie',params:{with_genres:'35'}},
 {id:'romance',title:'Romance',path:'/discover/movie',kind:'movie',params:{with_genres:'10749'}},
 {id:'thriller',title:'Thrillers',path:'/discover/movie',kind:'movie',params:{with_genres:'53'}},
 {id:'horror',title:'Horror',path:'/discover/movie',kind:'movie',params:{with_genres:'27'}},
 {id:'scifi',title:'Sci-fi',path:'/discover/movie',kind:'movie',params:{with_genres:'878'}},
 {id:'crime',title:'Crime',path:'/discover/tv',kind:'tv',params:{with_genres:'80'}},
 {id:'documentary',title:'Documentaries',path:'/discover/movie',kind:'movie',params:{with_genres:'99'}},
 {id:'family',title:'Family',path:'/discover/movie',kind:'movie',params:{with_genres:'10751'}},
 {id:'fantasy',title:'Fantasy',path:'/discover/movie',kind:'movie',params:{with_genres:'14'}},
 {id:'music',title:'Music & performance',path:'/discover/movie',kind:'movie',params:{with_genres:'10402'}}
];

const HOME_BATCH=5;
let homeCatalogObserver=null;
const catalogState=new Map();

function catalogShell(s){
 return `<section class="row catalog-row" data-catalog="${s.id}"><h2>${esc(s.title)}</h2><div class="rw"><button class="arr l" aria-label="Scroll left">${I.l}</button><div class="sc" id="cat-${s.id}">${'<div class="sk"></div>'.repeat(10)}</div><button class="arr r" aria-label="Scroll right">${I.r}</button></div></section>`;
}
function catalogParams(s,page){
 return {sort_by:s.params?.sort_by||'popularity.desc',include_adult:false,page,...(s.params||{})};
}
async function loadCatalogPage(s,page=1,append=false){
 const box=$('#cat-'+s.id);if(!box)return;
 const state=catalogState.get(s.id)||{page:0,loading:false,total:1,seen:new Set()};
 if(state.loading)return;
 if(page>state.total)return;
 state.loading=true;catalogState.set(s.id,state);
 try{
   const d=await api(s.path,catalogParams(s,page));
   if(!append)box.innerHTML='';
   const results=(d.results||[]).filter(m=>m.poster_path).map(m=>s.kind==='movie'?{...m,media_type:'movie'}:s.kind==='tv'?{...m,media_type:'tv'}:m);
   const fresh=results.filter(m=>{const k=m.media_type+':'+m.id;if(state.seen.has(k))return false;state.seen.add(k);return true});
   box.insertAdjacentHTML(append?'beforeend':'afterbegin',fresh.map(card).join(''));
   state.page=page;state.total=Math.min(Number(d.total_pages)||page,500);state.loading=false;catalogState.set(s.id,state);
   if(!fresh.length&&page<state.total)loadCatalogPage(s,page+1,true);
 }catch{
   state.loading=false;catalogState.set(s.id,state);
   if(!append)box.innerHTML='<p class="empty">This section could not load right now.</p>';
 }
}
function watchCatalogScroll(s){
 const box=$('#cat-'+s.id);if(!box||box.dataset.infinite)return;
 box.dataset.infinite='1';
 box.addEventListener('scroll',()=>{
   if(box.scrollLeft+box.clientWidth>=box.scrollWidth-420){
     const st=catalogState.get(s.id);
     if(st&&!st.loading&&st.page<st.total)loadCatalogPage(s,st.page+1,true);
   }
 },{passive:true});
}
async function loadHomeBatch(offset=0){
 const sections=CATALOG_SECTIONS.slice(offset,offset+HOME_BATCH);
 sections.forEach(s=>{catalogState.set(s.id,{page:0,loading:false,total:1,seen:new Set()});watchCatalogScroll(s);loadCatalogPage(s,1,false)});
}
function setupHomeInfinite(){
 const sentinel=document.createElement('div');sentinel.id='homeInfinite';sentinel.className='home-infinite-sentinel';view.appendChild(sentinel);
 homeCatalogObserver?.disconnect();
 homeCatalogObserver=new IntersectionObserver(entries=>{
   if(!entries[0].isIntersecting)return;
   const loaded=[...view.querySelectorAll('[data-catalog]')].length;
   if(loaded<CATALOG_SECTIONS.length){
     const next=Math.min(loaded,CATALOG_SECTIONS.length-1);
     const chunk=CATALOG_SECTIONS.slice(next,next+HOME_BATCH);
     chunk.forEach(s=>view.querySelector('.rows').insertAdjacentHTML('beforeend',catalogShell(s)));
     chunk.forEach(s=>{catalogState.set(s.id,{page:0,loading:false,total:1,seen:new Set()});watchCatalogScroll(s);loadCatalogPage(s,1,false)});
   }else{
     sentinel.innerHTML='<span>More entertainment is loading as you keep scrolling…</span>';
   }
 },{rootMargin:'900px'});
 homeCatalogObserver.observe(sentinel);
}
async function home(){
 catalogState.clear();
 const initial=CATALOG_SECTIONS.slice(0,HOME_BATCH);
 view.innerHTML=`<section class="hero"><div class="bg"></div><div class="bg"></div><div class="shade"></div><div class="hc"></div><div class="dots"></div></section><div class="rows">${rowShell("Free full movies to stream","ia")}${recentRow()}${initial.map(catalogShell).join('')}<section class="upcoming-space" id="upcomingSpace"><div class="upcoming-copy"><span class="welcome-kicker">WHAT'S NEXT</span><h2>Not out yet. Still worth knowing about.</h2><p>Track cinema releases, set a reminder, and keep the date close.</p></div><div class="upcoming-list" id="upcomingList"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></section></div>`;
 loadIA();
 initial.forEach(s=>{catalogState.set(s.id,{page:0,loading:false,total:1,seen:new Set()});watchCatalogScroll(s);loadCatalogPage(s,1,false);});
 setupHomeInfinite();
 renderUpcomingSpace();
 try{
   const d=await api('/trending/movie/week');
   hero((d.results||[]).filter(m=>m.backdrop_path).slice(0,6));
 }catch{}
}
async function renderUpcomingSpace(){const box=$('#upcomingList');if(!box)return;try{const d=await api('/movie/upcoming',{page:1,region:'NG'});const items=(d.results||[]).filter(x=>x.release_date&&x.poster_path).slice(0,6);box.innerHTML=items.map(x=>'<article class="upcoming-item"><img loading="lazy" src="'+IMG+'w342'+x.poster_path+'" alt=""><div><small>'+esc(new Date(x.release_date+'T09:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))+'</small><h3>'+esc(titleOf(x))+'</h3><p>'+esc((x.overview||'Release date announced.').slice(0,140))+'</p><div class="upcoming-actions"><button class="chip" data-upcoming-id="'+x.id+'" data-upcoming-title="'+esc(titleOf(x))+'" data-upcoming-date="'+x.release_date+'" data-upcoming-overview="'+esc(x.overview||'')+'">Set reminder</button><button class="chip" data-id="'+x.id+'" data-kind="movie">Details</button></div></div></article>').join('')||'<p class="empty">Upcoming releases are quiet right now.</p>'}catch{box.innerHTML='<p class="empty">Upcoming releases could not load right now.</p>'}}
function hero(ms){
 if(!ms.length)return;
 $('.hero').classList.add('ready');const bgs=[...view.querySelectorAll('.bg')],hc=$('.hc'),dots=$('.dots');let i=0,f=0;
 dots.innerHTML=ms.map((_,j)=>`<button aria-label="Show featured movie ${j+1}"></button>`).join('');
 const show=n=>{i=n;f^=1;const m=ms[n];bgs[f].style.backgroundImage=`url(${IMG}${innerWidth>900?'w1280':'w780'}${m.backdrop_path})`;
  bgs[f].classList.add('show');bgs[f^1].classList.remove('show');
  hc.classList.remove('in');void hc.offsetWidth;hc.classList.add('in');
  hc.innerHTML=`<div class="mt"><b class="rt">${I.star}${(m.vote_average||0).toFixed(1)}</b> &nbsp;${yr(m)}</div><h1>${esc(titleOf(m))}</h1><p>${esc(m.overview||'')}</p><div><button class="btn pri" data-play="${m.id}" data-t="${esc(titleOf(m))}">${I.play} Play trailer</button><button class="btn" data-id="${m.id}" data-kind="movie">More info</button></div>`;
  [...dots.children].forEach((d,j)=>d.classList.toggle('on',j===n))};
 dots.onclick=e=>{const j=[...dots.children].indexOf(e.target);if(j>-1){show(j);restart()}};
 const restart=()=>{clearInterval(cur.hero);if(S.rotate)cur.hero=setInterval(()=>show((i+1)%ms.length),8000)};
 show(0);restart();
}/* ---------- free films (Internet Archive) ---------- */
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const rowShell=(t,id,inner)=>`<section class="row"><h2>${t}</h2><div class="rw"><button class="arr l" aria-label="Scroll left">${I.l}</button><div class="sc" id="${id}">${inner??'<div class="sk"></div>'.repeat(8)}</div><button class="arr r" aria-label="Scroll right">${I.r}</button></div></section>`;
const rc=r=>r.ia?iaCard(r):card(r);
const recentRow=()=>lists.recent.length?rowShell('Continue watching','cw',lists.recent.slice(0,12).map(rc).join('')):'';
const iaCard=x=>{const id=esc(x.identifier||x.id);return `<a class="card" tabindex="0" role="button" data-ia="${id}" data-t="${esc(x.title)}"><i class="f">FREE</i><img loading="lazy" src="https://archive.org/services/img/${id}" alt=""><div class="m"><b>${esc(x.title)}</b><span>${esc(x.year||'Classic')}</span></div></a>`};
async function iaList(q,n){return(await jget('https://archive.org/advancedsearch.php?q='+encodeURIComponent(q)+'&fl[]=identifier&fl[]=title&fl[]=year&sort[]=downloads+desc&rows='+n+'&output=json',undefined,true)).response.docs}
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
function libraryRow(x,kind){const title=titleOf(x)||x.title||'Untitled';const image=x.poster_path?IMG+'w342'+x.poster_path:'';return '<div class="library-row"><div class="library-thumb">'+(image?'<img loading="lazy" src="'+esc(image)+'" alt="">':'<span>R</span>')+'</div><div class="library-copy"><b>'+esc(title)+'</b><small>'+(kind==='download'?'Downloaded':'Saved')+(x.season!=null?' · S'+String(x.season).padStart(2,'0')+'E'+String(x.episode).padStart(2,'0'):'')+'</small></div><div class="library-actions">'+(kind==='download'?'<button class="chip" data-native-open="'+esc(x.id)+'">Watch</button><button class="chip" data-native-share="'+esc(x.id)+'">Share</button><button class="chip" data-native-delete="'+esc(x.id)+'">Delete</button>':'<button class="chip" data-id="'+esc(x.id)+'" data-kind="'+esc(x.media_type||'movie')+'">Open</button>')+'</div></div>'}
function mylist(){const downloads=isNativeReelhouse()?getNativeDownloads():[];const L=tab==='downloads'?downloads:(tab==='fav'?lists.fav:lists.list);const kind=tab==='downloads'?'download':'saved';view.innerHTML='<div class="pg library-page"><div class="library-head"><div><span class="welcome-kicker">REELHOUSE</span><h1>Library</h1><p class="mt">Saved titles, favorites and private app downloads.</p></div></div><div class="chips library-tabs"><button class="chip '+(tab==='downloads'?'on':'')+'" data-tab="downloads">Downloaded ('+downloads.length+')</button><button class="chip '+(tab==='list'?'on':'')+'" data-tab="list">Saved ('+lists.list.length+')</button><button class="chip '+(tab==='fav'?'on':'')+'" data-tab="fav">Favorites ('+lists.fav.length+')</button></div><div class="library-list">'+L.map(x=>libraryRow(x,kind)).join('')+'</div>'+(L.length?'':'<p class="empty">Nothing here yet. Save a title or download an MP4 in the Reelhouse app.</p>')+'</div>'}
/* ---------- app install ---------- */
const APK_URL=['https:','github.com','kryonara-NG','Realhouse','releases','latest','download','Reelhouse.apk'].join('/');
const RELEASE_API='https://api.github.com/repos/kryonara-NG/Realhouse/releases/latest';
const Haptics=registerPlugin('Haptics');
const LocalNotifications=registerPlugin('LocalNotifications');
const ImpactStyle={Light:'LIGHT',Medium:'MEDIUM',Heavy:'HEAVY'};
const haptic=async(style=ImpactStyle.Light)=>{try{await Haptics.impact({style});return}catch{}try{navigator.vibrate?.(12)}catch{}};
const REMINDER_CHANNEL='reelhouse-reminders';
const REMINDER_COUNT=72;
async function setupReminderNotifications(){
 try{
  const perm=await LocalNotifications.requestPermissions();
  if(perm.display!=='granted')return false;
  await LocalNotifications.createChannel({id:REMINDER_CHANNEL,name:'Reelhouse reminders',description:'Optional Reelhouse watch reminders',importance:3,sound:'default',vibration:true,lights:true});
  const pending=await LocalNotifications.getPending();
  const ids=pending.notifications.filter(n=>n.channelId===REMINDER_CHANNEL).map(n=>n.id);
  if(ids.length)await LocalNotifications.cancel({notifications:ids.map(id=>({id}))});
  const now=Date.now();
  await LocalNotifications.schedule({notifications:Array.from({length:REMINDER_COUNT},(_,i)=>({id:9200+i,title:'Reelhouse',body:'Your next watch is waiting.',channelId:REMINDER_CHANNEL,schedule:{at:new Date(now+(i+1)*20*60*1000),allowWhileIdle:true},extra:{url:'#/home'}}))});
  store.set('rh:20minReminders',true);
  return true;
 }catch{return false}
}
async function disableReminderNotifications(){
 try{
  const pending=await LocalNotifications.getPending();
  const ids=pending.notifications.filter(n=>n.channelId===REMINDER_CHANNEL).map(n=>n.id);
  if(ids.length)await LocalNotifications.cancel({notifications:ids.map(id=>({id}))});
 }catch{}
 store.set('rh:20minReminders',false);
}

async function downloadApp(){
 await haptic(ImpactStyle.Medium);
 toast('Opening the latest Reelhouse APK…');
 try{
  const r=await fetch(RELEASE_API,{headers:{Accept:'application/vnd.github+json'}});
  if(!r.ok)throw new Error('release '+r.status);
  const d=await r.json();
  const asset=(d.assets||[]).find(x=>x.name==='Reelhouse.apk');
  if(!asset?.browser_download_url)throw new Error('APK asset missing');
  window.location.assign(asset.browser_download_url);
 }catch{
  window.location.assign(APK_URL);
 }
}
function notificationState(){return store.get('rh:notifications',{enabled:false,seen:[]})}
async function showReelhouseNotification(title,body,url='#/home'){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 try{const reg=await navigator.serviceWorker?.ready;if(reg?.showNotification){await reg.showNotification(title,{body,icon:'/icon.svg',badge:'/icon.svg',tag:'reelhouse-movie',data:{url}});return}new Notification(title,{body,icon:'/icon.svg'})}catch{}
}
async function checkMovieNotifications(seed=false){
 const ns=notificationState();if(!ns.enabled||!('Notification' in window)||Notification.permission!=='granted')return;
 try{
  const [now,up]=await Promise.all([api('/movie/now_playing',{language:'en-US',page:1}),api('/movie/upcoming',{language:'en-US',page:1})]);
  const movies=[...(now.results||[]),...(up.results||[])].filter(x=>x?.id);const seen=new Set(ns.seen||[]);
  if(seed){ns.seen=movies.slice(0,40).map(x=>x.id);store.set('rh:notifications',ns);return}
  const fresh=movies.filter(x=>!seen.has(x.id)&&x.poster_path).slice(0,3);
  ns.seen=[...movies.map(x=>x.id),...(ns.seen||[])].filter((v,i,a)=>a.indexOf(v)===i).slice(0,80);store.set('rh:notifications',ns);
  if(fresh.length){const title=fresh.length===1?'New movie on Reelhouse':'New movies on Reelhouse';const body=fresh.map(x=>x.title).join(', ');addInbox({key:'movies:'+fresh.map(x=>x.id).join(','),title,body,url:'#/home'});await showReelhouseNotification(title,body,'#/home')}
 }catch{}
}
async function enableMovieNotifications(){
 await setupReminderNotifications();

 if(!('Notification' in window))return toast('This browser does not support notifications.');
 const p=await Notification.requestPermission();if(p!=='granted')return toast('Notification permission was not granted.');
 const ns=notificationState();ns.enabled=true;store.set('rh:notifications',ns);await checkMovieNotifications(true);toast('Movie notifications enabled');app();
}
function disableMovieNotifications(){disableReminderNotifications();const ns=notificationState();ns.enabled=false;store.set('rh:notifications',ns);toast('Movie notifications turned off');app()}
function app(){
 const ns=store.get('rh:notifications',{enabled:false,seen:[]});
 const native=isInstalledApp();
 const canInstall=!native&&(Boolean(installPrompt)||!window.Capacitor?.isNativePlatform?.());
 const supported='Notification' in window;
 const status=!supported?'Not supported':ns.enabled?'Enabled':'Off';
 view.innerHTML=`<div class="pg app-page">
 <div class="hi">
  <h1>Download Reelhouse</h1>
  <p>Get the Android app for the full Reelhouse experience. The download button resolves the latest published APK before starting the download.</p>
  <div class="app-actions">
   ${native?'<div class="app-installed"><span>✓</span><div><b>Reelhouse app installed</b><small>Native app mode is active on this device.</small></div></div>':'<button class="btn pri" data-act="downloadapp">${I.dl}<span>Download Android APK</span></button>'}
   ${canInstall?'<button class="btn" data-act="install">'+(installPrompt?'Install Reelhouse':'Add to home screen')+'</button>':''}
  </div>
  <small class="app-note">${native?'You are using the installed Reelhouse app.':'Latest Android app and install options.'}</small>
 </div>
 <section class="download-tools">
  <div class="li app-tool"><div><b>Movie notifications</b><small class="mt">Get notified when new movies arrive on Reelhouse.</small></div><span class="notif-status">${esc(status)}</span><button class="chip" data-act="${ns.enabled?'notifsoff':'notifson'}">${ns.enabled?'Turn off':'Enable'}</button></div>
  <div class="li app-tool"><div><b>App updates</b><small class="mt">The Download Android APK button always checks the newest published release.</small></div></div>
 </section>
 <p class="mt app-help">Notifications are only used for Reelhouse movie and app updates. You can turn them off at any time.</p>
 </div>`;
}
/* ---------- me, accounts, settings ---------- */
const ic=p=>`<svg class="ico" viewBox="0 0 24 24">${p}</svg>`;
const ICO={recent:ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),dl:ic('<path d="M12 4v11m-5-5l5 5 5-5M5 20h14"/>'),set:ic('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),bell:ic('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>')};
const back=`<a class="chip" href="#/me">${I.l} Me</a>`;
function me(sub){const on=session&&acct;
 if(sub==='recent'){const L=lists.recent;return view.innerHTML=`<div class="pg">${back}<h1 style="margin-top:14px">Recently watched</h1><div class="grid">${L.map(rc).join('')}</div>${L.length?'':'<p class="empty">Trailers and films you play show up here.</p>'}</div>`}
 if(sub==='downloads'){const L=lists.dl;return view.innerHTML=`<div class="pg">${back}<h1 style="margin-top:14px">Downloads</h1><p class="mt" style="margin-bottom:16px">Free films use the browser download flow. If your browser opens the media instead, use its built-in download control.</p>${L.map(x=>`<div class="li"><div><b>${esc(x.title)}</b><small class="mt" style="display:block">${new Date(x.at).toLocaleDateString()}</small></div><span style="flex:1"></span><a class="chip" href="${esc(x.url)}" target="_blank" rel="noopener">Open file</a><button class="chip" data-act="rmdl" data-id="${esc(x.id)}">Remove</button></div>`).join('')}${L.length?'':'<p class="empty">No downloads yet. Free full movies have a Download button on their details page.</p>'}</div>`}
 if(sub==='settings')return view.innerHTML=`<div class="pg">${back}<h1 style="margin-top:14px">Settings</h1><h3 class="sh">Appearance</h3><div class="seg">${['light','dark','system'].map(v=>`<button class="${S.theme===v?'on':''}" data-act="theme" data-v="${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><h3 class="sh">Playback</h3><label class="li"><span>Rotate featured movies on Home</span><span style="flex:1"></span><input type="checkbox" data-act="rotate" ${S.rotate?'checked':''}></label><div class="li"><div><b>Subtitle language</b><small class="mt">Used as the default when captions are available.</small></div><span style="flex:1"></span><button class="chip" data-act="subs">${esc(subtitlePrefs().join(', '))}</button></div><h3 class="sh">Data</h3><button class="mi" data-act="clear">Clear watch history</button><p class="mt" style="font-size:13px;margin-top:14px">Movie info by TMDB. Free films and downloads come from the Internet Archive public-domain library. Accounts and lists are stored only in this browser.</p></div>`;
 const head=on?`<div class="prof"><div class="avw"><div class="av">${acct.avatar?`<img src="${acct.avatar}" alt="">`:esc(acct.name[0].toUpperCase())}</div><label class="cam" title="Change photo">${I.cam}<input type="file" id="av" accept="image/*" hidden></label></div><div><h1 style="font-size:28px;margin:0">${esc(acct.name)}</h1><div class="mt">${esc(acct.email)}</div><button class="chip" data-act="name" style="margin-top:8px">Edit name</button></div></div>`
 :`<div class="hi"><h1>Your seat is waiting</h1><p>Create a free account to keep your list and favorites, pick films up where you left off, and make the profile yours.</p><div><button class="btn" data-act="up">Sign up</button><button class="btn" data-act="in">Log in</button></div></div>`;
 view.innerHTML=`<div class="pg">${head}<div class="st"><div><b>${lists.list.length}</b>Saved</div><div><b>${lists.fav.length}</b>Favorites</div><div><b>${lists.recent.length}</b>Watched</div></div>
 <a class="mi" href="#/me/recent">${ICO.recent}<span>Recently watched<small>Pick up where you stopped</small></span><em>${I.r}</em></a>
 <a class="mi" href="#/me/settings">${ICO.set}<span>Settings<small>Theme and playback</small></span><em>${I.r}</em></a>
 <button class="mi" data-open-notifications>${ICO.bell}<span>Notifications<small>Movie and Reelhouse updates</small></span><b class="notif-badge" id="notifBadge" hidden></b><em>${I.r}</em></button>
 ${isInstalledApp()?'':'<a class="mi" href="#/app">'+ICO.dl+'<span>Download App<small>Get the latest Reelhouse Android app</small></span><em>'+I.r+'</em></a>'}
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
function act(n,el){haptic().catch(()=>{});switch(n){
 case'install':return (async()=>{if(!installPrompt)return toast('Use your browser menu to choose “Install app” or “Add to Home screen”.');installPrompt.prompt();try{await installPrompt.userChoice}catch{}installPrompt=null;return app()})();
 case'downloadapp':return downloadApp();
 case'notifson':return enableMovieNotifications();
 case'notifsoff':return disableMovieNotifications();
 case'in':case'up':return authSheet(n);
 case'sc':return $('#sheet').classList.remove('on');
 case'go':return authGo(el.dataset.mode);
 case'out':session=false;store.set('sess',false);toast('Logged out');return me();
 case'name':return sheet(`<h1 style="font-size:30px">Edit name</h1><input id="nn" value="${esc(acct.name)}"><button class="btn pri" data-act="savename">Save</button>`);
 case'savename':acct.name=$('#nn').value.trim()||acct.name;store.set('acct',acct);act('sc');return me();
 case'theme':S.theme=el.dataset.v;store.set('theme',S.theme);applyTheme();return me('settings');
 case'rotate':S.rotate=el.checked;store.set('rotate',S.rotate);return;
 case'subs':return sheet(`<h1 style="font-size:30px">Subtitle languages</h1><p class="mt">Pick up to three, in the order you prefer.</p><div class="chips" id="subChoices">${[['en','English'],['fr','Français'],['es','Español'],['de','Deutsch'],['pt','Português'],['ja','日本語'],['ko','한국어'],['ar','العربية']].map(([v,l])=>`<button class="chip ${subtitlePrefs().includes(v)?'on':''}" data-sub="${v}">${l}</button>`).join('')}</div><button class="btn pri" data-act="savesubs" style="margin-top:16px">Save preferences</button>`);
 case'savesubs':{const vals=[...document.querySelectorAll('[data-sub].on')].map(x=>x.dataset.sub).slice(0,3);store.set(SUBS_KEY,vals.length?vals:['en']);act('sc');toast('Subtitle preferences saved');return me('settings')}
 case'clear':lists.recent=[];S.prog={};store.set('recent',[]);toast('History cleared');return me('settings');
 case'rmdl':lists.dl=lists.dl.filter(x=>x.id!==el.dataset.id);store.set('dl',lists.dl);return me('downloads')}}
function setAvatar(f){if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),z=Math.min(im.width,im.height);c.width=c.height=200;c.getContext('2d').drawImage(im,(im.width-z)/2,(im.height-z)/2,z,z,0,0,200,200);acct.avatar=c.toDataURL('image/jpeg',.85);store.set('acct',acct);toast('Photo updated');me()};im.src=r.result};r.readAsDataURL(f)}
document.addEventListener('change',e=>{if(e.target.id==='av')setAvatar(e.target.files[0])});

/* ---------- watch page: small player on top, details underneath ---------- */
let yp,ytP,tick,idle,drag=false,pm=null;
const topbar=`<div class="top"><button class="ib" data-close aria-label="Back">${I.back}</button></div>`;
const ctl=`<div class="spin" id="spin"><i></i></div><div class="perr" id="perr"></div><div class="shield" id="sh"></div>${topbar}<div class="ctl reelhouse-controls" id="playerControls"><input type="range" id="seek" min="0" max="1000" value="0" aria-label="Seek"><div class="cr"><button class="ib" id="back10" aria-label="Back 10 seconds">−10</button><button class="ib" id="pp" aria-label="Play or pause">${I.pause}</button><button class="ib" id="fwd10" aria-label="Forward 10 seconds">+10</button><button class="ib" id="mu" aria-label="Mute">${I.vol}</button><input type="range" id="vol" min="0" max="100" value="80" style="--p:80%" aria-label="Volume"><span class="tm" id="tm">0:00 / 0:00</span><span class="player-spacer"></span><button class="btn" id="spd" aria-label="Playback speed">1×</button><button class="ib" id="pip" aria-label="Picture in picture">PiP</button><button class="ib" id="fs" aria-label="Fullscreen">${I.full}</button></div><div class="player-extra"><button class="chip" id="playerLock">Lock</button><button class="chip" id="playerCinema">Cinema</button><button class="chip" id="playerSleep">Sleep</button><button class="chip" id="playerNext">Next</button></div></div>`;
const skelPage=()=>`<div class="wpg"><div class="wp"><div class="poster sk0"></div>${topbar}</div><div class="wi"><div class="ln" style="width:65%;height:26px"></div><div class="ln" style="width:40%"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:80%"></div></div></div>`;
const loadYT=()=>ytP||(ytP=new Promise((res,rej)=>{if(window.YT&&YT.Player)return res();window.onYouTubeIframeAPIReady=res;const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=()=>{ytP=null;rej()};document.head.append(s);setTimeout(()=>{if(!(window.YT&&YT.Player)){ytP=null;rej()}},9000)}));
const fmt=s=>{s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function remember(m){const x=m.ia?m:slim(m);lists.recent=[{...x,at:Date.now()},...lists.recent.filter(r=>r.id!==x.id)].slice(0,40);store.set('recent',lists.recent)}
function saveProg(){if(pm&&yp){try{const t=yp.getCurrentTime(),d=yp.getDuration();S.prog[pm.id]=d&&t/d>.95?0:t;store.set('prog',S.prog)}catch{}}pm=null}
const vAdapter=v=>({getPlayerState:()=>v.ended?0:v.paused?2:1,pauseVideo:()=>v.pause(),playVideo:()=>{v.play().catch(()=>{})},seekTo:t=>{const e=v.ended;v.currentTime=t;if(e)v.play().catch(()=>{})},getCurrentTime:()=>v.currentTime,getDuration:()=>v.duration||0,isMuted:()=>v.muted,mute:()=>{v.muted=true},unMute:()=>{v.muted=false},setVolume:x=>{v.volume=x/100},getPlaybackRate:()=>v.playbackRate,setPlaybackRate:r=>{v.playbackRate=r},destroy:()=>{v.pause();v.removeAttribute('src');v.load()}});
function killPlayer(){saveProg();clearInterval(tick);try{yp&&yp.destroy()}catch{}yp=null;try{cur.hls&&cur.hls.destroy()}catch{}cur.hls=null;try{cur.vidsrcCleanup&&cur.vidsrcCleanup()}catch{}cur.vidsrcCleanup=null}
function closeDetail(){killPlayer();cur.tok=(cur.tok||0)+1;const b=$('#modal');b.classList.remove('on');b.innerHTML='';document.body.style.overflow=''}
const setPP=s=>{const b=$('#pp');if(b)b.innerHTML=s===1?I.pause:s===0?I.replay:I.play};
const spin=on=>{const e=$('#spin');if(e)e.classList.toggle('on',!!on)};
const setSrc=k=>{cur.mode=k;document.querySelectorAll('#src [data-src]').forEach(b=>b.classList.toggle('on',b.dataset.src===k))};
function wake(){const w=$('#wp .custom-player')||$('#wp');if(!w)return;w.classList.remove('idle');clearTimeout(idle);idle=setTimeout(()=>{if(yp&&yp.getPlayerState&&yp.getPlayerState()===1)w.classList.add('idle')},2600)}
function toggleP(){if(!yp||!yp.getPlayerState)return;const s=yp.getPlayerState();s===1?yp.pauseVideo():(s===0?yp.seekTo(0):yp.playVideo())}
function mount(inner){const w=$('#wp');w.innerHTML=inner+ctl;w.classList.remove('idle');wake();spin(1);clearInterval(tick);
 tick=setInterval(()=>{if(!yp||!yp.getDuration)return;const d=yp.getDuration(),t=yp.getCurrentTime();if(!drag){const s=$('#seek');if(s){s.value=d?t/d*1000:0;s.style.setProperty('--p',(d?t/d*100:0)+'%')}}const m=$('#tm');if(m)m.textContent=fmt(t)+' / '+fmt(d)},250)}
function showErr(msg,key){spin(0);const e=$('#perr');if(!e)return;e.innerHTML=`${I.warn}<div>${msg}</div><div><button class="btn" data-retry>Retry</button>${key?` <a class="btn" href="https://www.youtube.com/watch?v=${key}" target="_blank" rel="noopener">${I.ext} Open trailer</a>`:''}</div>`;e.classList.add('on')}
function trailerVideo(m){const v=(m?.videos?.results||[]).filter(x=>x.site==='YouTube'&&x.key);return v.find(x=>x.type==='Trailer'&&x.official)||v.find(x=>x.type==='Trailer')||v.find(x=>x.type==='Teaser')||v[0]||null}
function mountTrailer(video,title){
 const w=$('#wp');if(!w)return;
 killPlayer();
 w.innerHTML='<div class="player-exit">'+topbar+'</div><div class="native-player trailer-player"><div class="source-loading"><strong>Native-only mode</strong><span>Trailers are disabled because Reelhouse no longer uses embedded video players.</span></div></div>';
}


function showResumePrompt(t){
 const shell=$('#wp .custom-player');if(!shell||shell.querySelector('.resume-card'))return;
 const card=document.createElement('div');card.className='resume-card';card.innerHTML=`<b>Continue watching?</b><span>Resume at ${fmt(t)}</span><div><button class="btn pri" data-resume>${I.play} Continue</button><button class="btn" data-start-over>Start over</button></div>`;card.dataset.resumeAt=String(t);
 shell.appendChild(card);setTimeout(()=>card.classList.add('on'),60);setTimeout(()=>card.remove(),9000);
}
function populateQualityMenu(){
 const shell=$('#wp .custom-player');if(!shell||!cur.hls)return;
 const box=shell.querySelector('#playerQuality');if(box)box.remove();
 const q=document.createElement('select');q.id='playerQuality';q.className='player-quality';q.setAttribute('aria-label','Video quality');
 const levels=cur.hls.levels||[];
 q.innerHTML='<option value="-1">Auto</option>'+levels.map((l,i)=>`<option value="${i}">${l.height?l.height+'p':(l.bitrate?Math.round(l.bitrate/1000)+'k':'Quality '+(i+1))}</option>`).join('');
 shell.querySelector('.player-extra')?.prepend(q);
 q.onchange=()=>{cur.hls.currentLevel=Number(q.value)};
}
function updatePlayerUI(){
 const v=$('#vd');if(!v)return;const d=v.duration||0,t=v.currentTime||0;
 const seek=$('#seek');if(seek&&!drag){seek.value=d?String(Math.round(t/d*1000)):0;seek.style.setProperty('--p',(d?t/d*100:0)+'%')}
 const tm=$('#tm');if(tm)tm.textContent=fmt(t)+' / '+fmt(d);
}
function showNextUp(){
 const shell=$('#wp .custom-player');if(!shell)return;
 const next=shell.querySelector('.next-up-card')||document.createElement('div');next.className='next-up-card';
 const isTv=cur.kind==='tv'&&cur.seriesId;
 next.innerHTML=isTv?`<b>Next episode</b><span>Continue with the next episode</span><button class="btn pri" data-next-episode>Play next</button>`:`<b>Finished</b><span>Pick another title from Reelhouse.</span><button class="btn pri" data-player-close>Back to details</button>`;
 shell.appendChild(next);requestAnimationFrame(()=>next.classList.add('on'));
}

async function startFilm(source,title){
 if(!requireSession(()=>startFilm(source,title)))return;
 killPlayer();cur.rt=()=>startFilm(source,title);setSrc('film');
 const u=typeof source==='string'?null:source?.url;
 if(!u)return showErr('This movie is not available as a native video stream right now.');
 if(source?.type==='mp4'||source?.type==='hls'||source?.type==='direct'||source?.type==='video'){
   mountNativeVideo(u,title,source);
   return;
 }
 showErr('This title did not return a native MP4/HLS stream.');
}

async function filmBtns(m,startAfterResolve=false){
 if(cur.m!==m||!$('#src'))return;
 if(!$('#src [data-src="trailer"]'))$('#src').insertAdjacentHTML('afterbegin','<button class="chip" data-src="trailer">Trailer</button>');
 if(!$('#src [data-src="film"]'))$('#src').insertAdjacentHTML('afterbegin','<button class="chip" data-src="film" disabled>Full movie</button>');
 if(startAfterResolve)mount('<div class="source-loading"><div class="source-loader"></div><strong>Loading movie…</strong></div>');
 let source;try{source=await resolveMovieSource(m)}catch{source={status:'coming-soon'}}
 if(cur.m!==m)return;
 const full=$('#src [data-src="film"]');
 if(source.status!=='ready'){
   if(full)full.disabled=true;
   if(startAfterResolve)showErr('This movie could not be played right now.');
   return;
 }
 cur.source=source;cur.film=source.identifier||null;
 if(full){full.disabled=false;full.classList.add('on')}
 const d=$('#dlb');
 if(d&&isNativeReelhouse()){d.hidden=false;d.dataset.dl='native';d.dataset.native='1';d.dataset.t=m.title;d.disabled=!canDownloadNativeSource(source);d.title=canDownloadNativeSource(source)?'Save this MP4 privately in the Reelhouse app':'Downloads require a direct MP4 stream'}
 const p=$('.poster');if(p&&!p.querySelector('.big'))p.insertAdjacentHTML('beforeend',`<button class="big" data-startp aria-label="Play">${I.play}</button>`);
 if(startAfterResolve)startFilm(source,titleOf(m));
}
async function openSeriesDetail(id,auto){
 killPlayer();const tok=cur.tok=(cur.tok||0)+1,box=$('#modal');box.classList.add('on');document.body.style.overflow='hidden';box.scrollTop=0;box.innerHTML=skelPage();
 cur.mode='none';cur.film=null;cur.tr=null;cur.rt=()=>openSeriesDetail(id,auto);
 let m;try{m=await api('/tv/'+id,{append_to_response:'credits,similar,videos'})}catch{}
 if(cur.tok!==tok)return;
 if(!m){box.innerHTML=`<div class="wpg"><div class="wp">${topbar}</div><div class="wi"><p class="mt" style="margin-bottom:12px">Could not load this series. Check your connection.</p><button class="btn" data-retry>Retry</button></div></div>`;return}
 cur.m=m;cur.tr=null;cur.kind='tv';cur.seriesId=id;cur.season=m.seasons?.find(s=>s.season_number>0)?.season_number??0;
 const cast=(m.credits?.cast||[]).slice(0,14).map(c=>`<button class="cm" data-person="${c.id}">${c.profile_path?`<img loading="lazy" src="${IMG}w185${c.profile_path}" alt="">`:`<div>${esc((c.name||'?')[0])}</div>`}<b>${esc(c.name)}</b><small>${esc(c.character||'')}</small></div>`).join('');
 const bg=m.backdrop_path?IMG+'w780'+m.backdrop_path:m.poster_path?IMG+'w500'+m.poster_path:'';
 const isS=has('list',m.id),isF=has('fav',m.id);
 box.innerHTML=`<div class="wpg series-page"><div class="wp" id="wp"><div class="poster" style="background-image:url(${bg})"><button class="big" data-startp aria-label="Play series">${I.play}</button></div>${topbar}</div>
 <div class="wi"><div class="series-kicker">SERIES</div><h1>${esc(titleOf(m))}</h1>${m.tagline?`<div class="tg">${esc(m.tagline)}</div>`:''}
 <div class="wm"><span class="rt">${I.star}${(m.vote_average||0).toFixed(1)}</span><span>${yr(m)}</span><span>${m.number_of_seasons||0} seasons</span><span>${m.number_of_episodes||0} episodes</span></div>
 <div class="gs">${(m.genres||[]).map(g=>`<span>${esc(g.name)}</span>`).join('')}</div>
 <div class="src" id="src"><span class="mt nf">Choose how you want to watch.</span></div>
 <div class="acts"><button class="act ${isS?'on':''}" data-tg="list">${isS?I.bmF:I.bm}<span>${isS?'Saved':'Save'}</span></button><button class="act ${isF?'on':''}" data-tg="fav">${isF?I.heartF:I.heart}<span>${isF?'Favorited':'Favorite'}</span></button></div>
 <p class="ovw" id="ovw">${esc(m.overview)||'No overview available.'}</p>
 <div class="season-bar"><label for="seasonSelect">Season</label><select id="seasonSelect">${(m.seasons||[]).filter(s=>s.season_number>=0).map(s=>`<option value="${s.season_number}" ${s.season_number===cur.season?'selected':''}>Season ${s.season_number}${s.episode_count?` · ${s.episode_count} episodes`:''}</option>`).join('')}</select></div>
 <div id="episodes"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div>
 ${cast?`<h3>Cast</h3><div class="cast">${cast}</div>`:''}</div></div>`;
 $('#seasonSelect').onchange=e=>loadSeason(id,+e.target.value);loadSeason(id,cur.season);}
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
 const resumeKey=seriesId+':'+season+':'+episode;const resumeAt=Number(S.prog[resumeKey]||0);
 let source;try{source=await resolveEpisodeSource(ep,season,episode,resumeAt)}catch{source={status:'coming-soon'}}
 const btn=document.querySelector(`[data-episode="${episode}"][data-series="${seriesId}"][data-season="${season}"]`);
 if(source.status!=='ready'){
   if(btn){btn.classList.add('coming');const copy=btn.querySelector('.ep-copy');if(copy&&!copy.querySelector('.source-state'))copy.insertAdjacentHTML('beforeend','<em class="source-state coming">Coming to Reelhouse soon</em>')}
   toast('Coming to Reelhouse soon');
   return;
 }
 cur.source=source;cur.episode=Number(episode);source.progressKey=resumeKey;cur.m=cur.m||ep;startFilm(source,title);
}
async function openDetail(id,auto,kind='movie'){if(kind==='tv')return openSeriesDetail(id,auto);killPlayer();const tok=cur.tok=(cur.tok||0)+1,box=$('#modal');
 box.classList.add('on');document.body.style.overflow='hidden';box.scrollTop=0;box.innerHTML=skelPage();cur.mode='none';cur.film=null;cur.tr=null;cur.rt=()=>openDetail(id,auto);
 let m;try{m=await api('/movie/'+id,{append_to_response:'credits,similar,videos'})}catch{}
 if(cur.tok!==tok)return;
 if(!m){box.innerHTML=`<div class="wpg"><div class="wp">${topbar}</div><div class="wi"><p class="mt" style="margin-bottom:12px">Could not load this movie. Check your connection.</p><button class="btn" data-retry>Retry</button></div></div>`;return}
 cur.m=m;cur.tr=null;
 const cast=m.credits.cast.slice(0,14).map(c=>`<div class="cm">${c.profile_path?`<img loading="lazy" src="${IMG}w185${c.profile_path}" alt="">`:`<div>${esc(c.name[0])}</div>`}<b>${esc(c.name)}</b><small>${esc(c.character)}</small></div>`).join('');
 const dir=m.credits.crew.find(c=>c.job==='Director'),bg=m.backdrop_path?IMG+'w780'+m.backdrop_path:m.poster_path?IMG+'w500'+m.poster_path:'';
 const isS=has('list',m.id),isF=has('fav',m.id),rel=m.similar.results.filter(x=>x.poster_path);
 box.innerHTML=`<div class="wpg"><div class="wp" id="wp"><div class="poster" style="background-image:url(${bg})"><button class="big" data-startp aria-label="Play full movie">${I.play}</button></div>${topbar}</div>
 <div class="wi"><h1>${esc(m.title)}</h1>${m.tagline?`<div class="tg">${esc(m.tagline)}</div>`:''}
 <div class="wm"><span class="rt">${I.star}${m.vote_average.toFixed(1)}</span><span>${yr(m)}</span>${m.runtime?`<span>${Math.floor(m.runtime/60)}h ${m.runtime%60}m</span>`:''}${dir?`<span>${esc(dir.name)}</span>`:''}</div>
 <div class="gs">${m.genres.map(g=>`<span>${esc(g.name)}</span>`).join('')}</div>
 <div class="src" id="src"><span class="mt nf">Choose how you want to watch.</span></div>
 <div class="acts"><button class="act ${isS?'on':''}" data-tg="list">${isS?I.bmF:I.bm}<span>${isS?'Saved':'Save'}</span></button><button class="act ${isF?'on':''}" data-tg="fav">${isF?I.heartF:I.heart}<span>${isF?'Favorited':'Favorite'}</span></button><button class="act" id="dlb" data-dl="" hidden>${I.dl}<span>Download</span></button></div>
 <p class="ovw" id="ovw">${esc(m.overview)||'No overview available.'}</p>${(m.overview||'').length>140?'<button class="more2" data-more>More</button>':''}
 ${cast?`<h3>Cast</h3><div class="cast">${cast}</div>`:''}
 ${rel.length?`<h3>More like this</h3><div class="sc sm">${rel.map(card).join('')}</div>`:''}</div></div>`;
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
async function startNativeDownload(){if(!isNativeReelhouse())return toast('Movie downloads are available in the Reelhouse app only.');const source=cur.source;if(!source)return toast('Play the movie once before downloading.');if(!canDownloadNativeSource(source))return toast('This title returned HLS, not a direct downloadable video file.');const button=$('#dlb');if(button){button.disabled=true;button.innerHTML=I.dl+'<span>Downloading…</span>';}addInbox({key:'download-start:'+String(cur.m?.id||Date.now()),title:'Download started',body:titleOf(cur.m||{})+' is downloading.',url:'#/list'});try{const item=await downloadNativeMovie({source,title:titleOf(cur.m||{}),season:cur.kind==='tv'?cur.season:null,episode:cur.kind==='tv'?cur.episode:null,onProgress:p=>{if(button&&p.percent!=null)button.innerHTML=I.dl+'<span>Downloading '+p.percent+'%</span>'}});nativeDownloads=getNativeDownloads();addInbox({key:'download-done:'+item.id,title:'Download complete',body:item.title+' is ready offline.',url:'#/list'});toast('Download complete');if(button){button.disabled=false;button.innerHTML=I.dl+'<span>Downloaded</span>'}}catch(e){toast(e?.message||'Download failed');if(button){button.disabled=false;button.innerHTML=I.dl+'<span>Download</span>'}}}
async function shareNativeById(id){const item=getNativeDownloads().find(x=>x.id===id);if(!item)return toast('Downloaded file not found.');try{await shareNativeDownload(item)}catch(e){toast(e?.message||'Could not share that file.')}}
async function openNativeById(id){const item=getNativeDownloads().find(x=>x.id===id);if(!item)return toast('Downloaded file not found.');try{const uri=await openNativeDownload(item);startFilm({url:uri,type:'mp4'},item.title)}catch{toast('Could not open that download.')}}
async function deleteNativeById(id){const item=getNativeDownloads().find(x=>x.id===id);if(!item)return;try{await deleteNativeDownload(item);nativeDownloads=getNativeDownloads();mylist();toast('Download removed')}catch{toast('Could not remove download')}}
function addReleaseReminder(title,date,overview){if(!date)return;if(isNativeReelhouse()){LocalNotifications.requestPermissions().then(async p=>{if(p.display!=='granted')throw new Error('Notification permission denied');await LocalNotifications.schedule({notifications:[{id:Math.floor(Math.random()*100000000),title:'Release day: '+title,body:'Your Reelhouse watch is ready.',schedule:{at:new Date(date+'T09:00:00')},extra:{url:'#/home'}}]});toast('Release reminder set');}).catch(()=>downloadCalendarFile(title,date,overview));}else downloadCalendarFile(title,date,overview)}
function downloadCalendarFile(title,date,overview){const blob=new Blob([makeCalendarEvent({title,releaseDate:date,overview})],{type:'text/calendar'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/[^a-z0-9]+/gi,'-')+'-release.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Calendar reminder file created')}
function toggleAct(el){const k=el.dataset.tg,on=toggle(k,cur.m);el.classList.toggle('on',on);
 el.innerHTML=(k==='list'?(on?I.bmF:I.bm):(on?I.heartF:I.heart))+`<span>${k==='list'?(on?'Saved':'Save'):(on?'Favorited':'Favorite')}</span>`;if(location.hash==='#/list')mylist()}
const modal=$('#modal');
modal.addEventListener('input',e=>{const t=e.target;if(!yp)return;if(t.id==='seek'){drag=true;t.style.setProperty('--p',t.value/10+'%')}if(t.id==='vol'){yp.setVolume(+t.value);t.style.setProperty('--p',t.value+'%')}});
modal.addEventListener('change',e=>{if(e.target.id==='seek'&&yp){yp.seekTo(yp.getDuration()*e.target.value/1000,true);drag=false}});
modal.addEventListener('click',e=>{
 const t=e.target;
 if(t.closest('#back10')){yp?.seekTo(Math.max(0,(yp.getCurrentTime()||0)-10),true);wake();return}
 if(t.closest('#fwd10')){yp?.seekTo(Math.min(yp.getDuration()||Infinity,(yp.getCurrentTime()||0)+10),true);wake();return}
 if(t.closest('#pp')){toggleP();wake();return}
 if(t.closest('#mu')){if(yp?.isMuted())yp.unMute();else yp?.mute();t.closest('#mu').innerHTML=yp?.isMuted()?I.mute:I.vol;return}
 if(t.closest('#spd')){const rates=[.75,1,1.25,1.5,1.75,2],now=yp?.getPlaybackRate?.()||1,next=rates[(rates.indexOf(now)+1)%rates.length];yp?.setPlaybackRate(next);t.closest('#spd').textContent=next+'×';toast('Speed '+next+'×');return}
 if(t.closest('#pip')){const v=$('#vd');if(v?.requestPictureInPicture) v.requestPictureInPicture().catch(()=>toast('Picture-in-picture is unavailable here'));return}
 if(t.closest('#fs')){const target=$('#wp .custom-player');if(!document.fullscreenElement)target?.requestFullscreen?.();else document.exitFullscreen?.();return}
 if(t.closest('#playerCinema')){$('#wp .custom-player')?.classList.toggle('cinema-mode');return}
 if(t.closest('#playerLock')){$('#wp .custom-player')?.classList.toggle('controls-locked');return}
 if(t.closest('#playerSleep')){const mins=[0,15,30,60],curM=Number(localStorage.getItem('rh:sleep')||0),next=mins[(mins.indexOf(curM)+1)%mins.length];localStorage.setItem('rh:sleep',String(next));clearTimeout(cur.sleep);toast(next?'Sleep timer: '+next+' min':'Sleep timer off');if(next){cur.sleep=setTimeout(()=>{yp?.pauseVideo();toast('Sleep timer paused playback')},next*60000)}return}
 if(t.closest('[data-resume]')){const card=t.closest('.resume-card'),at=Number(card?.dataset.resumeAt||0);if(yp&&at)yp.seekTo(at,true);card?.remove();return}
 if(t.closest('[data-start-over]')){if(yp){yp.seekTo(0,true);yp.playVideo()};t.closest('.resume-card')?.remove();return}
 if(t.closest('[data-player-close]')){closeDetail();return}
 if(t.closest('[data-next-episode]')&&cur.kind==='tv'){const next=(Number(cur.episode||0)+1);playEpisode(cur.seriesId,cur.season,next);return}
});

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
 const ns=t.closest('[data-native-share]');if(ns){shareNativeById(ns.dataset.nativeShare);return}
 const no=t.closest('[data-native-open]');if(no){openNativeById(no.dataset.nativeOpen);return}
 const nd=t.closest('[data-native-delete]');if(nd){deleteNativeById(nd.dataset.nativeDelete);return}
 const ur=t.closest('[data-upcoming-id]');if(ur){addReleaseReminder(ur.dataset.upcomingTitle,ur.dataset.upcomingDate,ur.dataset.upcomingOverview);return}
 const pe=t.closest('[data-person]');if(pe){location.hash='#/person/'+pe.dataset.person;return}
 const tg=t.closest('[data-tg]');if(tg&&cur.m&&!cur.m.ia){toggleAct(tg);return}
 const mo=t.closest('[data-more]');if(mo){const o=$('#ovw');o.classList.toggle('open');mo.textContent=o.classList.contains('open')?'Less':'More';return}
 if(t.closest('[data-close]')){closeDetail();return}
 if(t.closest('[data-retry]')){cur.rt&&cur.rt();return}
 const tb=t.closest('[data-tab]');if(tb){tab=tb.dataset.tab;mylist();return}
 const sub=t.closest('[data-sub]');if(sub){const active=sub.classList.toggle('on');if(active&&document.querySelectorAll('[data-sub].on').length>3)sub.classList.remove('on');return}
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
renderNotificationBadge();
openWelcome();
document.addEventListener('click',e=>{
 const t=e.target;
 if(t.closest('[data-open-notifications]')){openNotifications();return}
 if(t.closest('[data-notifications-close]')){closeNotifications();return}
 if(t.closest('[data-notifications-clear]')){store.set(INBOX_KEY,inbox().map(x=>({...x,read:true})));renderNotificationBadge();openNotifications();return}
 const n=t.closest('[data-notification-key]');if(n){store.set(INBOX_KEY,inbox().map(x=>x.key===n.dataset.notificationKey?{...x,read:true}:x));renderNotificationBadge();closeNotifications();if(n.dataset.notificationUrl)location.hash=n.dataset.notificationUrl;return}
 if(t.closest('[data-welcome-close],[data-welcome-enter]')){closeWelcome();setTimeout(openIndependence,450);return}
 if(t.closest('[data-independence-close]')){closeIndependence();return}
 if(t.closest('[data-player-cinema]')){const wp=$('#wp');wp?.classList.toggle('cinema-focus');return}

});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='REELHOUSE_NOTIFICATION_CLICK'){const u=e.data.url||'#/home';location.hash=u;closeNotifications()}});
let notifTimer=null;
function startNotificationMonitor(){clearInterval(notifTimer);const ns=notificationState();if(ns.enabled&&'Notification' in window&&Notification.permission==='granted'){checkMovieNotifications(false);notifTimer=setInterval(()=>checkMovieNotifications(false),30*60*1000)}}
seedNotifications();renderNotificationBadge();startNotificationMonitor();setTimeout(openIndependence,900);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)startNotificationMonitor()});

}
