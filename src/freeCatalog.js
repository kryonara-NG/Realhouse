const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_META = 'https://archive.org/metadata/';
const MAX_TITLES = 100;
const RECENT_FROM = 2015;

let mounted = false;
let cachedTitles = null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yearOf = (x) => String(x?.year || x?.date || '').slice(0, 4) || '—';

function css() {
  if (document.getElementById('rh-free-direct-style')) return;
  const s = document.createElement('style');
  s.id = 'rh-free-direct-style';
  s.textContent = `
    .rh-free-direct-note{font-size:12px;color:var(--mute,#777);margin:-8px 0 14px;max-width:760px;line-height:1.5}
    .rh-free-direct-card{position:relative;flex:0 0 156px;min-width:156px}
    .rh-free-direct-card .card{display:block}
    .rh-free-direct-trailer{position:absolute;right:7px;bottom:54px;border:0;border-radius:999px;padding:6px 9px;background:#000;color:#fff;font:600 10px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 10px #0005}
    .rh-free-direct-trailer:hover{transform:translateY(-1px)}
    .rh-free-direct-source{font-size:10px;opacity:.7;margin-top:4px;display:block}
    .rh-free-direct-modal{position:fixed;inset:0;z-index:100000;background:#000e;display:flex;align-items:center;justify-content:center;padding:18px}
    .rh-free-direct-modal[hidden]{display:none}
    .rh-free-direct-panel{width:min(1100px,100%);background:#050505;color:#fff;border:1px solid #333;border-radius:18px;overflow:hidden;box-shadow:0 20px 80px #000}
    .rh-free-direct-panel video{display:block;width:100%;max-height:76vh;background:#000}
    .rh-free-direct-head{display:flex;align-items:center;gap:12px;padding:12px 14px}
    .rh-free-direct-head strong{flex:1;font:600 14px/1.3 system-ui,sans-serif}
    .rh-free-direct-close{border:1px solid #444;background:#111;color:#fff;border-radius:999px;padding:7px 11px;cursor:pointer}
    .rh-free-direct-meta{padding:0 14px 14px;color:#aaa;font:11px/1.4 system-ui,sans-serif}
  `;
  document.head.appendChild(s);
}

async function searchArchive(query, rows = 150) {
  const u = new URL(IA_SEARCH);
  u.searchParams.set('q', query);
  ['identifier','title','year','date','description','creator','licenseurl','rights','downloads'].forEach(f => u.searchParams.append('fl[]', f));
  u.searchParams.set('rows', String(rows));
  u.searchParams.append('sort[]', 'downloads');
  u.searchParams.append('sort[]', 'asc');
  u.searchParams.set('output', 'json');
  const r = await fetch(u.href);
  if (!r.ok) throw new Error('Internet Archive search failed: ' + r.status);
  return (await r.json())?.response?.docs || [];
}

function rightsCleared(x) {
  const license = String(x?.licenseurl || '').toLowerCase();
  const rights = String(x?.rights || '').toLowerCase();
  return rights.includes('public domain') ||
    license.includes('creativecommons.org/licenses/') ||
    license.includes('creativecommons.org/publicdomain/');
}

function normalize(docs) {
  const seen = new Set();
  return docs.filter(x => {
    const id = String(x?.identifier || '');
    if (!id || seen.has(id) || !x?.title || !rightsCleared(x)) return false;
    if (id.includes('item') && !x.title) return false;
    seen.add(id);
    return true;
  }).slice(0, MAX_TITLES);
}

async function getTitles() {
  if (cachedTitles) return cachedTitles;

  // First pass favors newer rights-cleared films. The second pass fills the
  // shelf with obscure legal archive films when the recent pool is smaller.
  const recentQ = `mediatype:movies AND year:[${RECENT_FROM} TO 2026] AND (licenseurl:* OR rights:"Public Domain")`;
  const broadQ = 'mediatype:movies AND (licenseurl:* OR rights:"Public Domain")';

  const [recent, broad] = await Promise.all([
    searchArchive(recentQ, 180).catch(() => []),
    searchArchive(broadQ, 220).catch(() => [])
  ]);

  cachedTitles = normalize([
    ...recent,
    ...broad.filter(x => !recent.some(r => r.identifier === x.identifier))
  ]);

  return cachedTitles;
}

function card(x) {
  const id = esc(x.identifier);
  const title = esc(x.title);
  const year = esc(yearOf(x));
  return `
    <div class="rh-free-direct-card">
      <a class="card" tabindex="0" role="button" data-ia="${id}" data-t="${title}">
        <i class="f">DIRECT</i>
        <img loading="lazy" decoding="async" src="https://archive.org/services/img/${id}" alt="">
        <div class="m"><b>${title}</b><span>${year} · Free file</span></div>
      </a>
      <button class="rh-free-direct-trailer" type="button" data-free-trailer="${id}" data-free-title="${title}">Trailer</button>
    </div>`;
}

