// Cloudflare Pages Function — /scan-book
// מקבל צילומי ספר (כריכה/הקדמה/תוכן) ומחזיר פרטי ספר מזוהים כ-JSON.
// מאובטח: נדרש טוקן מנהל תקף (נבדק מול Supabase is_mgr).
// תומך Anthropic (ברירת מחדל) או OpenAI — לפי משתני סביבה.

const SB_URL = 'https://ugixnimesxjpjaqddtys.supabase.co';
const SB_KEY = 'sb_publishable_v3ATiJW2kIJhenMMZdZKmA_ct6FcyxR';

async function isManager(token) {
  if (!token) return false;
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/is_mgr', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
                 'Content-Type': 'application/json', 'x-mgr-token': token },
      body: '{}'
    });
    return (await r.json()) === true;
  } catch { return false; }
}

function buildPrompt(categories) {
  const cats = (categories && categories.length) ? categories.join(', ')
    : 'תנ"ך, ש"ס, ירושלמי, מדרשים, רמב"ם, ראשונים, שולחן ערוך, מוסר ומחשבה, תפילה, קבלה, חסידות, פרשת שבוע, ספרי ילדים, כללי';
  return [
    'אתה ספרן מומחה בספרי קודש. לפניך צילומים של ספר (כריכה, ושער/הקדמה/תוכן עניינים אם צורפו).',
    'חלץ את פרטי הספר וסווג אותו. החזר JSON תקין בלבד, בלי טקסט נוסף ובלי סימוני markdown.',
    'מבנה:',
    '{',
    '  "title": "השם הראשי של הספר",',
    '  "titles": ["שמות נוספים אם יש"],',
    '  "author": "שם המחבר הראשי",',
    '  "authors": ["מחברים נוספים אם יש"],',
    '  "honor": "תואר המחבר אם מופיע (הגאון/רבי…)",',
    '  "subtitle": "שם משנה אם יש",',
    '  "publisher": "הוצאה/מו\\"ל אם מופיע",',
    '  "year": "שנת הדפסה אם מופיעה",',
    '  "description": "משפט-שניים: על מה הספר ומה תוכנו",',
    '  "classification": { "main": "קטגוריה ראשית מתוך הרשימה", "sub": "תת-קטגוריה (מסכת/חלק/ספר) אם ידוע", "sub2": "רמה 3 אם ידוע" },',
    '  "confidence": 0.0',
    '}',
    'קטגוריה ראשית ("main") חייבת להיות אחת מתוך: ' + cats + '.',
    'ל-ש"ס/ירושלמי/ראשונים — "sub" היא שם המסכת. לשולחן ערוך — החלק (אורח חיים/יורה דעה/אבן העזר/חושן משפט).',
    'אם פרט לא ידוע — השאר מחרוזת ריקה או מערך ריק. אל תמציא. "confidence" בין 0 ל-1 לפי בהירות הצילום.'
  ].join('\n');
}

async function callAnthropic(env, images, prompt) {
  const model = env.AI_MODEL || 'claude-sonnet-4-5';
  const content = images.map(im => ({
    type: 'image', source: { type: 'base64', media_type: im.type || 'image/jpeg', data: im.data }
  }));
  content.push({ type: 'text', text: prompt });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.AI_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + JSON.stringify(j).slice(0, 300));
  return (j.content && j.content[0] && j.content[0].text) || '';
}

async function callOpenAI(env, images, prompt) {
  const model = env.AI_MODEL || 'gpt-4o';
  const content = [{ type: 'text', text: prompt }];
  images.forEach(im => content.push({
    type: 'image_url', image_url: { url: 'data:' + (im.type || 'image/jpeg') + ';base64,' + im.data }
  }));
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.AI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + JSON.stringify(j).slice(0, 300));
  return (j.choices && j.choices[0] && j.choices[0].message.content) || '';
}

function parseJson(text) {
  let t = (text || '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export async function onRequestPost({ request, env }) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } });
  if (!env.AI_API_KEY) return J({ error: 'missing_key', message: 'חסר מפתח API (AI_API_KEY) בהגדרות Cloudflare' }, 500);
  let body;
  try { body = await request.json(); } catch { return J({ error: 'bad_request' }, 400); }
  if (!(await isManager(body.token))) return J({ error: 'unauthorized', message: 'נדרש טוקן מנהל תקף' }, 403);
  const images = (body.images || []).filter(im => im && im.data).slice(0, 5);
  if (!images.length) return J({ error: 'no_images', message: 'לא צורפו תמונות' }, 400);
  const prompt = buildPrompt(body.categories);
  try {
    const provider = (env.AI_PROVIDER || 'anthropic').toLowerCase();
    const raw = provider === 'openai' ? await callOpenAI(env, images, prompt) : await callAnthropic(env, images, prompt);
    const data = parseJson(raw);
    return J({ ok: true, book: data });
  } catch (e) {
    return J({ error: 'ai_failed', message: String(e.message || e) }, 502);
  }
}
