/**
 * Fukupetstore - Cloudflare Worker + D1 + R2
 * Port of api.php (PHP/MySQL) to Cloudflare Workers (JS/D1/R2)
 * Handles: get_content, save_section, save_all, upload_image, list_images,
 *          delete_image, create_order, upload_slip, get_orders,
 *          update_order_status, lookup_order, db_status, init_db,
 *          login, logout, check_auth + R2 asset serving for /images/* & /slips/*
 */

// Fallback data when D1 is empty (mirrors default_data.json)

async function uploadToAppsScript(buffer, filename, mime, folderId) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunking to avoid Maximum call stack size exceeded
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  
  const appScriptUrl = "https://script.google.com/macros/s/AKfycbz8f--YwB4f3rbqOpfufognF7phzzndHSakVV26sGpChHTrjBDlEUmO5aPrt4ZZ_0Fu9w/exec";
  const params = new URLSearchParams();
  params.append("fileData", base64);
  params.append("fileName", filename);
  params.append("mimeType", mime);
  params.append("folderId", folderId);
  
  const res = await fetch(appScriptUrl, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch(e) {
    throw new Error("Invalid response from Apps Script: " + text.substring(0, 100));
  }
  
  if (data.success) {
    return { url: data.url };
  } else {
    throw new Error(data.error || "Unknown error from Apps Script");
  }
}

async function getGoogleDriveToken(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT secret. Please set it via wrangler secret put GOOGLE_SERVICE_ACCOUNT");
  const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: creds.client_email, scope: "https://www.googleapis.com/auth/drive.file", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const b64Header = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64Claim = btoa(JSON.stringify(claim)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const textToSign = `${b64Header}.${b64Claim}`;
  const pem = creds.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binaryDerString = atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) binaryDer[i] = binaryDerString.charCodeAt(i);
  const key = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(textToSign));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = `${textToSign}.${b64Sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearerconst FALLBACK_DATA = {assertion=${jwt}` });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get Google token: " + JSON.stringify(data));
  return data.access_token;
}

async function uploadToDriveWorker(buffer, filename, mime, folderId, env) {
  const token = await getGoogleDriveToken(env);
  const metadata = { name: filename, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([buffer], { type: mime }));
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipartconst FALLBACK_DATA = {fields=id,thumbnailLink", { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: form });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (data.thumbnailLink) {
    const lh3Url = data.thumbnailLink.replace(/=[^=]+$/, "=s0");
    return { url: lh3Url, id: data.id };
  }
  throw new Error("No thumbnailLink returned");
}

