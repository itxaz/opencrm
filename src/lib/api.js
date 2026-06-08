// Thin client for the Inspire CRM API. Base URL comes from VITE_API_URL at build time
// (set per Railway service); falls back to same-origin "/api" when proxied.
const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

const ACCESS_KEY = 'inspire_access_token';
const REFRESH_KEY = 'inspire_refresh_token';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/**
 * Call the API. Attaches the bearer token, and transparently refreshes once on a 401.
 * @param {string} path  e.g. "/ledger"
 * @param {{ method?: string, body?: unknown, auth?: boolean }} [opts]
 */
export async function api(path, opts = {}) {
  const { method = 'GET', body, auth = true } = opts;
  const res = await rawFetch(path, method, body, auth);
  if (res.status === 401 && auth && tokens.refresh) {
    if (await tryRefresh()) return rawFetch(path, method, body, auth).then(unwrap);
    tokens.clear();
  }
  return unwrap(res);
}

async function rawFetch(path, method, body, auth) {
  const headers = { 'content-type': 'application/json' };
  if (auth && tokens.access) headers.authorization = `Bearer ${tokens.access}`;
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function unwrap(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

async function tryRefresh() {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refresh }),
  });
  if (!res.ok) return false;
  const { accessToken } = await res.json();
  tokens.set({ accessToken });
  return true;
}

// Convenience auth helpers.
export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  tokens.set(data);
  return data.user;
}

export function logout() {
  tokens.clear();
}
