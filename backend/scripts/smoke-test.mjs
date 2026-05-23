/** Quick API smoke test — run while server is up: node scripts/smoke-test.mjs */
const BASE = 'http://localhost:3000/api/v1';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.message ?? res.status}`);
  return json.data;
}

const login = await req('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'admin@demo.local', password: 'Demo@123' }),
});
console.log('login ok:', login.user.email, login.user.role);

const headers = { Authorization: `Bearer ${login.token}` };
const races = await req('/races', { headers });
console.log('races:', races.length, races[0]?.name, races[0]?.status);

const resultBefore = await req(`/results/race/${races[0]._id}`, { headers });
console.log('result publishedAt:', resultBefore?.publishedAt ?? null);

if (!resultBefore?.publishedAt) {
  const published = await req(`/results/race/${races[0]._id}/publish`, {
    method: 'POST',
    headers,
  });
  const resultDoc = published.result ?? published;
  console.log('published:', !!resultDoc.publishedAt, 'scored:', published.predictionsEvaluated);
}

const spectator = await req('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'spectator@demo.local', password: 'Demo@123' }),
});
const preds = await req('/predictions/me', {
  headers: { Authorization: `Bearer ${spectator.token}` },
});
console.log(
  'spectator predictions:',
  preds.map((p) => ({ status: p.status, pointsEarned: p.pointsEarned, bonusPoints: p.bonusPoints })),
);

console.log('smoke test OK');
