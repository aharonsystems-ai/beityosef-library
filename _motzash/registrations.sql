-- ════════════════════════════════════════════════════════════════
-- מעבר ההרשמות/פניות מ-Netlify Forms ל-Supabase — ספריית בית יוסף
-- להריץ ב-Supabase → SQL Editor → Run, לפני מיזוג ענף motzash-prep ל-main.
-- מסתמך על הפונקציה is_mgr() הקיימת (קוראת את ה-header x-mgr-token).
-- עיקרון פרטיות: כל אחד יכול להגיש (INSERT), אך רק מנהל (is_mgr) קורא/עורך.
-- ════════════════════════════════════════════════════════════════

-- ── טבלת חברים (הרשמות) ──
create table if not exists public.members (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text,
  phone       text,
  branch      text,
  note        text,
  status      text default 'ממתין',
  created_at  timestamptz default now()
);
alter table public.members enable row level security;

-- INSERT לכולם (הרשמה ציבורית)
drop policy if exists members_insert_anon on public.members;
create policy members_insert_anon on public.members
  for insert to anon, authenticated with check (true);

-- קריאה/עדכון/מחיקה — מנהל בלבד (דרך header x-mgr-token שנבדק ב-is_mgr)
drop policy if exists members_read_mgr on public.members;
create policy members_read_mgr on public.members
  for select to anon, authenticated using (public.is_mgr());
drop policy if exists members_update_mgr on public.members;
create policy members_update_mgr on public.members
  for update to anon, authenticated using (public.is_mgr()) with check (public.is_mgr());
drop policy if exists members_delete_mgr on public.members;
create policy members_delete_mgr on public.members
  for delete to anon, authenticated using (public.is_mgr());

-- ── טבלת פניות (קשר + בקשות ספר) ──
create table if not exists public.submissions (
  id          bigint generated always as identity primary key,
  kind        text not null,                 -- 'contact' | 'book_request'
  name        text,
  email       text,
  phone       text,
  subject     text,
  message     text,
  book_id     bigint,
  book_title  text,
  status      text default 'חדש',
  created_at  timestamptz default now()
);
alter table public.submissions enable row level security;

drop policy if exists subs_insert_anon on public.submissions;
create policy subs_insert_anon on public.submissions
  for insert to anon, authenticated with check (true);
drop policy if exists subs_read_mgr on public.submissions;
create policy subs_read_mgr on public.submissions
  for select to anon, authenticated using (public.is_mgr());
drop policy if exists subs_update_mgr on public.submissions;
create policy subs_update_mgr on public.submissions
  for update to anon, authenticated using (public.is_mgr()) with check (public.is_mgr());
drop policy if exists subs_delete_mgr on public.submissions;
create policy subs_delete_mgr on public.submissions
  for delete to anon, authenticated using (public.is_mgr());

-- בדיקה מהירה אחרי ההרצה:
--   insert: מהאתר (טופס הרשמה) → אמור להיכנס.
--   select כ-anon רגיל → אמור להחזיר 0 שורות (פרטי).
--   select עם header x-mgr-token תקין → אמור להחזיר את כל השורות.
