/**
 * ร้านชายของชา - Stock System API
 * Cloudflare Pages Function (D1 = SQLite)
 *
 * จัดการทุก request ที่ /api/* ใน domain เดียวกับหน้าเว็บ
 * เช่น https://store-chaishop.pages.dev/api/products
 */

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getCorsHeaders()
    }
  });
}

function nowMs() {
  return Date.now();
}

/* ---------- Google OAuth verify ---------- */
/* ตรวจ Google id_token ผ่าน tokeninfo API */
const _tokenCache = new Map(); // token -> { user, exp }
async function verifyFirebaseToken(idToken, env) {
  if (!idToken) return null;
  const now = Date.now();
  const cached = _tokenCache.get(idToken);
  if (cached && cached.exp > now) return cached.user;
  // ล้าง cache เก่า (กัน memory leak)
  if (_tokenCache.size > 100) {
    for (const [k, v] of _tokenCache.entries()) { if (v.exp <= now) _tokenCache.delete(k); }
  }
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return null;
  }
  if (!res.ok) return null;
  let info;
  try { info = await res.json(); } catch(e) { return null; }
  if (!info || !info.email) return null;
  if (String(info.email_verified) !== 'true' && info.email_verified !== true) return null;
  if (info.exp && Number(info.exp) * 1000 < now) return null;

  /* ตรวจว่า token ออกให้ client_id นี้จริง */
  const expectedAud = (env && env.GOOGLE_CLIENT_ID) || '326468727847-v2fpjo7880ugd32lnq6p1rsc3e4dfv6l.apps.googleusercontent.com';
  const aud = Array.isArray(info.aud) ? info.aud[0] : info.aud;
  if (aud !== expectedAud) return null;

  const adminEmail = (env && env.ADMIN_EMAIL) || 'teesoftwareai@gmail.com';
  const user = { email: info.email, name: info.name || info.email, role: (info.email === adminEmail ? 'admin' : 'user') };
  // cache จนหมดอายุ หรือ 5 นาที
  const expMs = info.exp ? Number(info.exp) * 1000 : now + 5 * 60 * 1000;
  _tokenCache.set(idToken, { user, exp: Math.min(expMs, now + 5 * 60 * 1000) });
  return user;
}

/* middleware: ตรวจว่าเป็น admin (ใช้กับ POST/PUT/DELETE) */
function isAdminUser(authUser) {
  return authUser && authUser.role === 'admin';
}

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const pwProvided = auth.replace(/^Bearer\s+/i, '').trim();
  const expected = env.PASSWORD || '1234';
  return expected && pwProvided === expected;
}

/* ---------- Products ---------- */
async function listProducts(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, price, created_at as createdAt, updated_at as updatedAt FROM products ORDER BY name'
  ).all();
  return results;
}

async function createProduct(env, body) {
  const name = (body && body.name ? String(body.name).trim() : '');
  const price = Number(body && body.price);
  if (!name) return json({ error: 'กรุณาระบุชื่อสินค้า' }, 400);
  if (isNaN(price) || price < 0) return json({ error: 'ราคาไม่ถูกต้อง' }, 400);

  const now = nowMs();
  const res = await env.DB.prepare(
    'INSERT INTO products (name, price, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(name, price, now, now).run();

  return json({ id: res.meta.last_row_id, name, price, createdAt: now, updatedAt: now }, 201);
}

async function updateProduct(env, id, body) {
  const existing = await env.DB.prepare(
    'SELECT id, name, price, created_at as createdAt FROM products WHERE id = ?'
  ).bind(id).first();
  if (!existing) return json({ error: 'ไม่พบสินค้า' }, 404);

  const name = (body && body.name ? String(body.name).trim() : existing.name);
  let price = existing.price;
  if (body && body.price !== undefined && body.price !== null && body.price !== '') {
    price = Number(body.price);
    if (isNaN(price) || price < 0) return json({ error: 'ราคาไม่ถูกต้อง' }, 400);
  }

  const now = nowMs();
  await env.DB.prepare(
    'UPDATE products SET name = ?, price = ?, updated_at = ? WHERE id = ?'
  ).bind(name, price, now, id).run();

  return json({ id: Number(id), name, price, createdAt: existing.createdAt, updatedAt: now });
}

async function deleteProduct(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'ไม่พบสินค้า' }, 404);

  await env.DB.prepare('DELETE FROM stock_movements WHERE product_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();

  return json({ success: true });
}

