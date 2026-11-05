// גיבוי יומי של כל הספרים מ-Supabase לקובץ JSON בריפו.
// היסטוריית ה-git משמשת כנקודות שחזור (אפשר לחזור לכל מצב קודם).
const SB = 'https://ugixnimesxjpjaqddtys.supabase.co';
const KEY = 'sb_publishable_v3ATiJW2kIJhenMMZdZKmA_ct6FcyxR';
const PAGE = 1000;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

async function fetchAll() {
  let all = [], offset = 0;
  for (;;) {
    const url = `${SB}/rest/v1/books?select=*&order=id.asc&limit=${PAGE}&offset=${offset}`;
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

const books = await fetchAll();
const out = {
  backup_date: new Date().toISOString(),
  count: books.length,
  source: SB,
  books
};
const fs = await import('fs');
fs.writeFileSync('backups/books-latest.json', JSON.stringify(out, null, 1));
console.log('backed up', books.length, 'books');
