// שחזור: קורא גיבוי (backups/books-latest.json) ומייבא אותו חזרה ל-Supabase.
// upsert לפי id — מעדכן/משחזר ספרים קיימים ומוסיף חסרים (לא מוחק ספרים חדשים).
// הרצה: node scripts/restore-books.mjs  (רץ רק דרך workflow עם אישור)
import { readFileSync } from 'fs';
const SB  = 'https://ugixnimesxjpjaqddtys.supabase.co';
const KEY = 'sb_publishable_v3ATiJW2kIJhenMMZdZKmA_ct6FcyxR';
const BATCH = 500;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };

const raw = JSON.parse(readFileSync('backups/books-latest.json', 'utf8'));
const books = Array.isArray(raw) ? raw : raw.books;
if (!Array.isArray(books) || !books.length) throw new Error('אין ספרים בקובץ הגיבוי');
console.log('משחזר', books.length, 'ספרים (גובו בתאריך ' + (raw.backup_date || '?') + ')');

// רק עמודות המאגר — בלי שדות נוספים אם יש
const cols = ['id','title','author','description','subject','available','branch','classification','details','card_type'];
const clean = books.map(b => { const o = {}; cols.forEach(c => { if (b[c] !== undefined) o[c] = b[c]; }); return o; });

let done = 0, failed = 0;
for (let i = 0; i < clean.length; i += BATCH) {
  const chunk = clean.slice(i, i + BATCH);
  const r = await fetch(SB + '/rest/v1/books', { method: 'POST', headers: H, body: JSON.stringify(chunk) });
  if (r.ok) { done += chunk.length; }
  else { failed += chunk.length; console.error('batch at', i, '->', r.status, (await r.text()).slice(0,200)); }
}
console.log('הושלם: שוחזרו', done, 'ספרים, נכשלו', failed);
if (failed) process.exit(1);
