// netlify/functions/save-content.js
//
// מטרה: לאפשר לפאנל הניהול של האתר לשמור נתונים (סניפים, תמונות ספרים,
// מוצרים למכירה וכו') כ-commit אמיתי בריפוזיטורי GitHub, כך שהשינויים
// יהפכו לחלק קבוע מקוד האתר ויתפרסמו אוטומטית ב-Netlify.
//
// אבטחה: הפונקציה דורשת שני משתני סביבה שיוגדרו בלוח הבקרה של Netlify
// (Site configuration → Environment variables) — לעולם לא בקוד עצמו:
//   GITHUB_TOKEN     — Personal Access Token עם הרשאת "Contents: Read & write"
//                       על הריפו beityosef-library בלבד (מומלץ Fine-grained token)
//   ADMIN_API_KEY    — סיסמה/מפתח סודי שרק פאנל הניהול מכיר, ומוגן מפני קריאות זרות
//
// ללא הגדרת שני המשתנים האלה בלוח הבקרה, הפונקציה תסרב לפעול.
//
// לצורך בטיחות, ניתן לעדכן דרך הפונקציה הזו רק את הקובץ site-data.js
// (קובץ קטן שמכיל סניפים / תמונות ספרים / מוצרים / ספרים חדשים שנוספו) —
// לא את catalog.js המקורי (9MB+), כדי להימנע מסיכון לשבש את הקטלוג המלא.

const ALLOWED_PATHS = new Set(['site-data.js']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { GITHUB_TOKEN, ADMIN_API_KEY, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !ADMIN_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured: missing GITHUB_TOKEN or ADMIN_API_KEY environment variable in Netlify site settings.' }) };
  }

  const providedKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
  if (providedKey !== ADMIN_API_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { path, content, message } = payload;
  if (!path || !ALLOWED_PATHS.has(path)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Path not allowed. Allowed: ' + [...ALLOWED_PATHS].join(', ') }) };
  }
  if (typeof content !== 'string' || !content.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing content' }) };
  }

  const owner = GITHUB_OWNER || 'aharonsystems-ai';
  const repo = GITHUB_REPO || 'beityosef-library';
  const branch = GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'beit-yosef-admin-panel',
  };

  try {
    // 1. שליפת ה-SHA הנוכחי של הקובץ (אם קיים) — נדרש לעדכון קובץ קיים
    let sha;
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers: ghHeaders });
    if (getRes.status === 200) {
      const getData = await getRes.json();
      sha = getData.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'GitHub GET failed', detail: errText }) };
    }

    // 2. יצירה/עדכון של הקובץ
    const putBody = {
      message: message || `עדכון ${path} מפאנל הניהול`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    };
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(putBody),
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'GitHub commit failed', detail: errText }) };
    }
    const putData = await putRes.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, commit: putData.commit && putData.commit.sha }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error', detail: String(e) }) };
  }
};
