const GENRE_ALIASES = {"28":"Action","12":"Adventure","16":"Animation","35":"Comedy","80":"Crime","99":"Documentary","18":"Drama","10751":"Family","14":"Fantasy","36":"History","27":"Horror","10402":"Music","9648":"Mystery","10749":"Romance","878":"Science Fiction","10770":"TV Movie","53":"Thriller","10752":"War","37":"Western"};

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
    "access-control-allow-origin":"*",
    "access-control-allow-methods":"GET, OPTIONS",
    "access-control-allow-headers":"Content-Type"
  }});
}
function limitOf(v){const n=Number(v||20);return Math.min(40,Math.max(1,Number.isFinite(n)?Math.floor(n):20));}
function movie(row){return {...row,media_type:"movie",adult:false,backdrop_path:null,genre_ids:String(row.genres||"").split(/[,|]/).map(s=>s.trim()).filter(Boolean).map(s=>/^\d+$/.test(s)?Number(s):s)};}

async function search(env,url){
  const q=(url.searchParams.get("q")||"").trim();
  if(!q)return json({page:1,total_pages:0,total_results:0,results:[],source:"kaggle-tmdb"});
  const limit=limitOf(url.searchParams.get("limit")),like="%"+q+"%";
  const r=await env.DB.prepare("SELECT id,title,original_title,release_date,vote_average,vote_count,popularity,genres,poster_path,imdb_id,original_language FROM movies WHERE title LIKE ? COLLATE NOCASE OR original_title LIKE ? COLLATE NOCASE ORDER BY popularity DESC,vote_count DESC LIMIT ?").bind(like,like,limit).all();
  const rows=(r.results||[]).map(movie);
  return json({page:1,total_pages:rows.length?1:0,total_results:rows.length,results:rows,source:"kaggle-tmdb"});
}
async function discover(env,url){
  const page=Math.max(1,Number(url.searchParams.get("page")||1)||1),limit=limitOf(url.searchParams.get("limit")),offset=(page-1)*limit;
  const genre=(url.searchParams.get("genre")||"").trim(),year=(url.searchParams.get("year")||"").trim(),min=Number(url.searchParams.get("min_rating")||0);
  const where=[],params=[];
  if(genre){where.push("genres LIKE ?");params.push("%"+(GENRE_ALIASES[genre]||genre)+"%");}
  if(/^\d{4}$/.test(year)){where.push("release_date LIKE ?");params.push(year+"%");}
  if(Number.isFinite(min)&&min>0){where.push("vote_average >= ?");params.push(min);}
  const order=({rating:"vote_average DESC,vote_count DESC",votes:"vote_count DESC,vote_average DESC",newest:"release_date DESC,popularity DESC",popularity:"popularity DESC,vote_count DESC"})[url.searchParams.get("sort")||"popularity"]||"popularity DESC,vote_count DESC";
  const sql="SELECT id,title,original_title,release_date,vote_average,vote_count,popularity,genres,poster_path,imdb_id,original_language FROM movies "+(where.length?"WHERE "+where.join(" AND "):"")+" ORDER BY "+order+" LIMIT ? OFFSET ?";
  const r=await env.DB.prepare(sql).bind(...params,limit,offset).all();
  const rows=(r.results||[]).map(movie);
  return json({page,total_pages:rows.length===limit?page:page,total_results:rows.length,results:rows,source:"kaggle-tmdb"});
}
export default {async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"Content-Type"}});
  const url=new URL(request.url);
  try{
    if(url.pathname==="/api/catalog/health"){const r=await env.DB.prepare("SELECT COUNT(*) AS count FROM movies").first();return json({ok:true,source:"kaggle-tmdb",rows:Number(r?.count||0),database:"cloudflare-d1"});}
    if(url.pathname==="/api/catalog/search")return search(env,url);
    if(url.pathname==="/api/catalog/discover")return discover(env,url);
    return json({error:"Not found"},404);
  }catch(error){return json({error:"Catalog query failed",detail:String(error?.message||error)},500);}
}};
