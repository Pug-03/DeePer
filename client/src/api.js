import { translate, translateError } from './i18n.js';
import { currentLang } from './store/i18n.jsx';

const TOKEN_KEY = 'deeptalk_token';
const tt = (key) => translate(currentLang, key);

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

// Plain module state (not a React context) so this plain async request()
// function below — called from anywhere, not just components — can still
// reach the auth store. AuthProvider registers `logout` here on mount; any
// request that comes back with one of these codes (all from the server's
// requireAuth middleware, never from a login/password-check failure) means
// the token itself is bad, so log out and let <Protected> redirect to
// Login instead of leaving the UI stuck half-authenticated.
let onSessionExpired = null;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}
const SESSION_ERROR_CODES = new Set(['SESSION_EXPIRED', 'AUTH_REQUIRED', 'USER_NOT_FOUND']);

function toApiError(res, data) {
  const raw = (data && data.error) || tt('common.error');
  const err = new Error(translateError(currentLang, data && data.error_code, raw));
  err.status = res.status;
  err.data = data;
  if (SESSION_ERROR_CODES.has(data && data.error_code)) onSessionExpired?.();
  return err;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(tt('common.netError'));
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw toApiError(res, data);
  return data;
}

async function upload(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method: 'POST', headers, body: formData });
  } catch {
    throw new Error(tt('common.netError'));
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw toApiError(res, data);
  return data;
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
  upload,
};