const FALLBACK_DATA = {
  "top_bar": {"items":["🚚 ส่งฟรีทั่วไทย เก็บเงินปลายทางได้","💳 ผ่อน 0% นานสูงสุด 4 เดือน","⭐ ลูกค้ากว่า 100,000 คนไว้วางใจ","🔥 โปรโมชั่นพิเศษหมดเวลาใน:"],"timer_seconds":31335},
  "header": {"logo_url":"https://www.chowa.in.th/cdn/shop/files/Chowa_logo_CMYK_Logo_Blue_croped.png?v=1781661303&width=400","nav_links":[{"label":"หมอนสุขภาพ","href":"#product"},{"label":"จุดเด่น","href":"#benefits"},{"label":"โครงสร้าง 4 ชั้น","href":"#hotspots"},{"label":"เปรียบเทียบ","href":"#comparison"},{"label":"รีวิวจากลูกค้า","href":"#reviews"},{"label":"คำถามที่พบบ่อย","href":"#faq"}]},
  "product": {"title":"หมอนโคซี่","brand":"Fukupetstore","rating":"5.0","reviews_text":"(1,955+ รีวิว)","sold_text":"🔥 ขายแล้วกว่า 10,000+ ใบ","urgency_text":"⚡ มีสินค้า พร้อมส่งทันที จัดส่งฟรีทั่วไทย","guarantee_text":"🛡️ รับประกันความพึงพอใจ คืนเงินเต็มจำนวนใน 7 วัน","gallery":[{"url":"https://www.chowa.in.th/cdn/shop/files/product-699926_1400x.png?v=1738616200","thumb":"https://www.chowa.in.th/cdn/shop/files/product-699926_400x.png?v=1738616200","alt":"หมอนโคซี่"}],"trust_badges":[{"icon":"https://ucarecdn.com/3c9e7ad4-72cd-4778-9d52-e200ff0c8606/-/format/auto/-/preview/240x240/-/quality/lighter/Artboard%201.png","text":"ทดลองนอนฟรี<br>7 วัน"}],"sizes":[{"id":"standard","title":"มาตรฐาน (Standard)","subtitle":"ขนาด 18 x 26 นิ้ว","price":2690,"compare_price":4400},{"id":"king","title":"ใหญ่พิเศษ (King)","subtitle":"ขนาด 18 x 35 นิ้ว","price":2990,"compare_price":4890}],"bundles":[{"id":1,"badge":"","name":"1 ใบ (เซ็ตทดลอง)","desc":"หมอนโคซี่ + ถุงรีฟิลไส้เมมโมรี่โฟม","multiplier":1,"discount_percent":0,"savings_text":"ลด 39% จากราคาเต็ม"}],"upsell":{"enabled":true,"title":"+ เพิ่ม ปลอกหมอน Tencel Lyocell","meta":"สัมผัสเย็น นุ่มลื่นดุจผ้าไหม อ่อนโยนต่อผิว","price":790,"compare_price":1290,"image":"https://www.chowa.in.th/cdn/shop/files/tencel-lyocell-631776.png?height=200&v=1738616201"},"accordions":[{"title":"ทำไมต้องใช้หมอนโคซี่?","content":"วัสดุไฮเปอร์เมมโมรี่โฟม"}],"color_label":"เลือกสีปลอกหมอน:","color_options":[{"name":"สีขาว (White)","hex":"#ffffff"},{"name":"สีเทา (Gray)","hex":"#888888"},{"name":"สีน้ำเงิน (Navy Blue)","hex":"#1e3a8a"},{"name":"สีชมพู (Soft Pink)","hex":"#f472b6"}]},
  "features": [{"icon":"https://ucarecdn.com/af853f1d-a2fd-4b6e-a6d0-3613c76f0d8f/-/format/auto/-/preview/240x240/-/quality/lighter/Pressure.png","title":"กระจายน้ำหนักกดทับ"}],
  "benefits_section": {"title":"ตื่นมาคอไม่ปวด หลับลึกได้ทั้งคืน","subtitle":"หมอนสุขภาพที่ออกแบบมาเพื่อแก้ปัญหาการนอน","cards":[],"cta_text":"สั่งซื้อหมอนโคซี่เลย","cta_link":"#product","guarantee":"🛡️ รับประกันความพึงพอใจ ยินดีคืนเงินภายใน 7 วัน"},
  "hotspots_section": {"title":"4 ชั้นที่ทำให้คุณหลับลึกทั้งคืน","subtitle":"นวัตกรรมการออกแบบหมอนสุขภาพจากเกาหลี","image":"https://www.chowa.in.th/cdn/shop/files/CP_3D_realistic_image_png.png?v=1787284641&width=1200","pins":[]},
  "comparison_section": {"title":"ทำไมต้องหมอนโคซี่","subtitle":"เทียบให้เห็นชัดเจน","chowa_name":"หมอนโคซี่ Fukupetstore","chowa_img":"","other_name":"หมอนทั่วไป","other_img":"","rows":[],"cta_text":"สั่งซื้อและรับสิทธิ์ทดลองนอน 7 วัน","cta_link":"#product"},
  "reviews_section": {"title":"รีวิวจากลูกค้าจริง","subtitle":"ประสบการณ์จริง","score":"4.9","total_reviews":"1,955+","bars":[],"reviews":[]},
  "faq_section": {"title":"คำถามที่พบบ่อย","subtitle":"ข้อสงสัยยอดนิยม","faqs":[]},
  "footer": {"about":"Fukupetstore แบรนด์นวัตกรรมการนอนเพื่อสุขภาพชั้นนำ","club_title":"เข้าร่วม Fukupetstore Club","club_desc":"รับส่วนลดพิเศษ 10% สำหรับการสั่งซื้อครั้งแรก","products":[],"services":[],"contact":[],"copyright":"© 2026 Fukupetstore Copyright. All rights reserved.","payments":"การชำระเงินที่ปลอดภัย: Visa, Mastercard, PromptPay, COD"},
  "section_visibility": {"top_bar":true,"header":true,"product":true,"gallery":true,"sizes":true,"bundles":true,"upsell":true,"accordions":true,"features":true,"benefits_section":true,"hotspots_section":true,"comparison_section":true,"reviews_section":true,"faq_section":true,"footer":true}
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...extraHeaders },
  });
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach(p => {
    const [k, ...rest] = p.trim().split("=");
    if (k) out[k.trim()] = decodeURIComponent(rest.join("=").trim());
  });
  return out;
}


