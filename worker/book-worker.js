/* ============================================================
 *  ספריית בית יוסף — מנוע דפי ספרים (Cloudflare Worker)
 *  מרנדר דף SEO לכל ספר מהמאגר, בזמן אמת, + sitemap.
 *  מסלולים:
 *    /book/:id[-slug]   → דף ספר בודד
 *    /sitemap.xml       → אינדקס מפת אתר
 *    /sitemap/:n.xml    → מפת משנה (1000 ספרים כל אחת)
 *    /robots.txt        → הפניה למפת האתר
 * ============================================================ */

const SB_URL = 'https://ugixnimesxjpjaqddtys.supabase.co';
const SB_KEY = 'sb_publishable_v3ATiJW2kIJhenMMZdZKmA_ct6FcyxR';
const SITE = 'ספריית בית יוסף';
const BRANCHES = ["האולם המרכזי – ספריית בית יוסף","סניף 1","סניף 2","סניף 3","סניף 4","סניף 5"];
const MAIN_SITE = 'https://bethyoseflibrary.com';
const PAGE_SIZE = 1000; // לכל sitemap משנה

function sbHeaders() {
  return { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
}
function esc(s) {
  return (s == null ? '' : String(s)).replace(/[<>&"']/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
function slugify(t) {
  return (t || '').toString().trim().replace(/["'״׳]/g, '').replace(/\s+/g, '-').replace(/[^֐-׿A-Za-z0-9\-]/g, '').slice(0, 60);
}
function stripLoc(t) {
  return (t || '').replace(/\s*\((?:ב)?(?:סניף|מדף|חברון|האולם)[^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getBook(id) {
  const r = await fetch(`${SB_URL}/rest/v1/books?id=eq.${encodeURIComponent(id)}&select=id,title,author,description,subject,available,branch,classification&limit=1`, { headers: sbHeaders() });
  if (!r.ok) return null;
  const a = await r.json();
  return a && a[0] ? a[0] : null;
}

function renderBook(b, origin) {
  const title = stripLoc(b.title) || 'ספר';
  const author = (b.author || '').trim();
  const subject = (b.subject || '').trim();
  const cls = b.classification || null;
  const branch = BRANCHES[b.branch] || BRANCHES[0];
  const avail = b.available;
  const desc = (b.description || '').replace(/\s*הספר נמצא[^.]*/g, '').replace(/\s*שם כריכה.*/, '').trim();
  const url = `${MAIN_SITE}/book/${b.id}-${slugify(title)}`;

  const catLine = cls ? (cls.main + (cls.sub ? ' · ' + cls.sub : '')) : subject;
  const pageTitle = `${title}${author ? ' — ' + author : ''} | ${SITE}`;
  const metaDesc = `${title}${author ? ' מאת ' + author : ''}${catLine ? ' (' + catLine + ')' : ''} — נמצא בקטלוג של ${SITE} במודיעין עילית. ${avail ? 'זמין לעיון במקום.' : 'כעת בעיון.'}`.slice(0, 300);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": title,
    "author": author ? { "@type": "Person", "name": author } : undefined,
    "about": catLine || undefined,
    "inLanguage": "he",
    "url": url,
    "offers": {
      "@type": "Offer",
      "availability": avail ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "price": "0",
      "priceCurrency": "ILS",
      "businessFunction": "http://purl.org/goodrelations/v1#LeaseOut"
    },
    "publisher": { "@type": "Organization", "name": SITE }
  };

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="book">
<meta property="og:title" content="${esc(title + (author ? ' — ' + author : ''))}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:site_name" content="${esc(SITE)}">
<meta property="og:locale" content="he_IL">
<meta name="robots" content="index,follow">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@700;800&family=Heebo:wght@400;500;700&display=swap">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
:root{--navy:#1b2a4a;--gold:#b08d3f;--bg:#f6f4ef;--surface:#fff;--ink:#1c2230;--mu:#5f6678;--line:#e4ddce;--ok:#2f6b4f;--ok-bg:#e4efe7;--no:#9a3b2f;--no-bg:#f6e5e2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Heebo",system-ui,sans-serif;line-height:1.6}
.wrap{max-width:720px;margin:0 auto;padding:0 18px 48px}
header{background:var(--navy);color:#fff;padding:14px 0}
.hw{max-width:720px;margin:0 auto;padding:0 18px;display:flex;align-items:center;gap:10px}
.logo{width:34px;height:34px;border-radius:8px;background:var(--gold);color:var(--navy);display:grid;place-items:center;font-family:"Frank Ruhl Libre",serif;font-weight:800;font-size:19px}
.hw b{font-family:"Frank Ruhl Libre",serif;font-size:17px}
.hw small{display:block;font-size:11px;color:#b9c2d6}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px 24px;margin-top:24px;box-shadow:0 2px 14px rgba(0,0,0,.04)}
.eyebrow{font-size:.8rem;letter-spacing:.1em;color:var(--gold);font-weight:700;margin:0 0 8px}
h1{font-family:"Frank Ruhl Libre",serif;color:var(--navy);font-size:clamp(1.6rem,5vw,2.2rem);margin:0 0 6px;line-height:1.15}
.author{font-size:1.1rem;color:var(--mu);margin:0 0 18px}
.pill{display:inline-block;font-size:.85rem;padding:4px 12px;border-radius:999px;font-weight:700}
.pill.y{background:var(--ok-bg);color:var(--ok)}.pill.n{background:var(--no-bg);color:var(--no)}
.meta{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;margin:20px 0 0;font-size:.98rem}
.meta dt{color:var(--mu);font-weight:600}
.meta dd{margin:0;color:var(--ink)}
.desc{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--line);color:var(--ink)}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.btn{text-decoration:none;border-radius:10px;padding:11px 18px;font-weight:700;font-size:.95rem}
.btn.p{background:var(--gold);color:var(--navy)}
.btn.s{background:var(--surface);color:var(--navy);border:1px solid var(--line)}
footer{color:var(--mu);font-size:.85rem;text-align:center;margin-top:28px;line-height:1.7}
footer a{color:var(--navy)}
</style>
</head>
<body>
<header><div class="hw"><div class="logo">ב</div><div><b>${esc(SITE)}</b><small>מודיעין עילית</small></div></div></header>
<div class="wrap">
  <div class="card">
    <p class="eyebrow">ספר בקטלוג הספרייה</p>
    <h1>${esc(title)}</h1>
    ${author ? `<p class="author">${esc(author)}</p>` : ''}
    <span class="pill ${avail ? 'y' : 'n'}">${avail ? '✓ זמין לעיון במקום' : 'כעת בעיון'}</span>
    <dl class="meta">
      ${catLine ? `<dt>סיווג</dt><dd>${esc(catLine)}</dd>` : ''}
      <dt>סניף</dt><dd>${esc(branch)}</dd>
      <dt>מספר בקטלוג</dt><dd>${esc(b.id)}</dd>
    </dl>
    ${desc ? `<div class="desc">${esc(desc)}</div>` : ''}
    <div class="cta">
      <a class="btn p" href="${esc(MAIN_SITE)}/#catalog">חיפוש בקטלוג המלא</a>
      <a class="btn s" href="${esc(MAIN_SITE)}">לאתר הספרייה</a>
    </div>
  </div>
  <footer>
    הספר נמצא בקטלוג של ${esc(SITE)}, ספרייה תורנית במודיעין עילית.<br>
    לעיון במקום · <a href="${esc(MAIN_SITE)}">bethyoseflibrary.com</a>
  </footer>
</div>
</body>
</html>`;
}

function xmlHeader() { return '<?xml version="1.0" encoding="UTF-8"?>\n'; }

async function totalCount() {
  const r = await fetch(`${SB_URL}/rest/v1/books?select=id&limit=1`, { headers: { ...sbHeaders(), Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') || '0-0/0';
  return parseInt(cr.split('/')[1] || '0', 10) || 0;
}

async function renderSitemapIndex(origin) {
  const total = await totalCount();
  const pages = Math.ceil(total / PAGE_SIZE);
  let x = xmlHeader() + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (let i = 0; i < pages; i++) x += `  <sitemap><loc>${origin}/sitemap/${i}.xml</loc></sitemap>\n`;
  x += '</sitemapindex>\n';
  return x;
}

async function renderSitemapPage(origin, n) {
  const r = await fetch(`${SB_URL}/rest/v1/books?select=id,title&order=id&limit=${PAGE_SIZE}&offset=${n * PAGE_SIZE}`, { headers: sbHeaders() });
  if (!r.ok) return null;
  const rows = await r.json();
  let x = xmlHeader() + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const b of rows) x += `  <url><loc>${origin}/book/${b.id}-${slugify(stripLoc(b.title))}</loc><changefreq>monthly</changefreq></url>\n`;
  x += '</urlset>\n';
  return x;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;

    try {
      // robots
      if (path === '/robots.txt') {
        return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      // sitemap index
      if (path === '/sitemap.xml') {
        const x = await renderSitemapIndex(origin);
        return new Response(x, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
      }
      // sitemap page
      let m = path.match(/^\/sitemap\/(\d+)\.xml$/);
      if (m) {
        const x = await renderSitemapPage(origin, parseInt(m[1], 10));
        if (!x) return new Response('not found', { status: 404 });
        return new Response(x, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
      }
      // book page  /book/:id or /book/:id-slug
      m = path.match(/^\/book\/(\d+)(?:-.*)?$/);
      if (m) {
        const b = await getBook(m[1]);
        if (!b) return new Response(notFoundPage(origin), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
        return new Response(renderBook(b, origin), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
      }
      // home -> redirect to main site
      if (path === '/' || path === '') {
        return Response.redirect(MAIN_SITE, 302);
      }
      return new Response(notFoundPage(origin), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    } catch (e) {
      return new Response('שגיאה זמנית, נסו שוב מאוחר יותר.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  }
};

function notFoundPage(origin) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>לא נמצא | ${SITE}</title><meta name="robots" content="noindex"></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px"><h1>הספר לא נמצא</h1><p><a href="${MAIN_SITE}">חזרה לאתר הספרייה</a></p></body></html>`;
}

// ייצוא לבדיקות בלבד (Cloudflare מתעלם מייצוא שאינו default)
export { renderBook, slugify, stripLoc };