function ensureModal() {
  if (document.getElementById('rh-free-direct-modal')) return;
  const el = document.createElement('div');
  el.id = 'rh-free-direct-modal';
  el.className = 'rh-free-direct-modal';
  el.hidden = true;
  el.innerHTML = `
    <div class="rh-free-direct-panel" role="dialog" aria-modal="true" aria-labelledby="rh-free-direct-title">
      <div class="rh-free-direct-head">
        <strong id="rh-free-direct-title">Trailer</strong>
        <button class="rh-free-direct-close" type="button" data-free-close>Close</button>
      </div>
      <video id="rh-free-direct-video" controls playsinline preload="metadata"></video>
      <div class="rh-free-direct-meta" id="rh-free-direct-meta"></div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-free-close]')) closeTrailer();
  });
}

function closeTrailer() {
  const modal = document.getElementById('rh-free-direct-modal');
  const video = document.getElementById('rh-free-direct-video');
  if (!modal) return;
  video?.pause();
  if (video) { video.removeAttribute('src'); video.load(); }
  modal.hidden = true;
}

function videoFiles(metadata) {
  return (metadata?.files || []).filter(f =>
    /\\.(mp4|m4v|webm|ogv)(?:$|\\?)/i.test(String(f?.name || ''))
  );
}

function pickTrailer(metadata) {
  const files = videoFiles(metadata);
  const trailer = files.find(f => /trailer|teaser|preview/i.test(String(f.name || '')));
  if (!trailer) return null;
  const name = String(trailer.name || '').split('/').map(encodeURIComponent).join('/');
  return 'https://archive.org/download/' + encodeURIComponent(String(metadata?.metadata?.identifier || '')) + '/' + name;
}

async function playTrailer(id, title) {
  ensureModal();
  const modal = document.getElementById('rh-free-direct-modal');
  const video = document.getElementById('rh-free-direct-video');
  const label = document.getElementById('rh-free-direct-title');
  const meta = document.getElementById('rh-free-direct-meta');
  label.textContent = title || 'Trailer';
  meta.textContent = 'Looking for a trailer/preview file in the same Internet Archive item…';
  modal.hidden = false;

  try {
    const r = await fetch(IA_META + encodeURIComponent(id));
    if (!r.ok) throw new Error('metadata ' + r.status);
    const d = await r.json();
    const url = pickTrailer(d);
    if (!url) {
      meta.textContent = 'No separate trailer file was published with this title. You can close this and play the full direct movie.';
      return;
    }
    video.src = url;
    meta.textContent = 'Trailer/preview file from the same archive item.';
    await video.play().catch(() => {});
  } catch {
    meta.textContent = 'The trailer could not be loaded. The full movie may still be available.';
  }
}

async function render() {
  if (location.hash && !location.hash.startsWith('#/home')) return;
  const rows = document.querySelector('.rows');
  if (!rows) return;

  css();
  ensureModal();

  let section = document.getElementById('rh-free-direct-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'rh-free-direct-section';
    section.className = 'row';
    section.innerHTML = `
      <h2>100 free direct movies</h2>
      <p class="rh-free-direct-note">
        Direct video files from Internet Archive items whose indexed metadata declares
        Public Domain or a Creative Commons license. This bypasses VidSrc. Availability
        and rights metadata can change, so verify the item license before commercial redistribution.
      </p>
      <div class="rw">
        <button class="arr l" aria-label="Scroll left">‹</button>
        <div class="sc" id="rh-free-direct-sc"><div class="sk"></div></div>
        <button class="arr r" aria-label="Scroll right">›</button>
      </div>`;
    rows.insertBefore(section, rows.children[2] || null);

    section.querySelector('.arr.l').onclick = () => section.querySelector('.sc').scrollBy({left:-700,behavior:'smooth'});
    section.querySelector('.arr.r').onclick = () => section.querySelector('.sc').scrollBy({left:700,behavior:'smooth'});
  }

  const box = document.getElementById('rh-free-direct-sc');
  if (!box || box.dataset.loaded) return;

  try {
    const titles = await getTitles();
    box.innerHTML = titles.map(card).join('') || '<p class="empty">No rights-cleared direct movies were found.</p>';
    box.dataset.loaded = '1';
  } catch {
    box.innerHTML = '<p class="empty">Free direct movies could not load right now.</p>';
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-free-trailer]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  playTrailer(b.dataset.freeTrailer, b.dataset.freeTitle);
});

export function mountFreeDirectCatalog() {
  if (mounted) return;
  mounted = true;
  const run = () => setTimeout(render, 250);
  run();
  window.addEventListener('hashchange', run);
}
