// מחולל catalog.js לאתר הציבורי מתוך Supabase.
// רץ אוטומטית כל לילה (GitHub Actions) — כך שברגע שהמנהל מייבא קטלוג מעודכן
// עם סיווג/תת-סיווג/תת-תת, האתר הציבורי מתעדכן לבד והסינון הדינמי מציג את כל הרמות.
//
// מבנה שורה בקטלוג הציבורי: [id, שם, מחבר, תיאור, נתיב-קטגוריה, זמין(1/0), אינדקס-סניף]
// נתיב-קטגוריה = "ראשי > קטגוריה > תת-תת" (מורכב מ-classification), או subject כגיבוי.
//
// הגנה: אם Supabase יחזיר פחות מ-90% מכמות הספרים הקיימת בקובץ — נעצור ולא נדרוס,
// כדי שייבוא חלקי/כושל לעולם לא ימחק את הקטלוג החי.

import fs from 'fs';

const SB = 'https://ugixnimesxjpjaqddtys.supabase.co';
const KEY = 'sb_publishable_v3ATiJW2kIJhenMMZdZKmA_ct6FcyxR';
const PAGE = 1000;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const OUT = 'catalog.js';

function prevCount() {
  try {
    const s = fs.readFileSync(OUT, 'utf8');
    const m = s.match(/\],\[/g);
    return m ? m.length + 1 : 0;
  } catch { return 0; }
}

function catPath(b) {
  const c = b.classification;
  if (c && c.main) return [c.main, c.sub, c.sub2].filter(Boolean).join(' > ');
  return b.subject || '';
}

async function fetchAll() {
  let all = [], offset = 0;
  for (;;) {
    const url = `${SB}/rest/v1/books?select=id,title,author,description,subject,classification,available,branch,card_type,details&order=id.asc&limit=${PAGE}&offset=${offset}`;
    const r = await fetch(url, { headers: H });
    if (!r.ok) throw new Error('Supabase ' + r.status + ' at offset ' + offset);
    const rows = await r.json();
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
    if (offset > 500000) throw new Error('safety stop');
  }
  return all;
}

const prev = prevCount();
const books = await fetchAll();
console.log('fetched', books.length, 'books (previous catalog had', prev + ')');

if (prev > 0 && books.length < prev * 0.9) {
  throw new Error(`refusing to overwrite: got ${books.length} rows but existing catalog has ${prev} (<90%). Aborting to protect the live catalog.`);
}

const rows = books.map(b => [
  b.id,
  b.title || '',
  b.author || '',
  b.description || '',
  catPath(b),
  b.available ? 1 : 0,
  (typeof b.branch === 'number' ? b.branch : 0),
  (typeof b.card_type === 'number' ? b.card_type : 0),
  (b.details && b.details.parent) ? b.details.parent : '',
  (b.details && (b.details.titles || b.details.authors))
    ? [].concat(b.details.titles || [], b.details.authors || []).join(' ') : ''
]);

fs.writeFileSync(OUT, 'var CAT_RAW=' + JSON.stringify(rows) + ';');
console.log('wrote', OUT, 'with', rows.length, 'books');
