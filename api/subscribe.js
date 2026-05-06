const REPO = process.env.GITHUB_REPO || 'jaczaar/claude-code-bestpractices';
const BRANCH = process.env.GITHUB_BRANCH || 'master';
const FILE_PATH = '.github/subscribers.json';
const ALLOWED_ORIGINS = [
  'https://jaczaar.github.io',
  'https://claude-code-bestpractices.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function ghFetch(path, init = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'cc-bestpractices-subscribe',
      ...(init.headers || {}),
    },
  });
  return r;
}

async function readFile() {
  const r = await ghFetch(`/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
  if (r.status === 404) return { sha: null, json: { subscribers: [] } };
  if (!r.ok) throw new Error(`read ${r.status}`);
  const data = await r.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, json: JSON.parse(content) };
}

async function writeFile(sha, json, email) {
  const body = {
    message: `Add newsletter subscriber (${email})`,
    content: Buffer.from(JSON.stringify(json, null, 2) + '\n', 'utf8').toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
    committer: { name: 'github-actions[bot]', email: 'github-actions[bot]@users.noreply.github.com' },
  };
  const r = await ghFetch(`/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return r;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  if (typeof body.website === 'string' && body.website.length > 0) {
    return res.status(200).json({ ok: true });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, json } = await readFile();
    const list = Array.isArray(json.subscribers) ? json.subscribers : [];
    if (list.some(e => String(e).toLowerCase() === email)) {
      return res.status(200).json({ ok: true, status: 'already_subscribed' });
    }
    const next = {
      ...json,
      subscribers: [...list, email],
      updated: new Date().toISOString(),
    };
    const r = await writeFile(sha, next, email);
    if (r.ok) return res.status(200).json({ ok: true, status: 'subscribed' });
    if (r.status === 409 || r.status === 422) continue;
    const text = await r.text();
    return res.status(502).json({ error: 'github_write_failed', detail: text.slice(0, 200) });
  }
  return res.status(409).json({ error: 'conflict_retry' });
}