/* ---------- Stock movements ---------- */
async function listMovements(env) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.type, m.product_id as productId, m.quantity, m.price, m.note, m.created_at as createdAt,
            p.name as productName
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 2000`
  ).all();
  return results;
}

async function addMovement(env, body) {
  const type = (body && body.type === 'out') ? 'out' : (body && body.type === 'in' ? 'in' : '');
  const productId = Number(body && body.productId);
  const quantity = Number(body && body.quantity);
  const note = (body && body.note ? String(body.note).trim() : '');
  const hasPrice = body && body.price !== undefined && body.price !== null && body.price !== '';
  const price = hasPrice ? Number(body.price) : NaN;

  if (type !== 'in' && type !== 'out') return json({ error: 'ประเภทไม่ถูกต้อง' }, 400);
  if (!productId) return json({ error: 'กรุณาเลือกสินค้า' }, 400);
  if (!Number.isInteger(quantity) || quantity <= 0) return json({ error: 'จำนวนต้องเป็นจำนวนเต็มที่มากกว่า 0' }, 400);
  if (hasPrice && (isNaN(price) || price < 0)) return json({ error: 'ราคาไม่ถูกต้อง' }, 400);

  const product = await env.DB.prepare('SELECT id, name, price FROM products WHERE id = ?').bind(productId).first();
  if (!product) return json({ error: 'ไม่พบสินค้า' }, 404);

  const finalPrice = hasPrice ? price : Number(product.price);

  const now = nowMs();
  const res = await env.DB.prepare(
    'INSERT INTO stock_movements (type, product_id, quantity, price, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(type, productId, quantity, finalPrice, note, now).run();

  return json({
    success: true,
    id: res.meta.last_row_id,
    type, productId, quantity, price: finalPrice, note, createdAt: now
  }, 201);
}

async function removeMovement(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM stock_movements WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'ไม่พบรายการ' }, 404);
  await env.DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(id).run();
  return json({ success: true });
}

/* ---------- Balance report ---------- */
async function getBalance(env) {
  const products = await listProducts(env);
  const movements = await listMovements(env);

  const map = {};
  products.forEach((p) => { map[String(p.id)] = { totalIn: 0, totalOut: 0, balance: 0 }; });
  movements.forEach((m) => {
    const key = String(m.productId);
    if (!map[key]) map[key] = { totalIn: 0, totalOut: 0, balance: 0 };
    if (m.type === 'in') map[key].totalIn += m.quantity;
    else if (m.type === 'out') map[key].totalOut += m.quantity;
  });

  return products.map((p) => {
    const s = map[String(p.id)];
    s.balance = s.totalIn - s.totalOut;
    return {
      id: p.id, name: p.name, price: p.price,
      totalIn: s.totalIn, totalOut: s.totalOut, balance: s.balance,
      balanceValue: s.balance * Number(p.price)
    };
  });
}

/* ---------- Router ---------- */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }

  let body = null;
  if (method === 'POST' || method === 'PUT') {
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      try { body = await request.json(); } catch (e) { body = {}; }
    }
  }

  try {
    /* ---- login ด้วยรหัสผ่าน 1234 (admin fallback) ---- */
    if (url.pathname === '/api/auth' && method === 'POST') {
      const pw = (body && body.password || '').toString();
      const expected = env.PASSWORD || '1234';
      if (expected && pw === expected) return json({ success: true, token: expected, role: 'admin' });
      return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    }

    /* ---- login ด้วย Firebase ID token (Google) ---- */
    if (url.pathname === '/api/auth/google' && method === 'POST') {
      const idToken = (body && body.idToken || '').toString();
      if (!idToken) return json({ error: 'กรุณาส่ง idToken' }, 400);
      const authUser = await verifyFirebaseToken(idToken, env);
      if (!authUser) return json({ error: 'Google verify ไม่สำเร็จ - token ไม่ถูกต้องหรือหมดอายุ' }, 401);
      return json({ success: true, token: idToken, email: authUser.email, name: authUser.name, role: authUser.role });
    }

    if (url.pathname === '/api/me' && method === 'GET') {
      const h = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      if (!h) return json({ error: 'Unauthorized' }, 401);
      if (h === (env.PASSWORD || '1234')) return json({ success: true, user: { role: 'admin', method: 'password' } });
      const u = await verifyFirebaseToken(h, env);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      return json({ success: true, user: u });
    }

    /* ---- protected routes ---- */
    /* ตรวจ auth: password "1234" (admin) หรือ Firebase token */
    const authHeader = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    let authUser = null;
    if (authHeader) {
      if (authHeader === (env.PASSWORD || '1234')) {
        authUser = { role: 'admin' };
      } else {
        authUser = await verifyFirebaseToken(authHeader, env);
      }
    }
    if (!authUser) return json({ error: 'Unauthorized' }, 401);

    /* user (non-admin) ดูได้อย่างเดียว เขียน/แก้/ลบต้อง admin */
    const needsAdmin = (method === 'POST' || method === 'PUT' || method === 'DELETE');
    if (needsAdmin && !isAdminUser(authUser)) {
      return json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' }, 403);
    }

    if (url.pathname === '/api/products' && method === 'GET') return json({ products: await listProducts(env) });
    if (url.pathname === '/api/products' && method === 'POST') return await createProduct(env, body);
    if (url.pathname === '/api/products' && method === 'PUT') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'ไม่พบ id' }, 400);
      return await updateProduct(env, id, body);
    }
    if (url.pathname === '/api/products' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'ไม่พบ id' }, 400);
      return await deleteProduct(env, id);
    }

    if (url.pathname === '/api/movements' && method === 'GET') return json({ movements: await listMovements(env) });
    if (url.pathname === '/api/movements' && method === 'POST') return await addMovement(env, body);
    if (url.pathname === '/api/movements' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'ไม่พบ id' }, 400);
      return await removeMovement(env, id);
    }

    if (url.pathname === '/api/balance' && method === 'GET') return json({ report: await getBalance(env) });

    return json({ error: 'Not Found', path: url.pathname }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Server error' }, 500);
  }
}
