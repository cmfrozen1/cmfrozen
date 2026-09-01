/**
 * ร้านชายของชา - Stock System API
 * Cloudflare Worker + D1 (SQLite)
 */

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...getCorsHeaders()
    }
  });
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function nowMs() {
  return Date.now();
}

/* ---------- Google ID Token Verify ---------- */
async function verifyGoogleToken(idToken, env) {
  if (!idToken) return null;
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
  // email_verified เป็น string "true" ในบาง response
  if (String(info.email_verified) !== 'true' && info.email_verified !== true) return null;
  // หมดอายุ
  if (info.exp && Number(info.exp) * 1000 < Date.now()) return null;

  const expectedAud = (env && env.GOOGLE_CLIENT_ID) || '326468727847-v2fpjo7880ugd32lnq6p1rsc3e4dfv6l.apps.googleusercontent.com';
  const aud = Array.isArray(info.aud) ? info.aud[0] : info.aud;
  if (aud !== expectedAud) return null;

  const adminEmail = (env && env.ADMIN_EMAIL) || 'teesoftwareai@gmail.com';
  return { email: info.email, name: info.name || info.email, role: (info.email === adminEmail ? 'admin' : 'user') };
}

function isAdminUser(authUser) {
  return authUser && authUser.role === 'admin';
}

/* ตรวจสอบสิทธิ์: password หรือ Google token */
async function getAuthUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const urlPw = new URL(request.url).searchParams.get('pw');
  const provided = auth.replace(/^Bearer\s+/i, '').trim() || urlPw || '';
  if (!provided) return null;
  const expectedPw = env.PASSWORD || '1234';
  if (provided === expectedPw) {
    return { role: 'admin', email: 'admin', method: 'password' };
  }
  const gUser = await verifyGoogleToken(provided, env);
  if (gUser) return { ...gUser, method: 'google' };
  return null;
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

  const product = {
    id: res.meta.last_row_id,
    name,
    price,
    createdAt: now,
    updatedAt: now
  };
  return json(product, 201);
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

  const product = {
    id: Number(id),
    name,
    price,
    createdAt: existing.createdAt,
    updatedAt: now
  };
  return json(product);
}

async function deleteProduct(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'ไม่พบสินค้า' }, 404);

  /* ลบประวัติการเคลื่อนไหวของสินค้านั้นด้วย */
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

  /* ใช้ราคาปัจจุบันของสินค้าถ้าไม่ได้ระบุ */
  const finalPrice = hasPrice ? price : Number(product.price);

  const now = nowMs();
  const res = await env.DB.prepare(
    'INSERT INTO stock_movements (type, product_id, quantity, price, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(type, productId, quantity, finalPrice, note, now).run();

  return json({
    success: true,
    id: res.meta.last_row_id,
    type,
    productId,
    quantity,
    price: finalPrice,
    note,
    createdAt: now
  }, 201);
}

async function removeMovement(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM stock_movements WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'ไม่พบรายการ' }, 404);
  await env.DB.prepare('DELETE FROM stock_movements WHERE id = ?').bind(id).run();
  return json({ success: true });
}

/* ---------- Stock balance report ---------- */
async function getBalance(env) {
  const products = await listProducts(env);
  const movements = await listMovements(env);

  const balanceByProduct = {};
  products.forEach((p) => {
    balanceByProduct[String(p.id)] = { totalIn: 0, totalOut: 0, balance: 0 };
  });

  movements.forEach((m) => {
    const key = String(m.productId);
    if (!balanceByProduct[key]) {
      balanceByProduct[key] = { totalIn: 0, totalOut: 0, balance: 0 };
    }
    if (m.type === 'in') balanceByProduct[key].totalIn += m.quantity;
    else if (m.type === 'out') balanceByProduct[key].totalOut += m.quantity;
  });

  const report = products.map((p) => {
    const s = balanceByProduct[String(p.id)];
    s.balance = s.totalIn - s.totalOut;
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      totalIn: s.totalIn,
      totalOut: s.totalOut,
      balance: s.balance,
      balanceValue: s.balance * Number(p.price)
    };
  });

  return report;
}

/* ---------- Router ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    /* CORS preflight */
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    let body = null;
    if (method === 'POST' || method === 'PUT') {
      const ct = request.headers.get('Content-Type') || '';
      if (ct.includes('application/json')) {
        try { body = await request.json(); } catch (e) { body = {}; }
      }
    }

    try {
      /* ---- Auth routes (ไม่ต้องมี token ก่อน) ---- */
      if (path === '/api/auth' && method === 'POST') {
        const pw = (body && body.password || '').toString();
        if (env.PASSWORD && pw === env.PASSWORD) {
          return json({ success: true, token: env.PASSWORD, role: 'admin', method: 'password' });
        }
        return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
      }

      if (path === '/api/auth/google' && method === 'POST') {
        const idToken = (body && body.idToken || '').toString();
        const authUser = await verifyGoogleToken(idToken, env);
        if (!authUser) return json({ error: 'Google verify ไม่สำเร็จ - token ไม่ถูกต้องหรือหมดอายุ' }, 401);
        // ส่ง idToken กลับเป็น token เพื่อใช้กับ Authorization header ต่อไป
        return json({ success: true, token: idToken, email: authUser.email, name: authUser.name, role: authUser.role });
      }

      // สำหรับ Pages Functions compatibility: auth/me เพื่อตรวจสอบสถานะ
      if (path === '/api/me' && method === 'GET') {
        const u = await getAuthUser(request, env);
        if (!u) return json({ error: 'Unauthorized' }, 401);
        return json({ success: true, user: u });
      }

      /* ---- Protected routes ---- */
      const authUser = await getAuthUser(request, env);
      if (!authUser) return json({ error: 'Unauthorized - กรุณาเข้าสู่ระบบใหม่' }, 401);

      // user (non-admin) ดูได้อย่างเดียว เขียน/แก้/ลบต้อง admin
      const needsAdmin = (method === 'POST' || method === 'PUT' || method === 'DELETE');
      if (needsAdmin && authUser.role !== 'admin') {
        return json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขได้ (บัญชี: ' + authUser.email + ')' }, 403);
      }

      if (path === '/api/products' && method === 'GET') {
        const data = await listProducts(env);
        return json({ products: data });
      }

      if (path === '/api/products' && method === 'POST') {
        return await createProduct(env, body);
      }

      if (path === '/api/products' && method === 'PUT') {
        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'ไม่พบ id' }, 400);
        return await updateProduct(env, id, body);
      }

      if (path === '/api/products' && method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'ไม่พบ id' }, 400);
        return await deleteProduct(env, id);
      }

      /* ---- Stock movements ---- */
      if (path === '/api/movements' && method === 'GET') {
        const data = await listMovements(env);
        return json({ movements: data });
      }

      if (path === '/api/movements' && method === 'POST') {
        return await addMovement(env, body);
      }

      if (path === '/api/movements' && method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'ไม่พบ id' }, 400);
        return await removeMovement(env, id);
      }

      /* ---- Balance report ---- */
      if (path === '/api/balance' && method === 'GET') {
        const data = await getBalance(env);
        return json({ report: data });
      }

      return json({ error: 'Not Found', path }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'Server error' }, 500);
    }
  }
};
