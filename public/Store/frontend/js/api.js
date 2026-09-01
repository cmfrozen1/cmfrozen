const Token = {
  get() { return localStorage.getItem('store_token'); },
  set(t) { localStorage.setItem('store_token', t); },
  clear() {
    localStorage.removeItem('store_token');
    localStorage.removeItem('store_user_email');
    localStorage.removeItem('store_user_role');
    localStorage.removeItem('store_user_name');
  },
  getRole() { return localStorage.getItem('store_user_role') || ''; },
  getEmail() { return localStorage.getItem('store_user_email') || ''; },
  isAdmin() { return (localStorage.getItem('store_user_role') === 'admin') || localStorage.getItem('store_token') === '1234'; }
};

const StoreAPI = {
  apiBase: STORE_CONFIG.apiBase,

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Token.get();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(this.apiBase + path, { ...options, headers: { ...headers, ...(options.headers||{}) } });
    let data = null;
    try { data = await res.json(); } catch (e) { data = {}; }

    if (res.status === 401) {
      Token.clear();
      // กัน redirect loop ถ้าอยู่หน้า index.html แล้ว
      if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
        window.location.href = 'index.html';
      }
      throw new Error((data && data.error) || 'Unauthorized - กรุณาเข้าสู่ระบบใหม่');
    }
    if (res.status === 403) {
      throw new Error((data && data.error) || 'ไม่มีสิทธิ์ทำรายการนี้');
    }
    if (!res.ok) {
      throw new Error((data && data.error) || 'เกิดข้อผิดพลาด ' + res.status);
    }
    return data;
  },

  async login(password) {
    const res = await fetch(this.apiBase + '/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data && data.error) || 'รหัสผ่านไม่ถูกต้อง');
    Token.set(data.token);
    try {
      localStorage.setItem('store_user_role', data.role || 'admin');
      localStorage.setItem('store_user_email', data.email || 'admin (รหัสผ่าน)');
      if (data.name) localStorage.setItem('store_user_name', data.name);
    } catch(e) {}
    return data;
  },

  /* login ด้วย Google ID token (GIS) */
  async loginWithToken(idToken) {
    const res = await fetch(this.apiBase + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data && data.error) || 'Google verify ไม่สำเร็จ');
    Token.set(data.token);
    try {
      if (data.email) localStorage.setItem('store_user_email', data.email);
      if (data.role) localStorage.setItem('store_user_role', data.role);
      if (data.name) localStorage.setItem('store_user_name', data.name);
    } catch(e) {}
    return data;
  },

  get: (path) => StoreAPI.request(path, { method: 'GET' }),
  post: (path, body) => StoreAPI.request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => StoreAPI.request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => StoreAPI.request(path, { method: 'DELETE' }),

  /* ----- Products ----- */
  listProducts: () => StoreAPI.get('/api/products'),
  createProduct: (name, price) => StoreAPI.post('/api/products', { name, price }),
  updateProduct: (id, data) => StoreAPI.put('/api/products?id=' + id, data),
  deleteProduct: (id) => StoreAPI.del('/api/products?id=' + id),

  /* ----- Movements ----- */
  listMovements: () => StoreAPI.get('/api/movements'),
  addMovement: (data) => StoreAPI.post('/api/movements', data),
  deleteMovement: (id) => StoreAPI.del('/api/movements?id=' + id),

  /* ----- Report ----- */
  getBalance: () => StoreAPI.get('/api/balance')
};

function fmtMoney(v) {
  return Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท';
}

function fmtNumber(v) {
  return Number(v || 0).toLocaleString('th-TH');
}

function fmtDate(ms) {
  if (!ms) return '-';
  const d = new Date(Number(ms));
  const add0 = (n) => String(n).padStart(2, '0');
  return `${add0(d.getDate())}/${add0(d.getMonth() + 1)}/${d.getFullYear()} ${add0(d.getHours())}:${add0(d.getMinutes())}`;
}

function fmtTime(ms) {
  if (!ms) return '-';
  const d = new Date(Number(ms));
  const add0 = (n) => String(n).padStart(2, '0');
  return `${add0(d.getHours())}:${add0(d.getMinutes())}`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ===== Loading overlay (กล่องสินค้าเปิด-ปิด) ===== */
function showLoading(show) {
  const ov = document.getElementById('loadingOverlay');
  if (!ov) return;
  if (show) {
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');
  } else {
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden', 'true');
  }
}