async function sha256(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2,"0")).join("");
}

function normalizePhone(phone) {
  return String(phone||"").replace(/\D+/g,"");
}

async function isAdminAuthenticated(request, env) {
  const cookies = parseCookies(request);
  const token = cookies["admin_token"] || request.headers.get("X-Admin-Token") || "";
  if (!token) return { ok: false };
  try {
    const row = await env.DB.prepare("SELECT token, username, expires_at FROM sessions WHERE token = ? LIMIT 1").bind(token).first();
    if (!row) return { ok: false };
    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      return { ok: false };
    }
    return { ok: true, username: row.username, token };
  } catch { return { ok: false }; }
}

async function requireAdmin(request, env) {
  const auth = await isAdminAuthenticated(request, env);
  if (!auth.ok) return json({ success:false, error:"กรุณาเข้าสู่ระบบผู้ดูแลก่อนใช้งาน" }, 401);
  return null; // pass
}

// Ensure D1 tables exist (idempotent)
async function ensureTables(env) {
  try {
    // This is safe to call on every request - uses IF NOT EXISTS
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS site_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, section_key TEXT NOT NULL UNIQUE, section_name TEXT NOT NULL, data_json TEXT NOT NULL, updated_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')));
      CREATE TABLE IF NOT EXISTS site_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, setting_key TEXT NOT NULL UNIQUE, setting_value TEXT, updated_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')));
      CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_address TEXT NOT NULL, product_title TEXT NOT NULL, size_name TEXT NOT NULL, bundle_name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, upsell_included INTEGER NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'cod', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','shipping','completed','cancelled')), tracking_number TEXT, notes TEXT, slip_path TEXT, shipping_carrier TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')));
      CREATE TABLE IF NOT EXISTS media_files (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL, original_name TEXT NOT NULL, file_path TEXT NOT NULL, file_size INTEGER NOT NULL, mime_type TEXT NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')));
      CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')));
      CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, username TEXT NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')), expires_at TEXT NOT NULL);
    `);
  } catch(e){ /* ignore */ }
}

// --- Handlers ---

async function handleGetContent(env) {
  await ensureTables(env);
  let content = { ...FALLBACK_DATA };
  let source = "fallback";
  let dbStatus = { connected: true, database: "D1" };
  try {
    const result = await env.DB.prepare("SELECT section_key, data_json FROM site_sections").all();
    if (result.results && result.results.length > 0) {
      source = "d1";
      for (const r of result.results) {
        try { content[r.section_key] = JSON.parse(r.data_json); } catch {}
      }
    } else {
      // Seed from fallback if empty
      for (const [k,v] of Object.entries(FALLBACK_DATA)) {
        try {
          await env.DB.prepare("INSERT OR IGNORE INTO site_sections (section_key, section_name, data_json) VALUES (?, ?, ?)").bind(k, k.replace(/_/g,' '), JSON.stringify(v)).run();
        } catch {}
      }
    }
  } catch(e) {
    dbStatus = { connected:false, error: String(e) };
    source = "fallback";
  }
  return json({ success:true, source, db_status: dbStatus, data: content });
}

async function handleSaveSection(env, input) {
  const sectionKey = input.section_key || "";
  const data = input.data;
  if (!sectionKey || data === undefined) return json({ success:false, error:"Missing section_key or data" }, 400);
  const encoded = JSON.stringify(data);
  try {
    await env.DB.prepare("INSERT INTO site_sections (section_key, section_name, data_json) VALUES (?, ?, ?) ON CONFLICT(section_key) DO UPDATE SET data_json = excluded.data_json, updated_at = strftime('%Y-%m-%d %H:%M:%S','now')").bind(sectionKey, sectionKey.replace(/_/g,' '), encoded).run();
  } catch(e){ return json({ success:false, error: String(e) }, 500); }
  return json({ success:true, section_key: sectionKey, mysql_saved:true, file_saved:false, message:"บันทึกข้อมูลเรียบร้อยแล้ว" });
}

async function handleSaveAll(env, input) {
  const data = input.data || input;
  if (!data || typeof data !== "object" || Array.isArray(data) && data.length===0) return json({ success:false, error:"No data provided" }, 400);
  let count = 0;
  for (const [k,v] of Object.entries(data)) {
    try {
      await env.DB.prepare("INSERT INTO site_sections (section_key, section_name, data_json) VALUES (?, ?, ?) ON CONFLICT(section_key) DO UPDATE SET data_json = excluded.data_json, updated_at = strftime('%Y-%m-%d %H:%M:%S','now')").bind(k, k.replace(/_/g,' '), JSON.stringify(v)).run();
      count++;
    } catch {}
  }
  return json({ success:true, mysql_sections_updated: count, message:"บันทึกข้อมูลเว็บไซต์ทั้งหมดเรียบร้อยแล้ว" });
}

async function handleUploadImage(request, env) {
  const formData = await request.formData();
  const file = formData.get("image");
  if (!file || typeof file.arrayBuffer !== "function") return json({ success:false, error:"No file uploaded" }, 400);
  const ext = (file.name.split(".").pop()||"").toLowerCase();
  const allowed = ["jpg","jpeg","png","gif","webp","svg"];
  if (!allowed.includes(ext)) return json({ success:false, error:"อนุญาตเฉพาะไฟล์ภาพ jpg, jpeg, png, gif, webp, svg" }, 400);
  if (file.size && file.size > 10 * 1024 * 1024) return json({ success:false, error:"ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, 400);
  const base = file.name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,40);
  const filename = `${base}_${Date.now()}_${randomToken(3)}.${ext}`;
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > 10 * 1024 * 1024) return json({ success:false, error:"ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, 400);
  const mime = file.type || `image/${ext}`;
  
  let fileUrl = "";
  try {
    const driveRes = await uploadToAppsScript(buffer, filename, mime, "1YpesKmkMa8exNwbbI5AObGffFGh-UaGj");
    fileUrl = driveRes.url;
  } catch(e) {
    return json({ success:false, error:"Google Drive upload failed: "+String(e) }, 500);
  }
  
  try {
    await env.DB.prepare("INSERT INTO media_files (filename, original_name, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?)").bind(filename, file.name, fileUrl, buffer.byteLength, mime).run();
  } catch {}
  return json({ success:true, filename, url: fileUrl, size: buffer.byteLength, mime, message:"อัปโหลดรูปภาพสำเร็จ" });
}

async function handleListImages(env) {
  // Prefer R2 listing if available, else D1
  let images = [];
  if (env.BUCKET) {
    try {
      const listed = await env.BUCKET.list({ prefix: "images/" });
      for (const obj of listed.objects) {
        if (obj.key === "images/") continue;
        const filename = obj.key.replace("images/"," ");
        const trimmed = filename.trim();
        if (!trimmed) continue;
        images.push({
          filename: trimmed,
          url: obj.key,
          size: obj.size,
          size_formatted: (obj.size/1024).toFixed(1)+" KB",
          updated_at: obj.uploaded ? new Date(obj.uploaded).toISOString().slice(0,19).replace("T"," ") : ""
        });
      }
      // Merge with D1 for missing metadata
      // sort newest first
      images.sort((a,b)=> b.updated_at.localeCompare(a.updated_at));
      return json({ success:true, total: images.length, images });
    } catch {}
  }
  // Fallback D1
  try {
    const res = await env.DB.prepare("SELECT filename, file_path, file_size, mime_type, created_at FROM media_files ORDER BY created_at DESC").all();
    images = (res.results||[]).map(r=> ({
      filename: r.filename,
      url: r.file_path,
      size: r.file_size,
      size_formatted: (r.file_size/1024).toFixed(1)+" KB",
      updated_at: r.created_at
    }));
  } catch {}
  return json({ success:true, total: images.length, images });
}

async function handleDeleteImage(env, input) {
  const filename = String(input.filename||"").split("/").pop().replace(/[^a-zA-Z0-9._-]/g,"");
  if (!filename) return json({ success:false, error:"Missing filename" }, 400);
  if (env.BUCKET) {
    try { await env.BUCKET.delete(`images/${filename}`); } catch {}
  }
  try { await env.DB.prepare("DELETE FROM media_files WHERE filename = ?").bind(filename).run(); } catch {}
  return json({ success:true, message:"ลบรูปภาพเรียบร้อยแล้ว" });
}

async function handleCreateOrder(env, input) {
  const customerName = String(input.name||"").trim();
  const customerPhone = String(input.phone||"").trim();
  const customerAddress = String(input.address||"").trim();
  const totalPrice = parseFloat(input.total_price)||0;
  const paymentMethod = String(input.payment_method||"cod").trim();
  let colors = Array.isArray(input.colors) ? input.colors : [];
  colors = colors.map(c=> String(c||"").trim()).filter(Boolean);
  const colorSummary = colors.length ? colors.map((c,i)=> `ชิ้นที่ ${i+1}: ${c}`).join(", ") : "";
  if (!customerName || !customerPhone) return json({ success:false, error:"กรุณากรอกชื่อและเบอร์โทรศัพท์" }, 400);
  const orderNo = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${randomToken(2).toUpperCase()}`;
  const productTitle = input.product_title || "หมอนโคซี่ Fukupetstore";
  const sizeName = input.size_name || "มาตรฐาน (Standard)";
  const bundleName = input.bundle_name || "1 ใบ";
  const quantity = parseInt(input.quantity)||1;
  const notes = colorSummary ? `สีสินค้า: ${colorSummary}` : null;
  const upsell = input.upsell_included ? 1 : 0;
  try {
    await env.DB.prepare("INSERT INTO orders (order_no, customer_name, customer_phone, customer_address, product_title, size_name, bundle_name, quantity, notes, upsell_included, total_price, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')").bind(orderNo, customerName, customerPhone, customerAddress, productTitle, sizeName, bundleName, quantity, notes, upsell, totalPrice, paymentMethod).run();
  } catch(e){ return json({ success:false, error: "DB error: "+String(e) }, 500); }
  return json({ success:true, order_no: orderNo, mysql_saved:true, message:"บันทึกคำสั่งซื้อเรียบร้อยแล้ว" });
}

