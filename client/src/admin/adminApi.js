// Requests for the /admin dashboard. Kept apart from api.js: the admin token
// is its own login (not a user session), so a 401 here only ends the admin
// session and never logs the regular user out.
const TOKEN_KEY = 'deeper_admin_token';

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY);
export function setAdminToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class AdminAuthError extends Error {}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api/admin${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  }
  if (res.status === 401) {
    setAdminToken(null);
    throw new AdminAuthError('เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
  if (raw && res.ok) return res.blob();
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'เกิดข้อผิดพลาด');
  return data;
}

export const adminApi = {
  stats: () => request('/stats'),
  insights: () => request('/insights'),
  reports: () => request('/reports'),
  screenshot: (id) => request(`/reports/${id}/screenshot`, { raw: true }),
  setReport: (id, action) => request(`/reports/${id}/${action}`, { method: 'POST' }),
  replyReport: (id) => request(`/reports/${id}/reply`, { method: 'POST' }),
  inquiries: () => request('/inquiries'),
  setInquiry: (id, action) => request(`/inquiries/${id}/${action}`, { method: 'POST' }),
  sponsors: () => request('/sponsors'),
  addSponsor: (form) => request('/sponsors', { method: 'POST', body: form }),
  updateSponsor: (id, fields) => request(`/sponsors/${id}`, { method: 'PATCH', body: fields }),
  deleteSponsor: (id) => request(`/sponsors/${id}`, { method: 'DELETE' }),
  proofs: () => request('/proofs'),
  setProof: (id, action) => request(`/proofs/${id}/${action}`, { method: 'POST' }),
  rejectProof: (id) => request(`/proofs/${id}/reject`, { method: 'POST' }),
};
