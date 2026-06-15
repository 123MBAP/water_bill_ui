const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('token');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch with auto-retry on 503 (Supabase waking up) and network errors.
 *  Non-retriable errors (4xx except 503) are thrown immediately. */
async function request(path, options = {}, _attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const headers = {
    'Content-Type': 'application/json',
    ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (networkErr) {
    // ERR_CONNECTION_REFUSED or network error — retry up to MAX_ATTEMPTS
    if (_attempt < MAX_ATTEMPTS) {
      await sleep(_attempt * 1500);
      return request(path, options, _attempt + 1);
    }
    const err = new Error('Cannot reach the server. Make sure the backend is running.');
    err.code = 'ERR_CONNECTION_REFUSED';
    err.status = 0;
    throw err;
  }

  const contentType = res.headers.get('content-type');

  if (contentType?.includes('application/pdf')) {
    const blob = await res.blob();
    if (!res.ok) throw new Error('PDF download failed');
    return blob;
  }

  const data = await res.json();

  // 503 = Supabase/auth waking up — retry automatically
  if (res.status === 503 && _attempt < MAX_ATTEMPTS) {
    const waitMs = _attempt * 2000; // 2s, 4s
    console.warn(`[API] 503 on ${path} — Supabase waking up, retrying in ${waitMs / 1000}s…`);
    await sleep(waitMs);
    return request(path, options, _attempt + 1);
  }

  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Request failed');
    err.code = data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  myCards: () => request('/cards/my'),
  recharge: (body) => request('/cards/recharge', { method: 'POST', body: JSON.stringify(body) }),
  myUsage: () => request('/analytics/my-usage'),
  authorize: (body) => request('/water/request', { method: 'POST', body: JSON.stringify(body) }),
  predict: (userId) => request(`/analytics/predict/${userId || ''}`),
  sessions: () => request('/water/sessions'),
  getSession: (id) => request(`/water/session/${id}`),
  sessionCommand: (id, action) => request(`/water/session/${id}/command`, { method: 'POST', body: JSON.stringify({ action }) }),
  overview: () => request('/analytics/overview'),
  usageGraph: (period) => request(`/analytics/usage-graph?period=${period}`),
  topConsumers: () => request('/analytics/top-consumers'),
  waterLoss: () => request('/analytics/water-loss'),
  leakAlerts: (resolved) => request(`/alerts/leaks?resolved=${resolved ?? ''}`),
  resolveAlert: (id) => request(`/alerts/leaks/${id}/resolve`, { method: 'PATCH' }),
  allTransactions: (limit = 100, offset = 0) => request(`/water/transactions?limit=${limit}&offset=${offset}`),
  users: () => request('/users'),
  pendingCustomers: () => request('/users/pending'),
  updateAccountApproval: (userId, body) =>
    request(`/users/${userId}/approval`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateUserRole: (userId, body) => request(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (userId) => request(`/users/${userId}`, { method: 'DELETE' }),
  adminCreateUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
  downloadBill: async (userId, year, month) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/reports/bill/${userId}/${year}/${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Bill download failed');
    return res.blob();
  },
  downloadRevenue: async (from, to) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/reports/revenue?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Revenue report failed');
    return res.blob();
  },

  // Admin: system controls
  adminGetWaterFetchControl: () => request('/admin/system/water-fetch'),
  adminSetWaterFetchControl: (body) => request('/admin/system/water-fetch', { method: 'PATCH', body: JSON.stringify(body) }),

  // Admin: cards
  adminListCards: () => request('/admin/cards'),
  adminCreateCard: (body) => request('/admin/cards', { method: 'POST', body: JSON.stringify(body) }),
  adminAssignCard: ({ cardId, userId }) =>
    request(`/admin/cards/${cardId}/assign`, { method: 'PATCH', body: JSON.stringify({ user_id: userId }) }),
  adminSetCardActive: ({ cardId, is_active }) => request(`/admin/cards/${cardId}/active`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  adminRechargeCard: ({ cardId, amount_rwf }) => request(`/admin/cards/${cardId}/recharge`, { method: 'POST', body: JSON.stringify({ amount_rwf }) }),
  adminSetCardRfid: ({ cardId, rfid_uid }) => request(`/admin/cards/${cardId}/rfid`, { method: 'PATCH', body: JSON.stringify({ rfid_uid }) }),
  adminPrepareCardScan: ({ cardId, deviceId }) => request(`/admin/cards/${cardId}/prepare-scan`, { method: 'PATCH', body: JSON.stringify({ deviceId }) }),
  adminDeleteCard: ({ cardId }) => request(`/admin/cards/${cardId}`, { method: 'DELETE' }),

  // Notifications
  myNotifications: () => request('/notifications/my'),
  markNotifRead:   (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead:     () => request('/notifications/read-all', { method: 'PATCH' }),
  sendNotification:(body) => request('/notifications/send', { method: 'POST', body: JSON.stringify(body) }),

  // Search
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),

  // Admin: devices
  adminListDevices: () => request('/admin/devices'),
  adminCreateDevice: (body) => request('/admin/devices', { method: 'POST', body: JSON.stringify(body) }),
  adminSetDeviceStatus: ({ deviceId, status }) =>
    request(`/admin/devices/${deviceId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminRegisterDevice: ({ deviceId }) => request(`/admin/devices/${deviceId}/register`, { method: 'POST' }),
  adminDeleteDevice: ({ deviceId }) => request(`/admin/devices/${deviceId}`, { method: 'DELETE' }),
  adminGetMqttStatus: () => request('/admin/mqtt-status'),
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