async function handleUploadSlip(request, env) {
  const formData = await request.formData();
  const orderNo = String(formData.get("order_no")||"").trim();
  const file = formData.get("slip");
  if (!orderNo || !/^[A-Za-z0-9-]{4,64}$/.test(orderNo)) return json({ success:false, error:"ไม่พบเลขที่คำสั่งซื้อ" }, 400);
  if (!file || typeof file.arrayBuffer !== "function") return json({ success:false, error:"กรุณาเลือกไฟล์สลิป" }, 400);
  if (!env.BUCKET) {
    return json({ success:false, error:"ยังไม่ได้ตั้งค่า R2 Bucket (BUCKET) บน Cloudflare - กรุณารัน: npx wrangler r2 bucket create fukupetstore-images และ deploy ใหม่" }, 500);
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > 5*1024*1024) return json({ success:false, error:"ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB" }, 400);
  const mime = file.type || "";
  const allowed = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/jpg":"jpg"};
  if (!allowed[mime]) {
    // also allow by extension fallback
    const ext = (file.name.split(".").pop()||"").toLowerCase();
    if (!["jpg","jpeg","png","webp"].includes(ext)) return json({ success:false, error:"รองรับเฉพาะไฟล์ JPG, PNG และ WebP" }, 400);
  }
  const ext = allowed[mime] || (file.name.split(".").pop()||"jpg").toLowerCase();
  // Check order exists
  const exists = await env.DB.prepare("SELECT 1 FROM orders WHERE order_no = ? LIMIT 1").bind(orderNo).first();
  if (!exists) return json({ success:false, error:"ไม่พบคำสั่งซื้อนี้" }, 404);
  const filename = `${orderNo.replace(/[^A-Za-z0-9-]/g,"_")}_${Date.now()}_${randomToken(4)}.${ext}`;
  const key = `slips/${filename}`;
  try { await env.BUCKET.put(key, buffer, { httpMetadata:{ contentType: mime || `image/${ext}` } }); } catch(e){ return json({ success:false, error:"ไม่สามารถบันทึกไฟล์สลิปได้: "+String(e) }, 500); }
  const slipPath = key;
  try { await env.DB.prepare("UPDATE orders SET slip_path = ? WHERE order_no = ?").bind(slipPath, orderNo).run(); } catch {}
  return json({ success:true, slip_path: slipPath, message:"แนบสลิปเรียบร้อยแล้ว" });
}

