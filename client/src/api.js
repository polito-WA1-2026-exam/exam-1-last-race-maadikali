// base URL of the API server (the other origin in the two-servers setup)
const BASE = 'http://localhost:3001';

// one shared helper that every API call goes through
async function request(path, opts = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',   // send/receive the session cookie across origins
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });

  if (!res.ok) {
    let payload;
    try { payload = await res.json(); } catch { payload = { error: res.statusText }; }
    const err = new Error(payload.error || `HTTP ${res.status}`);
    err.status = res.status;     // so callers can check 401
    err.payload = payload;       // the server's error body
    throw err;
  }
  if (res.status === 204) return null;   // no content
  // some endpoints reply 200 with an empty body 
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// all the API calls the app uses, grouped by area
export const api = {
  // auth
  login: (username, password) =>
    request('/api/sessions', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/api/sessions/current', { method: 'DELETE' }),
  me: () => request('/api/sessions/current'),   // who am I (restores session on load)

  // network
  networkFull: () => request('/api/network/full'),         // Setup map (with lines)
  networkSegments: () => request('/api/network/segments'), // Planning (segments only, no lines)

  // games
  newGame: () => request('/api/games', { method: 'POST' }),   // start a game (gets start/end + deadline)
  submitGame: (gameId, segmentIds) =>
    request(`/api/games/${gameId}/submit`, {                  // submit the chosen route
      method: 'POST',
      body: JSON.stringify({ segmentIds }),
    }),
  ranking: () => request('/api/ranking'),                     // best score per user
};