async function handleGetOrders(env) {
  try {
    const res = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100").all();
    return json({ success:true, total: (res.results||[]).length, orders: res.results||[] });
  } catch(e){ return json({ success:false, error:String(e) }, 500); }
}

async function handleUpdateOrderStatus(env, input) {
  const orderNo = String(input.order_no||"");
  const status = String(input.status||"pending");
  const trackingNumber = String(input.tracking_number||"").trim();
  const shippingCarrier = String(input.shipping_carrier||"").trim();
  const allowed = ["pending","confirmed","shipping","completed","cancelled"];
  if (!orderNo) return json({ success:false, error:"Missing order_no" }, 400);
  if (!allowed.includes(status)) return json({ success:false, error:"Invalid status" }, 400);
  if (status==="shipping" && !trackingNumber) return json({ success:false, error:"กรุณากรอกเลข Tracking ก่อนเปลี่ยนเป็นกำลังจัดส่ง" }, 400);
  if (status==="shipping" && !shippingCarrier) return json({ success:false, error:"กรุณากรอกชื่อขนส่งก่อนเปลี่ยนเป็นกำลังจัดส่ง" }, 400);
  try {
    if (trackingNumber) {
      await env.DB.prepare("UPDATE orders SET status = ?, tracking_number = ?, shipping_carrier = ? WHERE order_no = ?").bind(status, trackingNumber, shippingCarrier, orderNo).run();
    } else {
      await env.DB.prepare("UPDATE orders SET status = ? WHERE order_no = ?").bind(status, orderNo).run();
    }
  } catch(e){ return json({ success:false, error:String(e) }, 500); }
  return json({ success:true, message:"อัปเดตสถานะสำเร็จ" });
}

function publicOrderPayload(order){
  return {
    order_no: order.order_no||"",
    created_at: order.created_at||"",
    product_title: order.product_title||"",
    size_name: order.size_name||"",
    bundle_name: order.bundle_name||"",
    quantity: parseInt(order.quantity)||1,
    total_price: parseFloat(order.total_price)||0,
    payment_method: order.payment_method||"",
    status: order.status||"pending",
    tracking_number: (order.status==="shipping") ? (order.tracking_number||"") : "",
    shipping_carrier: (order.status==="shipping") ? (order.shipping_carrier||"") : ""
  };
}

async function handleOrderLookup(env, input, request) {
  let phone = String(input.phone||"").trim();
  if (!phone) {
    // also try GET param
    try { phone = new URL(request.url).searchParams.get("phone")||""; } catch {}
  }
  const norm = normalizePhone(phone);
  if (!norm) return json({ success:false, error:"กรุณากรอกเบอร์โทรศัพท์ที่ใช้สั่งซื้อ" }, 400);
  try {
    const res = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 300").all();
    const matched = (res.results||[]).filter(o=> normalizePhone(o.customer_phone||"")===norm).map(publicOrderPayload);
    return json({ success:true, total: matched.length, orders: matched });
  } catch(e){ return json({ success:false, error:String(e) }, 500); }
}

async function handleDbStatus(env) {
  try {
    await env.DB.prepare("SELECT 1").first();
    return json({ connected:true, database:"fukupetstore-db (D1)", host:"cloudflare-d1" });
  } catch(e){ return json({ connected:false, error:String(e) }); }
}

async function handleInitDb(env) {
  await ensureTables(env);
  // seed if empty
  try {
    const cnt = await env.DB.prepare("SELECT COUNT(*) as c FROM site_sections").first();
    if (!cnt || cnt.c === 0) {
      for (const [k,v] of Object.entries(FALLBACK_DATA)) {
        await env.DB.prepare("INSERT OR IGNORE INTO site_sections (section_key, section_name, data_json) VALUES (?, ?, ?)").bind(k, k.replace(/_/g,' '), JSON.stringify(v)).run();
      }
    }
    // Ensure admin user exists
    await env.DB.prepare("INSERT OR IGNORE INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)").bind("admin", "$2y$10$wK1mJ7vF6F03uXy5X0yAte1ZcZ7UjT9e1s4bX3rE.9oQpC1n9cZre","Administrator").run();
    await env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)").bind("site_title","หมอนโคซี่ – Fukupetstore").run();
  } catch(e){ return json({ success:false, error:String(e) }, 500); }
  return json({ success:true, message:"สร้างตารางและติดตั้งข้อมูลเริ่มต้นเรียบร้อยแล้ว (D1)" });
}

async function handleLogin(request, env, input) {
  const username = String(input.username||"").trim();
  const password = String(input.password||"").trim();
  const expectedUser = env.ADMIN_USER || "admin";
  const expectedPass = env.ADMIN_PASS || "fukupet2026";
  
  let ok = false;
  let is_superadmin = false;
  
  if (username===expectedUser && password===expectedPass) {
    ok = true;
    is_superadmin = true;
  } else {
    try {
      const row = await env.DB.prepare("SELECT password_hash FROM admin_users WHERE username = ? LIMIT 1").bind(username).first();
      if (row) {
        const hashed = await sha256(password);
        if (row.password_hash === hashed || row.password_hash === password) { // allow plain for old seed fallback just in case
          ok = true;
        }
      }
    } catch {}
  }
  
  if (!ok) return json({ success:false, error:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  const token = randomToken(32);
  const expiresAt = new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,19).replace("T"," ");
  await ensureTables(env);
  await env.DB.prepare("INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)").bind(token, username, expiresAt).run();
  return json({ success:true, token, username, is_superadmin, message:"เข้าสู่ระบบสำเร็จ" }, 200, {
    "Set-Cookie": `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  });
}

async function handleLogout(request, env) {
  const cookies = parseCookies(request);
  const token = cookies["admin_token"]||"";
  if (token) {
    try { await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run(); } catch {}
  }
  return json({ success:true, message:"ออกจากระบบเรียบร้อยแล้ว" }, 200, {
    "Set-Cookie": "admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  });
}

async function handleCheckAuth(request, env) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  const is_superadmin = auth.username === expectedUser;
  return json({ logged_in: auth.ok, username: auth.username||null, is_superadmin });
}


async function handleGetAdminUsers(request, env) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  if (!auth.ok || auth.username !== expectedUser) return json({ success:false, error:"Permission denied" }, 403);
  try {
    const { results } = await env.DB.prepare("SELECT id, username, display_name, created_at FROM admin_users ORDER BY id DESC").all();
    return json({ success:true, data: results });
  } catch(e) { return json({ success:false, error:String(e) }, 500); }
}

async function handleCreateAdminUser(request, env, input) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  if (!auth.ok || auth.username !== expectedUser) return json({ success:false, error:"Permission denied" }, 403);
  const username = String(input.username||"").trim();
  const password = String(input.password||"").trim();
  const display_name = String(input.display_name||"").trim();
  if (!username || !password) return json({ success:false, error:"Username and password required" }, 400);
  try {
    const hash = await sha256(password);
    await env.DB.prepare("INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)").bind(username, hash, display_name).run();
    return json({ success:true, message:"สร้างผู้ใช้งานสำเร็จ" });
  } catch(e) { return json({ success:false, error:String(e) }, 500); }
}

async function handleDeleteAdminUser(request, env, input) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  if (!auth.ok || auth.username !== expectedUser) return json({ success:false, error:"Permission denied" }, 403);
  const id = input.id;
  if (!id) return json({ success:false, error:"ID required" }, 400);
  try {
    await env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(id).run();
    return json({ success:true, message:"ลบผู้ใช้งานสำเร็จ" });
  } catch(e) { return json({ success:false, error:String(e) }, 500); }
}

// Main fetch

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Serve R2 assets for /images/* and /slips/*
    if ((pathname.startsWith("/images/") || pathname.startsWith("/slips/")) && env.BUCKET) {
      const key = pathname.slice(1); // remove leading /
      try {
        const obj = await env.BUCKET.get(key);
        if (obj) {
          const headers = new Headers();
          obj.writeHttpMetadata(headers);
          headers.set("etag", obj.httpEtag);
          headers.set("Cache-Control", "public, max-age=86400");
          headers.set("Access-Control-Allow-Origin", "*");
          return new Response(obj.body, { headers });
        }
      } catch {}
      // fall through to ASSETS if not found in R2
    }

    // Detect API request: /api.php, /api, /api?action=xxx, or any ?action=
    const isApiPath = pathname === "/api.php" || pathname === "/api" || pathname.startsWith("/api/") || pathname === "/functions/api" || url.searchParams.has("action");
    // Also handle POST to /api.php with action in body
    let action = url.searchParams.get("action") || "";

    // For non-GET, try to peek body for action if not in query
    let jsonBody = null;
    let formData = null;
    if (isApiPath || pathname.includes("api")) {
      // Need to parse body to get action for POST JSON cases where action in body
      if (!action && request.method === "POST") {
        const ct = request.headers.get("Content-Type")||"";
        if (ct.includes("application/json")) {
          try {
            const clone = request.clone();
            jsonBody = await clone.json();
            action = jsonBody.action || jsonBody?.action || "";
          } catch {}
        } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
          // let handlers parse it
        }
      }

      // Unified routing
      if (action || isApiPath) {
        // Ensure table exists early
        await ensureTables(env);

        // Parse body once for handlers that need it
        const getJsonInput = async () => {
          if (jsonBody !== null) return jsonBody;
          const ct2 = request.headers.get("Content-Type")||"";
          if (ct2.includes("application/json")) {
            try { jsonBody = await request.json(); } catch { jsonBody = {}; }
            return jsonBody;
          }
          // For GET, use query
          const out = {};
          for (const [k,v] of url.searchParams) out[k]=v;
          return out;
        };

        try {
          switch (action) {
            case "get_content": return await handleGetContent(env);
            case "save_section": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              const input = await getJsonInput();
              return await handleSaveSection(env, input);
            }
            case "save_all": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              const input = await getJsonInput();
              return await handleSaveAll(env, input);
            }
            case "upload_image": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              return await handleUploadImage(request, env);
            }
            case "list_images": return await handleListImages(env);
            case "delete_image": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              const input = await getJsonInput();
              return await handleDeleteImage(env, input);
            }
            case "create_order": {
              const input = await getJsonInput();
              return await handleCreateOrder(env, input);
            }
            case "upload_slip": return await handleUploadSlip(request, env);
            case "get_orders": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              return await handleGetOrders(env);
            }
            case "update_order_status": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              const input = await getJsonInput();
              return await handleUpdateOrderStatus(env, input);
            }
            case "lookup_order": {
              const input = await getJsonInput();
              return await handleOrderLookup(env, input, request);
            }
            case "db_status": return await handleDbStatus(env);
            case "init_db": {
              const adm = await requireAdmin(request, env); if (adm) return adm;
              return await handleInitDb(env);
            }
            case "login": {
              const input = await getJsonInput();
              return await handleLogin(request, env, input);
            }
            case "logout": return await handleLogout(request, env);
            case "check_auth": return await handleCheckAuth(request, env);
            case "get_admin_users": return await handleGetAdminUsers(request, env);
            case "create_admin_user": {
              const input = await getJsonInput();
              return await handleCreateAdminUser(request, env, input);
            }
            case "delete_admin_user": {
              const input = await getJsonInput();
              return await handleDeleteAdminUser(request, env, input);
            }
            default:
              if (isApiPath && !action) return json({ error:"Invalid action", action }, 400);
              if (action) return json({ error:"Invalid action", action }, 400);
              break;
          }
        } catch(e) {
          return json({ success:false, error: String(e), stack: e.stack||"" }, 500);
        }
      }
    }

    // Block sensitive files from direct web access (mirrors .htaccess)
    const blocked = [".sql",".toml",".dev.vars","worker.js","config.php","dbsetup.php",".htaccess","deploy-cloudflare"];
    const lowerPath = pathname.toLowerCase();
    if (blocked.some(s => lowerPath.includes(s.toLowerCase())) || lowerPath.endsWith(".sql") || lowerPath.endsWith(".toml")) {
      return new Response("Forbidden", { status: 403, headers: CORS_HEADERS });
    }

    // Fallback: serve static assets
    if (env.ASSETS) {
      try {
        return await env.ASSETS.fetch(request);
      } catch(e) {
        // If ASSETS not configured, return 404
      }
    }
    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  }
};
