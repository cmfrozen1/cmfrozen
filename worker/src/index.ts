// Cloudflare Worker + D1 + R2 — CMFrozen Accounting API
// สอดคล้อง พ.ร.บ.การบัญชี พ.ศ.2543 + ประมวลรัษฎากร + TFRS for NPAEs
// - เลขที่เอกสารรันต่อเนื่อง (ม.87/4) ผ่าน doc_sequences
// - Double-Entry บังคับเดบิต=เครดิต
// - VAT 7% / WHT ภงด.3/53 / ภพ.30
// Deploy: npx wrangler deploy

export interface Env {
  DB: D1Database;
  UPLOADS?: R2Bucket;
  MAX_UPLOAD_MB: string;
  ALLOWED_ORIGINS: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: any, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...headers },
  });
}
function bad(msg: string, status = 400) { return json({ success:false, error: msg }, status); }

async function verifyUser(db: D1Database, username: string, password: string) {
  const row = await db.prepare("SELECT * FROM users WHERE username=? AND is_active=1").bind(username).first<any>();
  if (!row) return null;
  if (row.password_hash === password) return row;
  return null;
}

// ---------- เลขที่เอกสารรันต่อเนื่องตามกฎหมายไทย ----------
async function nextDocNo(db: D1Database, prefix: string): Promise<string> {
  // prefix เช่น AR-INV, AP-PAY, GL-JV, WHT
  const row = await db.prepare("SELECT * FROM doc_sequences WHERE prefix=?").bind(prefix).first<any>();
  const now = new Date();
  const YYYY = String(now.getFullYear());
  const YYYYMM = `${YYYY}${String(now.getMonth()+1).padStart(2,"0")}`;
  // ถ้าไม่มี prefix นี้ให้สร้างแบบสุ่มเดิม (fallback)
  if (!row) {
    const rand = String(Math.floor(Math.random()*9000)+1000);
    return `${prefix}-${YYYYMM}-${rand}`;
  }
  const next = (row.last_no || 0) + 1;
  await db.prepare("UPDATE doc_sequences SET last_no=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE prefix=?").bind(next, prefix).run();
  const NNNN = String(next).padStart(4,"0");
  let fmt = row.format || "{PREFIX}-{YYYYMM}-{NNNN}";
  return fmt.replace("{PREFIX}", prefix).replace("{YYYY}", YYYY).replace("{YYYYMM}", YYYYMM).replace("{NNNN}", NNNN);
}
function genDocNoFallback(prefix: string) {
  const d = new Date();
  const yyyymm = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}`;
  const rand = String(Math.floor(Math.random()*9000)+1000);
  return `${prefix}-${yyyymm}-${rand}`;
}

// คำนวณ VAT/WHT/Net ตามหลักสากลไทย — ปัด 2 ตำแหน่งถูกต้อง
function calcMoney(amount: number, vatRate: number, whtRate: number) {
  amount = Number(amount||0); vatRate = Number(vatRate||0); whtRate = Number(whtRate||0);
  const vat = Math.round(amount * vatRate)/100;
  const vat2 = Math.round(vat*100)/100;
  const total = Math.round((amount + vat2)*100)/100;
  const wht = Math.round(amount * whtRate)/100;
  const wht2 = Math.round(wht*100)/100;
  const net = Math.round((total - wht2)*100)/100;
  return { vat: vat2, total, wht: wht2, net };
}
function calcDueDate(docDate: string, creditTerm: number): string | null {
  if (!docDate || !creditTerm) return null;
  const d = new Date(docDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(creditTerm));
  return d.toISOString().slice(0,10);
}
const WHT_RATE_BY_INCOME: Record<string, number> = { '1':1, '2':3, '3':3, '5':3, '6':5, '8':3 };

// Migration แบบ lazy — เติมคอลัมน์ใหม่ถ้าไม่มี
let migrated = false;
async function ensureMigration(db: D1Database) {
  if (migrated) return;
  const stmts = [
    "ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT 'INV'",
    "ALTER TABLE documents ADD COLUMN due_date TEXT",
    "ALTER TABLE documents ADD COLUMN partner_tax_id TEXT",
    "ALTER TABLE documents ADD COLUMN partner_branch_no TEXT DEFAULT '00000'",
    "ALTER TABLE documents ADD COLUMN partner_address TEXT",
    "ALTER TABLE documents ADD COLUMN wht_rate REAL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN wht_amount REAL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN net_amount REAL DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN vat_rate REAL DEFAULT 7",
    "ALTER TABLE documents ADD COLUMN payment_method TEXT DEFAULT 'transfer'",
    "ALTER TABLE documents ADD COLUMN cheque_no TEXT",
    "ALTER TABLE documents ADD COLUMN bank_code TEXT",
    "ALTER TABLE documents ADD COLUMN is_posted INTEGER DEFAULT 0",
    "ALTER TABLE documents ADD COLUMN gl_voucher_no TEXT",
    "ALTER TABLE documents ADD COLUMN cancelled_reason TEXT",
    "ALTER TABLE document_lines ADD COLUMN gl_code TEXT",
    "ALTER TABLE document_lines ADD COLUMN unit TEXT DEFAULT 'kg'",
    "ALTER TABLE document_lines ADD COLUMN vat_type TEXT DEFAULT 'vat'",
    "ALTER TABLE document_lines ADD COLUMN vat_amount REAL DEFAULT 0",
    "ALTER TABLE document_lines ADD COLUMN wht_rate REAL DEFAULT 0",
    "ALTER TABLE document_lines ADD COLUMN wht_amount REAL DEFAULT 0",
    "ALTER TABLE document_lines ADD COLUMN cost_center TEXT",
    "ALTER TABLE document_lines ADD COLUMN remarks TEXT",
    "ALTER TABLE customers ADD COLUMN branch_no TEXT DEFAULT '00000'",
    "ALTER TABLE customers ADD COLUMN credit_term INTEGER DEFAULT 30",
    "ALTER TABLE customers ADD COLUMN vat_type TEXT DEFAULT 'vat'",
    "ALTER TABLE customers ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE vendors ADD COLUMN branch_no TEXT DEFAULT '00000'",
    "ALTER TABLE vendors ADD COLUMN wht_rate REAL DEFAULT 3",
    "ALTER TABLE vendors ADD COLUMN email TEXT",
    "ALTER TABLE vendors ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE attachments ADD COLUMN is_generated INTEGER DEFAULT 0",
    "ALTER TABLE attachments ADD COLUMN pdf_type TEXT",
    "ALTER TABLE inventory_items ADD COLUMN avg_cost REAL DEFAULT 0",
    "ALTER TABLE inventory_items ADD COLUMN gl_code TEXT",
    "ALTER TABLE inventory_items ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE bank_accounts ADD COLUMN account_no TEXT",
    "ALTER TABLE bank_accounts ADD COLUMN gl_code TEXT",
    "ALTER TABLE bank_accounts ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE tax_certs ADD COLUMN vendor_tax_id TEXT",
    "ALTER TABLE tax_certs ADD COLUMN vendor_address TEXT",
    "ALTER TABLE tax_certs ADD COLUMN payer_name TEXT",
    "ALTER TABLE tax_certs ADD COLUMN payer_tax_id TEXT",
    "ALTER TABLE tax_certs ADD COLUMN form_type TEXT DEFAULT '53'",
    "ALTER TABLE tax_certs ADD COLUMN income_desc TEXT",
    "ALTER TABLE tax_certs ADD COLUMN vat_amount REAL DEFAULT 0",
    "ALTER TABLE tax_certs ADD COLUMN payment_date TEXT",
    "ALTER TABLE tax_certs ADD COLUMN doc_ref TEXT",
    "ALTER TABLE tax_certs ADD COLUMN branch TEXT DEFAULT 'CM2'",
  ];
  for (const s of stmts) {
    try { await db.prepare(s).run(); } catch {}
  }
  // สร้างตารางใหม่ที่อาจยังไม่มี
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS doc_sequences (prefix TEXT PRIMARY KEY, last_no INTEGER DEFAULT 0, format TEXT DEFAULT '{PREFIX}-{YYYYMM}-{NNNN}', updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS gl_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_no TEXT NOT NULL, entry_date TEXT NOT NULL, doc_ref TEXT, account_code TEXT NOT NULL, account_name TEXT, description TEXT, debit REAL DEFAULT 0, credit REAL DEFAULT 0, branch TEXT DEFAULT 'CM2', period TEXT, is_posted INTEGER DEFAULT 0, created_by TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS accounting_periods (period TEXT PRIMARY KEY, status TEXT DEFAULT 'open', closed_by TEXT, closed_at TEXT, year_end INTEGER DEFAULT 0)`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS vat_periods (id INTEGER PRIMARY KEY AUTOINCREMENT, period TEXT UNIQUE NOT NULL, sale_base REAL DEFAULT 0, sale_vat REAL DEFAULT 0, purchase_base REAL DEFAULT 0, purchase_vat REAL DEFAULT 0, vat_payable REAL DEFAULT 0, status TEXT DEFAULT 'draft', filed_at TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS inventory_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, move_date TEXT NOT NULL, sku TEXT NOT NULL, move_type TEXT, qty REAL NOT NULL, unit_cost REAL DEFAULT 0, ref_no TEXT, description TEXT, branch TEXT DEFAULT 'CM2', created_by TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, module TEXT, ref_id TEXT, ref_no TEXT, detail TEXT, by_user TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS legacy_data (id INTEGER PRIMARY KEY AUTOINCREMENT, menu_code TEXT NOT NULL, title TEXT, code TEXT, name TEXT, detail TEXT, amount REAL DEFAULT 0, doc_date TEXT, status TEXT DEFAULT 'active', payload TEXT, branch TEXT DEFAULT 'CM2', created_by TEXT DEFAULT 'system', created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_legacy_menu ON legacy_data(menu_code)`).run();
    // seed sequences
    const seeds: [string,string][] = [
      ['AR-INV','AR-INV-{YYYYMM}-{NNNN}'],['AR-REC','AR-REC-{YYYYMM}-{NNNN}'],['AR-CN','AR-CN-{YYYYMM}-{NNNN}'],
      ['AR-DN','AR-DN-{YYYYMM}-{NNNN}'],['AP-INV','AP-INV-{YYYYMM}-{NNNN}'],['AP-PAY','AP-PAY-{YYYYMM}-{NNNN}'],
      ['FIN-PV','FIN-PV-{YYYYMM}-{NNNN}'],['FIN-RV','FIN-RV-{YYYYMM}-{NNNN}'],['GL-JV','GL-JV-{YYYYMM}-{NNNN}'],
      ['WHT','WHT-{YYYY}-{NNNN}'],['AR','AR-{YYYYMM}-{NNNN}'],['AP','AP-{YYYYMM}-{NNNN}'],['FIN','FIN-{YYYYMM}-{NNNN}']
    ];
    for (const [p,f] of seeds) {
      await db.prepare("INSERT OR IGNORE INTO doc_sequences(prefix,last_no,format) VALUES(?,?,?)").bind(p,0,f).run();
    }
    // เพิ่มผังบัญชีที่จำเป็นสำหรับ Double-Entry ที่ถูกต้องตามมาตรฐานสากล
    try { await db.prepare("INSERT OR IGNORE INTO chart_accounts(code,name,name_en,type,level,parent_code) VALUES('110601','ลูกหนี้ภาษีหัก ณ ที่จ่ายรอขอคืน','WHT Receivable','ASSET',3,'110600')").run(); } catch {}
    try { await db.prepare("INSERT OR IGNORE INTO chart_accounts(code,name,name_en,type,level,parent_code) VALUES('110600','ภาษีหัก ณ ที่จ่าย','WHT','ASSET',2,'110000')").run(); } catch {}
  } catch {}
  migrated = true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, { status:204, headers: CORS });
    // migrate lazily
    try { await ensureMigration(env.DB); } catch {}

    if (path === "/api/health") return json({ success:true, time:new Date().toISOString(), db: !!env.DB, r2: !!env.UPLOADS });

    // --- Auth ---
    if (path === "/api/auth/login" && request.method === "POST") {
      const { username, password } = await request.json<any>().catch(()=>({}));
      if (!username || !password) return bad("กรุณาระบุ username/password");
      const user = await verifyUser(env.DB, username, password);
      if (!user) return bad("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง", 401);
      const token = btoa(`${user.username}:${Date.now()}`);
      return json({ success:true, token, user:{ username:user.username, display_name:user.display_name, role:user.role, branch:user.branch }});
    }

    // --- Sequences ---
    if (path === "/api/sequences" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM doc_sequences ORDER BY prefix").all();
      return json({ success:true, data: results });
    }
    if (path === "/api/sequences/next" && request.method === "POST") {
      const b = await request.json<any>().catch(()=>({}));
      const prefix = b.prefix || "AR";
      const no = await nextDocNo(env.DB, prefix);
      return json({ success:true, doc_no: no });
    }

    // --- Upload (R2) ---
    if (path === "/api/upload" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file") as File | null;
        const module = (form.get("module") as string) || "GEN";
        const ref_id = (form.get("ref_id") as string) || "";
        const uploaded_by = (form.get("uploaded_by") as string) || "system";
        if (!file) return bad("ไม่พบไฟล์");
        const maxMb = parseInt(env.MAX_UPLOAD_MB || "20",10);
        if (file.size > maxMb*1024*1024) return bad(`ไฟล์เกิน ${maxMb} MB`);
        const ext = file.name.split(".").pop() || "bin";
        const key = `${module}/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
        let file_url = `/api/files/${encodeURIComponent(key)}`;
        if (env.UPLOADS) {
          const buf = await file.arrayBuffer();
          await env.UPLOADS.put(key, buf, { httpMetadata:{ contentType: file.type || "application/octet-stream" }});
        } else {
          file_url = `local:${key} (เปิด R2 ใน Cloudflare Dashboard เพื่อเก็บถาวร)`;
        }
        await env.DB.prepare(`INSERT INTO attachments(module,ref_id,file_name,file_url,mime_type,size_bytes,uploaded_by) VALUES(?,?,?,?,?,?,?)`)
          .bind(module, ref_id?Number(ref_id):null, file.name, file_url, file.type, file.size, uploaded_by).run();
        const row = await env.DB.prepare("SELECT * FROM attachments WHERE file_url=?").bind(file_url).first();
        return json({ success:true, url: file_url, key, attachment: row, r2_enabled: !!env.UPLOADS });
      } catch (e:any) { return bad("อัปโหลดล้มเหลว: "+e.message, 500); }
    }
    if (path.startsWith("/api/files/")) {
      if (!env.UPLOADS) return new Response("R2 ยังไม่ได้เปิดใช้งาน — เปิดที่ https://dash.cloudflare.com → R2 → Enable", { status: 501, headers: CORS });
      const key = decodeURIComponent(path.replace("/api/files/",""));
      const obj = await env.UPLOADS.get(key);
      if (!obj) return new Response("Not found", { status:404, headers:CORS });
      return new Response(obj.body, { headers:{ "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream", ...CORS }});
    }
    if (path === "/api/attachments" && request.method === "GET") {
      const mod = url.searchParams.get("module");
      const ref = url.searchParams.get("ref_id");
      let stmt:any;
      if (mod && ref) stmt = env.DB.prepare("SELECT * FROM attachments WHERE module=? AND ref_id=? ORDER BY id DESC").bind(mod, Number(ref));
      else if (mod) stmt = env.DB.prepare("SELECT * FROM attachments WHERE module=? ORDER BY id DESC").bind(mod);
      else stmt = env.DB.prepare("SELECT * FROM attachments ORDER BY id DESC LIMIT 100");
      const { results } = await stmt.all();
      return json({ success:true, data: results });
    }

    // --- Documents (AR/AP/FIN/TAX/GL/INV/COST) ---
    if (path === "/api/documents") {
      if (request.method === "GET") {
        const mod = url.searchParams.get("module") || url.searchParams.get("type");
        const status = url.searchParams.get("status");
        const doc_type = url.searchParams.get("doc_type");
        const branch = url.searchParams.get("branch");
        const q = url.searchParams.get("q");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        let sql = "SELECT * FROM documents WHERE 1=1";
        const binds:any[] = [];
        if (mod) { sql+=" AND module=?"; binds.push(mod); }
        if (doc_type) { sql+=" AND doc_type=?"; binds.push(doc_type); }
        if (status) { sql+=" AND status=?"; binds.push(status); }
        if (branch) { sql+=" AND branch=?"; binds.push(branch); }
        if (from) { sql+=" AND doc_date>=?"; binds.push(from); }
        if (to) { sql+=" AND doc_date<=?"; binds.push(to); }
        if (q) { sql+=" AND (doc_no LIKE ? OR partner_name LIKE ? OR description LIKE ?)"; binds.push(`%${q}%`,`%${q}%`,`%${q}%`); }
        sql+=" ORDER BY doc_date DESC, id DESC LIMIT 300";
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        if (!b.module) return bad("ต้องระบุ module (AR/AP/FIN/TAX/GL)");
        // เลขที่เอกสารตามกฎหมาย — ถ้าไม่ส่งมาให้รันอัตโนมัติ
        const prefixMap: Record<string,string> = { AR: b.doc_type?`AR-${b.doc_type}`:'AR-INV', AP: b.doc_type?`AP-${b.doc_type}`:'AP-INV', FIN: b.doc_type?`FIN-${b.doc_type}`:'FIN-RV', GL:'GL-JV', TAX: b.doc_type==='WHT'?'WHT':'TAX', INV:'INV-REC', COST:'GL-JV' };
        const seqPrefix = b.seq_prefix || prefixMap[b.module] || b.module;
        const doc_no = b.doc_no || await nextDocNo(env.DB, seqPrefix).catch(()=> genDocNoFallback(b.module));
        const doc_date = b.doc_date || new Date().toISOString().slice(0,10);
        // ตรวจงวดปิด — ห้ามสร้างย้อนหลัง
        const docPeriod = doc_date.slice(0,7);
        const perCheck = await env.DB.prepare("SELECT status FROM accounting_periods WHERE period=?").bind(docPeriod).first<any>();
        if (perCheck && perCheck.status !== 'open') return bad(`งวด ${docPeriod} ปิดแล้ว ห้ามสร้างเอกสาร`, 403);
        // คำนวณ due_date จาก credit_term ถ้าไม่ส่งมา
        let due_date = b.due_date || null;
        if (!due_date && b.partner_code) {
          const cust = await env.DB.prepare("SELECT credit_term FROM customers WHERE code=?").bind(b.partner_code).first<any>();
          const vend = cust ? null : await env.DB.prepare("SELECT credit_term FROM vendors WHERE code=?").bind(b.partner_code).first<any>();
          const ct = cust?.credit_term ?? (vend ? 30 : 0);
          if (ct) due_date = calcDueDate(doc_date, Number(ct));
        }
        if (!due_date && b.credit_term) due_date = calcDueDate(doc_date, Number(b.credit_term));
        // คำนวณ VAT/WHT อัตโนมัติ
        let amount = Number(b.amount||0);
        // ถ้าส่ง lines มา ให้รวมจาก lines
        if (Array.isArray(b.lines) && b.lines.length) {
          amount = b.lines.reduce((s:number,l:any)=> s + Number(l.amount|| Number(l.qty||1)*Number(l.unit_price||0)), 0);
        }
        const vatRate = Number(b.vat_rate ?? 7);
        const whtRate = Number(b.wht_rate ?? 0);
        const calc = calcMoney(amount, vatRate, whtRate);
        const vat_amount = b.vat_amount!==undefined ? Number(b.vat_amount) : calc.vat;
        const wht_amount = b.wht_amount!==undefined ? Number(b.wht_amount) : calc.wht;
        const total_amount = b.total_amount!==undefined ? Number(b.total_amount) : calc.total;
        const net_amount = b.net_amount!==undefined ? Number(b.net_amount) : calc.net;
        try {
          await env.DB.prepare(`INSERT INTO documents(module,doc_type,doc_no,doc_date,due_date,ref_no,partner_code,partner_name,partner_tax_id,partner_branch_no,partner_address,description,amount,vat_rate,vat_amount,wht_rate,wht_amount,total_amount,net_amount,payment_method,cheque_no,bank_code,status,branch,created_by,is_posted)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(b.module, b.doc_type||'INV', doc_no, doc_date, due_date, b.ref_no||null, b.partner_code||null, b.partner_name||null, b.partner_tax_id||null, b.partner_branch_no||'00000', b.partner_address||null, b.description||"", amount, vatRate, vat_amount, whtRate, wht_amount, total_amount, net_amount, b.payment_method||'transfer', b.cheque_no||null, b.bank_code||null, b.status||"draft", b.branch||"CM2", b.created_by||"system", b.is_posted?1:0).run();
        } catch (e:any) {
          // fallback ถ้า column ไม่ครบ (DB เก่า)
          await env.DB.prepare(`INSERT INTO documents(module,doc_no,doc_date,partner_code,partner_name,description,amount,vat_amount,total_amount,status,branch,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(b.module, doc_no, doc_date, b.partner_code||null, b.partner_name||null, b.description||"", amount, vat_amount, total_amount, b.status||"draft", b.branch||"CM2", b.created_by||"system").run();
        }
        const row = await env.DB.prepare("SELECT * FROM documents WHERE doc_no=?").bind(doc_no).first();
        if (Array.isArray(b.lines) && row) {
          for (let i=0;i<b.lines.length;i++) {
            const l=b.lines[i];
            const la = Number(l.amount|| Number(l.qty||1)*Number(l.unit_price||0));
            const lv = l.vat_amount!==undefined? Number(l.vat_amount): Math.round(la * Number(l.vat_rate??vatRate))/100;
            try {
              await env.DB.prepare("INSERT INTO document_lines(document_id,line_no,item_code,description,gl_code,qty,unit,unit_price,amount,vat_type,vat_rate,vat_amount,wht_rate,wht_amount,cost_center,remarks) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                .bind(row.id, i+1, l.item_code||null, l.description, l.gl_code||null, Number(l.qty||1), l.unit||'kg', Number(l.unit_price||0), la, l.vat_type||'vat', Number(l.vat_rate??vatRate), lv, Number(l.wht_rate||0), Number(l.wht_amount||0), l.cost_center||null, l.remarks||null).run();
            } catch {
              await env.DB.prepare("INSERT INTO document_lines(document_id,line_no,item_code,description,qty,unit_price,amount) VALUES(?,?,?,?,?,?,?)")
                .bind(row.id, i+1, l.item_code||null, l.description, Number(l.qty||1), Number(l.unit_price||0), la).run();
            }
          }
        }
        // audit
        try { await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("CREATE", b.module, String(row?.id||''), doc_no, b.description||'', b.created_by||'system').run(); } catch {}
        // auto inventory move ถ้าเป็น INV
        if (b.module==='INV' && Array.isArray(b.lines) && row) {
          for (const l of b.lines) {
            if (l.item_code) {
              try { await env.DB.prepare("INSERT INTO inventory_moves(move_date,sku,move_type,qty,unit_cost,ref_no,description,branch,created_by) VALUES(?,?,?,?,?,?,?,?,?)")
                .bind(doc_date, l.item_code, b.doc_type==='RECEIVE'?'RECEIVE':'ISSUE', Number(l.qty||0), Number(l.unit_price||0), doc_no, l.description, b.branch||'CM2', b.created_by||'system').run();
                // update qty_on_hand
                const sign = b.doc_type==='RECEIVE'? 1 : -1;
                await env.DB.prepare("UPDATE inventory_items SET qty_on_hand = qty_on_hand + ? WHERE sku=?").bind(sign*Number(l.qty||0), l.item_code).run();
              } catch {}
            }
          }
        }
        return json({ success:true, data: row });
      }
    }
    if (path.match(/^\/api\/documents\/\d+$/)) {
      const id = Number(path.split("/").pop());
      if (request.method === "GET") {
        const doc = await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first();
        if (!doc) return bad("ไม่พบเอกสาร",404);
        const { results: lines } = await env.DB.prepare("SELECT * FROM document_lines WHERE document_id=? ORDER BY line_no").bind(id).all();
        let files:any[]=[]; try { const r=await env.DB.prepare("SELECT * FROM attachments WHERE module='DOC' AND ref_id=?").bind(id).all(); files=r.results||[]; } catch {}
        let gls:any[]=[]; try { if ((doc as any).gl_voucher_no) { const r=await env.DB.prepare("SELECT * FROM gl_entries WHERE voucher_no=?").bind((doc as any).gl_voucher_no).all(); gls=r.results||[]; } } catch {}
        return json({ success:true, data: doc, lines, attachments: files, gl_entries: gls });
      }
      if (request.method === "PUT") {
        const b = await request.json<any>();
        const cur = await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<any>();
        if (!cur) return bad("ไม่พบเอกสาร",404);
        if (cur.status==='cancelled' || cur.status==='void') return bad("เอกสารที่ยกเลิกแล้วแก้ไขไม่ได้");
        // ปิดงวดห้ามแก้
        const period = (cur.doc_date||'').slice(0,7);
        if (period) {
          const p = await env.DB.prepare("SELECT * FROM accounting_periods WHERE period=?").bind(period).first<any>();
          if (p && p.status!=='open') return bad(`งวด ${period} ปิดแล้ว ห้ามแก้ไข`, 403);
        }
        const calc = calcMoney(Number(b.amount ?? cur.amount), Number(b.vat_rate ?? cur.vat_rate ?? 7), Number(b.wht_rate ?? cur.wht_rate ?? 0));
        try {
          await env.DB.prepare(`UPDATE documents SET description=?, amount=?, vat_rate=?, vat_amount=?, wht_rate=?, wht_amount=?, total_amount=?, net_amount=?, status=?, partner_name=?, partner_tax_id=?, due_date=?, payment_method=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
            .bind(b.description ?? cur.description, Number(b.amount ?? cur.amount), Number(b.vat_rate ?? cur.vat_rate), b.vat_amount!==undefined?Number(b.vat_amount):calc.vat, Number(b.wht_rate ?? cur.wht_rate), b.wht_amount!==undefined?Number(b.wht_amount):calc.wht, b.total_amount!==undefined?Number(b.total_amount):calc.total, b.net_amount!==undefined?Number(b.net_amount):calc.net, b.status ?? cur.status, b.partner_name ?? cur.partner_name, b.partner_tax_id ?? cur.partner_tax_id, b.due_date ?? cur.due_date, b.payment_method ?? cur.payment_method, id).run();
        } catch {
          await env.DB.prepare(`UPDATE documents SET description=?, amount=?, vat_amount=?, total_amount=?, status=?, partner_name=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
            .bind(b.description ?? cur.description, Number(b.amount ?? cur.amount), Number(b.vat_amount ?? cur.vat_amount), Number(b.total_amount ?? cur.total_amount), b.status ?? cur.status, b.partner_name ?? cur.partner_name, id).run();
        }
        try { await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("UPDATE", cur.module, String(id), cur.doc_no, b.description||'', b.updated_by||'system').run(); } catch {}
        const row = await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first();
        return json({ success:true, data: row });
      }
      if (request.method === "DELETE") {
        const cur = await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<any>();
        if (!cur) return bad("ไม่พบเอกสาร",404);
        const period = (cur.doc_date||'').slice(0,7);
        if (period) {
          const p = await env.DB.prepare("SELECT * FROM accounting_periods WHERE period=?").bind(period).first<any>();
          if (p && p.status!=='open') return bad(`งวด ${period} ปิดแล้ว ห้ามลบ`, 403);
        }
        await env.DB.prepare("DELETE FROM document_lines WHERE document_id=?").bind(id).run();
        await env.DB.prepare("DELETE FROM documents WHERE id=?").bind(id).run();
        try { await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("DELETE", cur.module, String(id), cur.doc_no, 'ลบเอกสาร', 'system').run(); } catch {}
        return json({ success:true });
      }
    }
    // POST /api/documents/:id/post — ผ่านรายการไป GL (Double-Entry)
    if (path.match(/^\/api\/documents\/\d+\/post$/)) {
      const id = Number(path.split("/")[3]);
      if (request.method === "POST") {
        const doc = await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<any>();
        if (!doc) return bad("ไม่พบเอกสาร",404);
        if (doc.is_posted) return bad("เอกสารนี้ผ่านรายการแล้ว");
        if (doc.status==='cancelled' || doc.status==='void') return bad("เอกสารยกเลิกไม่สามารถผ่านรายการได้");
        const period = (doc.doc_date||'').slice(0,7);
        const per = await env.DB.prepare("SELECT * FROM accounting_periods WHERE period=?").bind(period).first<any>();
        if (per && per.status!=='open') return bad(`งวด ${period} ปิดแล้ว`,403);
        const { lines } = await (async()=>{
          const { results } = await env.DB.prepare("SELECT * FROM document_lines WHERE document_id=? ORDER BY line_no").bind(id).all();
          return { lines: results };
        })();
        // สร้าง GL voucher อัตโนมัติตามโมดูล
        const vNo = doc.gl_voucher_no || await nextDocNo(env.DB, "GL-JV").catch(()=> genDocNoFallback("GL-JV"));
        let entries: any[] = [];
        const amt = Number(doc.amount||0), vat = Number(doc.vat_amount||0), wht = Number(doc.wht_amount||0), total = Number(doc.total_amount||0);
        // แยก VAT ตามประเภท — vat/nonvat/zero/exempt → ลงบัญชีต่างกัน
        const vatType = (doc as any).vat_type || 'vat';
        if (doc.module==='AR') {
          // Dr ลูกหนี้สุทธิ + Dr WHT / Cr รายได้ / Cr ภาษีขาย (ถ้า vat)
          entries.push({ ac:'110201', dr: total, cr:0, desc: `ลูกหนี้ ${doc.partner_name||''}` });
          if (amt) {
            const revAc = vatType==='zero' ? '410200' : (vatType==='exempt' ? '420000' : '410100');
            entries.push({ ac: revAc, dr:0, cr:amt, desc: doc.description||'รายได้ขาย' });
          }
          if (vat && vatType==='vat') entries.push({ ac:'210301', dr:0, cr:vat, desc:'ภาษีขาย 7%' });
          else if (vat && vatType!=='vat') entries.push({ ac:'210302', dr:0, cr:vat, desc:'ภาษีขายยังไม่ถึงกำหนด' });
          if (wht) { entries.push({ ac:'110601', dr:wht, cr:0, desc:'ลูกหนี้ WHT รอขอคืน (ภงด.53)' }); entries[0].dr = Number(doc.net_amount|| total - wht); }
        } else if (doc.module==='AP') {
          entries.push({ ac:'510100', dr: amt, cr:0, desc: doc.description||'ต้นทุน' });
          if (vat && vatType==='vat') entries.push({ ac:'110501', dr: vat, cr:0, desc:'ภาษีซื้อ' });
          else if (vat) entries.push({ ac:'110502', dr: vat, cr:0, desc:'ภาษีซื้อรอขอคืน' });
          entries.push({ ac:'210100', dr:0, cr: total - wht, desc:`เจ้าหนี้ ${doc.partner_name||''}` });
          if (wht) entries.push({ ac:'210400', dr:0, cr: wht, desc:'WHT ค้างนำส่ง' });
        } else if (doc.module==='FIN') {
          const isRV = doc.doc_type==='RV' || doc.amount>0;
          if (isRV) {
            entries.push({ ac: doc.bank_code||'110102', dr: total, cr:0, desc: doc.description||'รับเงิน' });
            entries.push({ ac:'110201', dr:0, cr: total, desc:'ตัดลูกหนี้' });
          } else {
            entries.push({ ac:'210100', dr: total, cr:0, desc:'ตัดเจ้าหนี้' });
            entries.push({ ac: doc.bank_code||'110102', dr:0, cr: total, desc: doc.description||'จ่ายเงิน' });
          }
        } else if (doc.module==='GL') {
          // ใช้ lines เป็น gl entries โดยตรง — ต้องส่ง debit/credit มา
          const b = await request.json<any>().catch(()=>({}));
          if (Array.isArray(b.entries) && b.entries.length) {
            for (const e of b.entries) entries.push({ ac:e.account_code, dr:Number(e.debit||0), cr:Number(e.credit||0), desc:e.description||doc.description });
          } else if (lines && (lines as any[]).length) {
            for (const l of (lines as any[])) entries.push({ ac:(l as any).gl_code||'620000', dr:Number((l as any).debit||0), cr:Number((l as any).credit||0), desc:(l as any).description||doc.description });
          }
        }
        if (!entries.length) return bad("ไม่สามารถสร้าง GL อัตโนมัติได้ — กรุณาระบุ GL entries");
        const sumDr = entries.reduce((s,e)=> s+Number(e.dr||0),0);
        const sumCr = entries.reduce((s,e)=> s+Number(e.cr||0),0);
        if (Math.abs(sumDr - sumCr) > 0.01) return bad(`เดบิต (${sumDr.toLocaleString()}) ไม่เท่ากับ เครดิต (${sumCr.toLocaleString()}) — ไม่ผ่านหลักบัญชีคู่`);
        // ใช้ batch เพื่อให้ atomic — ค้างกลางทางจะ rollback
        const batch: D1PreparedStatement[] = [];
        for (const e of entries) {
          const acc = await env.DB.prepare("SELECT name FROM chart_accounts WHERE code=?").bind(e.ac).first<any>();
          batch.push(env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(vNo, doc.doc_date, doc.doc_no, e.ac, acc?.name||e.ac, e.desc, Number(e.dr||0), Number(e.cr||0), doc.branch||'CM2', period, 1, 'system'));
        }
        batch.push(env.DB.prepare("UPDATE documents SET is_posted=1, gl_voucher_no=?, status='posted', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(vNo, id));
        await env.DB.batch(batch);
        try { await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("POST", doc.module, String(id), doc.doc_no, `ผ่านรายการ ${vNo} Dr=${sumDr} Cr=${sumCr}`, 'system').run(); } catch {}
        return json({ success:true, voucher_no: vNo, entries, sumDr, sumCr });
      }
    }
    // POST /api/documents/:id/void — ยกเลิก (กลับรายการ)
    if (path.match(/^\/api\/documents\/\d+\/void$/)) {
      const id = Number(path.split("/")[3]);
      if (request.method === "POST") {
        const b = await request.json<any>().catch(()=>({}));
        const doc = await env.DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first<any>();
        if (!doc) return bad("ไม่พบเอกสาร",404);
        const period = (doc.doc_date||'').slice(0,7);
        const per = await env.DB.prepare("SELECT * FROM accounting_periods WHERE period=?").bind(period).first<any>();
        if (per && per.status!=='open') return bad(`งวด ${period} ปิดแล้ว ห้ามยกเลิก`,403);
        await env.DB.prepare("UPDATE documents SET status='cancelled', is_posted=0, cancelled_reason=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(b.reason||'ยกเลิกโดยผู้ใช้', id).run();
        // กลับรายการ GL (reverse) แบบ batch
        if (doc.gl_voucher_no) {
          const { results } = await env.DB.prepare("SELECT * FROM gl_entries WHERE voucher_no=?").bind(doc.gl_voucher_no).all();
          const revNo = await nextDocNo(env.DB, "GL-JV").catch(()=> genDocNoFallback("GL-JV"));
          const revBatch: D1PreparedStatement[] = [];
          for (const r of (results as any[])) {
            revBatch.push(env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
              .bind(revNo, new Date().toISOString().slice(0,10), `REV-${doc.doc_no}`, r.account_code, r.account_name, `กลับรายการ ${doc.doc_no}`, Number(r.credit||0), Number(r.debit||0), r.branch, new Date().toISOString().slice(0,7), 1, 'system'));
          }
          if (revBatch.length) await env.DB.batch(revBatch);
        }
        try { await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("VOID", doc.module, String(id), doc.doc_no, b.reason||'', 'system').run(); } catch {}
        return json({ success:true });
      }
    }

    // --- GL Entries ---
    if (path === "/api/gl-entries") {
      if (request.method === "GET") {
        const period = url.searchParams.get("period");
        const voucher = url.searchParams.get("voucher");
        const account = url.searchParams.get("account");
        let sql="SELECT * FROM gl_entries WHERE 1=1";
        const binds:any[]=[];
        if (period) { sql+=" AND period=?"; binds.push(period); }
        if (voucher) { sql+=" AND voucher_no=?"; binds.push(voucher); }
        if (account) { sql+=" AND account_code=?"; binds.push(account); }
        sql+=" ORDER BY entry_date DESC, id DESC LIMIT 500";
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        const vNo = b.voucher_no || await nextDocNo(env.DB, "GL-JV").catch(()=> genDocNoFallback("GL-JV"));
        const period = (b.entry_date||new Date().toISOString().slice(0,10)).slice(0,7);
        const per = await env.DB.prepare("SELECT * FROM accounting_periods WHERE period=?").bind(period).first<any>();
        if (per && per.status!=='open') return bad(`งวด ${period} ปิดแล้ว`,403);
        if (!Array.isArray(b.entries) || !b.entries.length) return bad("ต้องมี entries อย่างน้อย 1 รายการ");
        const sumDr = b.entries.reduce((s:number,e:any)=> s+Number(e.debit||0),0);
        const sumCr = b.entries.reduce((s:number,e:any)=> s+Number(e.credit||0),0);
        if (Math.abs(sumDr - sumCr) > 0.01) return bad(`เดบิต ${sumDr} ≠ เครดิต ${sumCr}`);
        for (const e of b.entries) {
          const acc = await env.DB.prepare("SELECT name FROM chart_accounts WHERE code=?").bind(e.account_code).first<any>();
          await env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(vNo, b.entry_date||new Date().toISOString().slice(0,10), b.doc_ref||null, e.account_code, acc?.name||e.account_code, e.description||b.description||'', Number(e.debit||0), Number(e.credit||0), b.branch||'CM2', period, 1, b.created_by||'system').run();
        }
        // สร้าง documents GL ด้วย
        try {
          await env.DB.prepare("INSERT INTO documents(module,doc_type,doc_no,doc_date,description,amount,total_amount,status,branch,created_by,is_posted,gl_voucher_no) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind('GL','JV',vNo, b.entry_date||new Date().toISOString().slice(0,10), b.description||'GL Voucher', sumDr, sumDr, 'posted', b.branch||'CM2', b.created_by||'system', 1, vNo).run();
        } catch {}
        return json({ success:true, voucher_no: vNo, sumDr, sumCr });
      }
    }

    // --- Reports ---
    if (path === "/api/reports/trial-balance" && request.method === "GET") {
      const period = url.searchParams.get("period") || new Date().toISOString().slice(0,7);
      const branch = url.searchParams.get("branch");
      let sql = "SELECT account_code, account_name, SUM(debit) as sumDr, SUM(credit) as sumCr FROM gl_entries WHERE period=? ";
      const binds:any[]=[period];
      if (branch) { sql+=" AND branch=? "; binds.push(branch); }
      sql+=" GROUP BY account_code, account_name ORDER BY account_code";
      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      const rows = (results as any[]).map(r=> ({ ...r, balance: Number(r.sumDr||0)-Number(r.sumCr||0) }));
      const totDr = rows.reduce((s,r)=> s+Number(r.sumDr||0),0);
      const totCr = rows.reduce((s,r)=> s+Number(r.sumCr||0),0);
      return json({ success:true, period, data: rows, total:{ debit: totDr, credit: totCr, balanced: Math.abs(totDr-totCr)<0.01 }});
    }
    if (path === "/api/reports/vat" && request.method === "GET") {
      const period = url.searchParams.get("period") || new Date().toISOString().slice(0,7);
      const sale = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) as base, COALESCE(SUM(vat_amount),0) as vat FROM documents WHERE substr(doc_date,1,7)=? AND module='AR' AND status!='cancelled' AND vat_amount>0").bind(period).first<any>();
      const purch = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) as base, COALESCE(SUM(vat_amount),0) as vat FROM documents WHERE substr(doc_date,1,7)=? AND module='AP' AND status!='cancelled' AND vat_amount>0").bind(period).first<any>();
      const payable = Number(sale.vat||0) - Number(purch.vat||0);
      return json({ success:true, period, data:{ sale_base: sale.base, sale_vat: sale.vat, purchase_base: purch.base, purchase_vat: purch.vat, vat_payable: payable }});
    }
    if (path === "/api/reports/aging" && request.method === "GET") {
      const mod = url.searchParams.get("module") || "AR";
      const asOf = url.searchParams.get("asOf") || new Date().toISOString().slice(0,10);
      const { results } = await env.DB.prepare("SELECT * FROM documents WHERE module=? AND status IN ('posted','overdue') AND doc_date <= ? ORDER BY due_date").bind(mod, asOf).all();
      const enriched = (results as any[]).map(r=> {
        const due = r.due_date || r.doc_date;
        const days = Math.floor((new Date(asOf).getTime() - new Date(due).getTime())/86400000);
        let bucket='current';
        if (days>90) bucket='>90';
        else if (days>60) bucket='61-90';
        else if (days>30) bucket='31-60';
        else if (days>0) bucket='1-30';
        return { ...r, days_overdue: days>0?days:0, bucket };
      });
      return json({ success:true, asOf, data: enriched });
    }
    if (path === "/api/accounting-periods" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM accounting_periods ORDER BY period DESC").all();
      return json({ success:true, data: results });
    }
    if (path.match(/^\/api\/accounting-periods\/[^/]+\/close$/)) {
      const period = decodeURIComponent(path.split("/")[3]);
      if (request.method === "POST") {
        const { results } = await env.DB.prepare("SELECT SUM(debit) as dr, SUM(credit) as cr FROM gl_entries WHERE period=?").bind(period).all();
        const r=(results as any[])[0];
        if (Math.abs(Number(r.dr||0)-Number(r.cr||0))>0.01) return bad(`งบทดลองงวด ${period} ไม่สมดุล Dr ${r.dr} Cr ${r.cr} ปิดงวดไม่ได้`, 400);
        await env.DB.prepare("INSERT INTO accounting_periods(period,status,closed_by,closed_at) VALUES(?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(period) DO UPDATE SET status='closed', closed_by=excluded.closed_by").bind(period,'closed','system').run();
        return json({ success:true, period });
      }
    }

    // --- Customers / Vendors ---
    for (const tbl of ["customers","vendors"]) {
      if (path === `/api/${tbl}`) {
        if (request.method === "GET") {
          const q = url.searchParams.get("q");
          let sql = `SELECT * FROM ${tbl} ORDER BY id DESC LIMIT 200`;
          let binds:any[] = [];
          if (q) { sql = `SELECT * FROM ${tbl} WHERE code LIKE ? OR name LIKE ? OR tax_id LIKE ? ORDER BY id DESC LIMIT 200`; binds=[`%${q}%`,`%${q}%`,`%${q}%`]; }
          const { results } = await env.DB.prepare(sql).bind(...binds).all();
          return json({ success:true, data: results });
        }
        if (request.method === "POST") {
          const b = await request.json<any>();
          if (!b.name) return bad("ต้องระบุชื่อ");
          if (b.tax_id && !/^\d{13}$/.test(String(b.tax_id).replace(/-/g,''))) return bad("เลขประจำตัวผู้เสียภาษีต้องเป็น 13 หลัก");
          const code = b.code || `${tbl==='customers'?'CUST':'VEND'}-${Date.now().toString().slice(-6)}`;
          try {
            await env.DB.prepare(`INSERT INTO ${tbl}(code,name,tax_id,branch_no,address,phone,email,branch) VALUES(?,?,?,?,?,?,?,?)`)
              .bind(code, b.name, b.tax_id||null, b.branch_no||'00000', b.address||null, b.phone||null, b.email||null, b.branch||'CM2').run();
          } catch (e:any) {
            if (String(e.message).includes("UNIQUE")) return bad("รหัสซ้ำ");
            throw e;
          }
          const row = await env.DB.prepare(`SELECT * FROM ${tbl} WHERE code=?`).bind(code).first();
          return json({ success:true, data: row });
        }
      }
      const m = path.match(new RegExp(`^/api/${tbl}/(\\d+)$`));
      if (m) {
        const id = Number(m[1]);
        if (request.method === "PUT") {
          const b = await request.json<any>();
          await env.DB.prepare(`UPDATE ${tbl} SET name=?, tax_id=?, address=?, phone=?, email=? WHERE id=?`).bind(b.name,b.tax_id,b.address,b.phone,b.email,id).run();
          const row = await env.DB.prepare(`SELECT * FROM ${tbl} WHERE id=?`).bind(id).first();
          return json({ success:true, data: row });
        }
        if (request.method === "DELETE") {
          await env.DB.prepare(`DELETE FROM ${tbl} WHERE id=?`).bind(id).run();
          return json({ success:true });
        }
      }
    }

    // --- Inventory ---
    if (path === "/api/inventory") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM inventory_items ORDER BY sku").all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        if (!b.name_th) return bad("ต้องระบุชื่อสินค้า");
        const sku = b.sku || `SKU-${Date.now().toString().slice(-6)}`;
        await env.DB.prepare("INSERT INTO inventory_items(sku,name_th,name_en,category,unit,temp,qty_on_hand,avg_cost,cost_per_unit,gl_code,image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
          .bind(sku, b.name_th, b.name_en||null, b.category||"vegetable", b.unit||"kg", b.temp||"-18°C", Number(b.qty_on_hand||0), Number(b.avg_cost||b.cost_per_unit||0), Number(b.cost_per_unit||0), b.gl_code||'110300', b.image_url||null).run();
        const row = await env.DB.prepare("SELECT * FROM inventory_items WHERE sku=?").bind(sku).first();
        return json({ success:true, data: row });
      }
    }
    if (path === "/api/inventory/moves" && request.method === "GET") {
      const sku = url.searchParams.get("sku");
      let sql="SELECT * FROM inventory_moves WHERE 1=1";
      const binds:any[]=[];
      if (sku) { sql+=" AND sku=?"; binds.push(sku); }
      sql+=" ORDER BY move_date DESC, id DESC LIMIT 200";
      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      return json({ success:true, data: results });
    }
    if (path === "/api/inventory/moves" && request.method === "POST") {
      const b = await request.json<any>();
      if (!b.sku || !b.qty) return bad("ต้องระบุ sku และ qty");
      const moveDate = b.move_date||new Date().toISOString().slice(0,10);
      const period = moveDate.slice(0,7);
      const per = await env.DB.prepare("SELECT status FROM accounting_periods WHERE period=?").bind(period).first<any>();
      if (per && per.status !== 'open') return bad(`งวด ${period} ปิดแล้ว ห้ามเคลื่อนไหวสต็อก`,403);
      const qty = Number(b.qty); const unitCost = Number(b.unit_cost||0);
      const item = await env.DB.prepare("SELECT qty_on_hand, avg_cost, gl_code FROM inventory_items WHERE sku=?").bind(b.sku).first<any>();
      if (!item) return bad("ไม่พบสินค้า "+b.sku,404);
      if ((b.move_type==='ISSUE'||b.move_type==='TRANSFER') && Number(item.qty_on_hand) < qty) return bad(`สต็อกไม่พอ คงเหลือ ${item.qty_on_hand} ${b.sku}`);
      await env.DB.prepare("INSERT INTO inventory_moves(move_date,sku,move_type,qty,unit_cost,ref_no,description,branch,created_by) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(moveDate, b.sku, b.move_type||'RECEIVE', qty, unitCost, b.ref_no||null, b.description||'', b.branch||'CM2', b.created_by||'system').run();
      let glVoucher: string | null = null;
      if (b.move_type==='RECEIVE' || b.move_type==='ADJUST') {
        const oldQty = Number(item.qty_on_hand||0); const oldAvg = Number(item.avg_cost||0);
        const newQty = oldQty + qty;
        const newAvg = newQty>0 ? (oldQty*oldAvg + qty*unitCost)/newQty : oldAvg;
        await env.DB.prepare("UPDATE inventory_items SET qty_on_hand=?, avg_cost=?, cost_per_unit=? WHERE sku=?").bind(newQty, Math.round(newAvg*100)/100, Math.round(newAvg*100)/100, b.sku).run();
        // GL: Dr สินค้าคงเหลือ 110300 / Cr ต้นทุน/เจ้าหนี้
        try{
          const vNo = await nextDocNo(env.DB, "GL-JV").catch(()=> genDocNoFallback("GL-JV"));
          glVoucher=vNo;
          const amt = qty * unitCost;
          await env.DB.batch([
            env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
              .bind(vNo, moveDate, b.ref_no||b.sku, item.gl_code||'110300', 'สินค้าคงเหลือ', `รับ ${b.sku} ${qty}`, amt, 0, b.branch||'CM2', period, 1),
            env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
              .bind(vNo, moveDate, b.ref_no||b.sku, '510100', 'ต้นทุน', `รับ ${b.sku}`, 0, amt, b.branch||'CM2', period, 1)
          ]);
        }catch{}
      } else {
        const cogs = Number(item.avg_cost||unitCost) * qty;
        await env.DB.prepare("UPDATE inventory_items SET qty_on_hand = qty_on_hand - ? WHERE sku=?").bind(qty, b.sku).run();
        try{
          const vNo = await nextDocNo(env.DB, "GL-JV").catch(()=> genDocNoFallback("GL-JV"));
          glVoucher=vNo;
          await env.DB.batch([
            env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
              .bind(vNo, moveDate, b.ref_no||b.sku, '510100', 'ต้นทุนขาย', `เบิก ${b.sku} ${qty}`, cogs, 0, b.branch||'CM2', period, 1),
            env.DB.prepare("INSERT INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
              .bind(vNo, moveDate, b.ref_no||b.sku, item.gl_code||'110300', 'สินค้าคงเหลือ', `เบิก ${b.sku}`, 0, cogs, b.branch||'CM2', period, 1)
          ]);
        }catch{}
      }
      try{ await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind(b.move_type||'MOVE','INV',b.sku,b.ref_no||'',`${b.move_type} ${qty} @${unitCost} ${glVoucher||''}`,'system').run(); }catch{}
      return json({ success:true, gl_voucher: glVoucher });
    }

    // --- Tax WHT ---
    if (path === "/api/tax/wht") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM tax_certs ORDER BY cert_date DESC, id DESC LIMIT 200").all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        if (!b.vendor_name || !b.amount) return bad("ต้องระบุชื่อผู้ถูกหักและจำนวนเงิน");
        const cert_no = b.cert_no || await nextDocNo(env.DB, "WHT").catch(()=> genDocNoFallback("WHT"));
        const rate = Number(b.wht_rate ?? WHT_RATE_BY_INCOME[String(b.income_type||'5')] ?? 3);
        const wht = Math.round(Number(b.amount)*rate)/100;
        try {
          await env.DB.prepare(`INSERT INTO tax_certs(cert_no,cert_date,form_type,vendor_code,vendor_name,vendor_tax_id,vendor_address,payer_name,payer_tax_id,income_type,income_desc,amount,wht_rate,wht_amount,status,doc_ref,branch)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(cert_no, b.cert_date||new Date().toISOString().slice(0,10), b.form_type||'53', b.vendor_code||null, b.vendor_name, b.vendor_tax_id||null, b.vendor_address||null, b.payer_name||'บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด (มหาชน)', b.payer_tax_id||'0107536000381', b.income_type||'5', b.income_desc||'ค่าจ้างทำของ', Number(b.amount), rate, Number(b.wht_amount||wht), 'issued', b.doc_ref||null, b.branch||'CM2').run();
        } catch(e:any){
          // fallback สำหรับ DB เก่าที่ยังไม่มีคอลัมน์ใหม่
          await env.DB.prepare(`INSERT INTO tax_certs(cert_no,cert_date,vendor_code,vendor_name,income_type,amount,wht_rate,wht_amount,status) VALUES(?,?,?,?,?,?,?,?,?)`)
            .bind(cert_no, b.cert_date||new Date().toISOString().slice(0,10), b.vendor_code||null, b.vendor_name, b.income_type||'5', Number(b.amount), Number(b.wht_rate||3), Number(b.wht_amount||wht), 'issued').run();
        }
        const row = await env.DB.prepare("SELECT * FROM tax_certs WHERE cert_no=?").bind(cert_no).first();
        return json({ success:true, data: row });
      }
    }

    // --- CMS ---
    if (path === "/api/cms/products") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM cms_products WHERE is_active=1 ORDER BY sort_order, id").all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        await env.DB.prepare("INSERT INTO cms_products(slug,name_th,name_en,description_th,description_en,temp,humidity,carton_weight,pallet_factor,image_url) VALUES(?,?,?,?,?,?,?,?,?,?)")
          .bind(b.slug, b.name_th, b.name_en, b.description_th||"", b.description_en||"", b.temp||"-18°C", b.humidity||"85%", Number(b.carton_weight||10), Number(b.pallet_factor||1), b.image_url||null).run();
        return json({ success:true });
      }
    }
    if (path === "/api/inquiries") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM inquiries ORDER BY id DESC LIMIT 200").all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        if (!b.name || !b.phone) return bad("กรุณากรอกชื่อและเบอร์โทร");
        await env.DB.prepare("INSERT INTO inquiries(name,phone,email,company,product_slug,weight_tons,destination,message) VALUES(?,?,?,?,?,?,?,?)")
          .bind(b.name, b.phone, b.email||null, b.company||null, b.product_slug||null, Number(b.weight_tons||0), b.destination||null, b.message||null).run();
        return json({ success:true, message:"บันทึกคำขอเรียบร้อย เจ้าหน้าที่จะติดต่อกลับภายใน 24 ชม." });
      }
    }

    // Chart / bank / params / cost
    if (path === "/api/chart-accounts" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM chart_accounts ORDER BY code").all();
      return json({ success:true, data: results });
    }
    if (path === "/api/cost-centers" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM cost_centers ORDER BY code").all();
      return json({ success:true, data: results });
    }
    if (path === "/api/cost-entries" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM cost_entries ORDER BY entry_date DESC LIMIT 100").all();
      return json({ success:true, data: results });
    }
    if (path === "/api/bank-accounts" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM bank_accounts ORDER BY code").all();
      return json({ success:true, data: results });
    }
    if (path === "/api/system-params" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM system_params ORDER BY key").all();
      return json({ success:true, data: results });
    }
    if (path === "/api/system-params" && request.method === "PUT") {
      const b = await request.json<any>();
      for (const [k,v] of Object.entries(b)) {
        await env.DB.prepare("INSERT INTO system_params(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(k, String(v)).run();
      }
      return json({ success:true });
    }
    // --- Users (เจ้าหน้าที่ระบบ) — ตามหลักบัญชี แบ่งหน้าที่ SOD
    if (path === "/api/users") {
      if (request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT id, username, display_name, role, branch, email, is_active, created_at FROM users ORDER BY role, id").all();
        return json({ success:true, data: results });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        if (!b.username || !b.password || !b.display_name) return bad("ต้องระบุ username/password/ชื่อ");
        if (!['admin','account','staff','viewer'].includes(b.role)) return bad("role ต้องเป็น admin/account/staff/viewer");
        try{
          await env.DB.prepare("INSERT INTO users(username,password_hash,display_name,role,branch,email,is_active) VALUES(?,?,?,?,?,?,?)")
            .bind(b.username, b.password, b.display_name, b.role||'staff', b.branch||'CM2', b.email||null, b.is_active!==undefined? (b.is_active?1:0):1).run();
        }catch(e:any){ if(String(e.message).includes("UNIQUE")) return bad("Username ซ้ำ"); throw e; }
        const row = await env.DB.prepare("SELECT id, username, display_name, role, branch, email, is_active, created_at FROM users WHERE username=?").bind(b.username).first();
        try{ await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("CREATE","SYS",String(row?.id||''),b.username,`เพิ่มผู้ใช้ ${b.role}`,'system').run(); }catch{}
        return json({ success:true, data: row });
      }
    }
    if (path.match(/^\/api\/users\/\d+$/)) {
      const id = Number(path.split("/").pop());
      if (request.method === "PUT") {
        const b = await request.json<any>();
        const cur = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first<any>();
        if (!cur) return bad("ไม่พบผู้ใช้",404);
        // ห้ามลดสิทธิ์ admin คนสุดท้าย
        if (cur.role==='admin' && b.role && b.role!=='admin') {
          const cnt = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND is_active=1").first<any>();
          if (Number(cnt.c)<=1) return bad("ต้องมี admin อย่างน้อย 1 คน");
        }
        const nh = b.password ? b.password : cur.password_hash;
        await env.DB.prepare("UPDATE users SET display_name=?, role=?, branch=?, email=?, is_active=?, password_hash=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
          .bind(b.display_name||cur.display_name, b.role||cur.role, b.branch||cur.branch, b.email!==undefined?b.email:cur.email, b.is_active!==undefined?(b.is_active?1:0):cur.is_active, nh, id).run();
        const row = await env.DB.prepare("SELECT id, username, display_name, role, branch, email, is_active, created_at FROM users WHERE id=?").bind(id).first();
        return json({ success:true, data: row });
      }
      if (request.method === "DELETE") {
        const cur = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first<any>();
        if (!cur) return bad("ไม่พบผู้ใช้",404);
        if (cur.username==='Supacha') return bad("ห้ามลบผู้ดูแลหลัก Supacha");
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
        return json({ success:true });
      }
    }
    if (path === "/api/audit-logs" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all();
      return json({ success:true, data: results });
    }

    // --- Legacy generic CRUD (สำหรับ 252 เมนูจาก Main.aspx) ---
    if (path === "/api/legacy") {
      if (request.method === "GET") {
        const code = url.searchParams.get("code") || url.searchParams.get("menu_code");
        const q = url.searchParams.get("q");
        let sql = "SELECT * FROM legacy_data WHERE 1=1";
        const binds:any[]=[];
        if (code) { sql+=" AND menu_code=?"; binds.push(code); }
        if (q) { sql+=" AND (code LIKE ? OR name LIKE ? OR detail LIKE ?)"; binds.push(`%${q}%`,`%${q}%`,`%${q}%`); }
        sql+=" ORDER BY id DESC LIMIT 200";
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        // parse payload JSON for convenience
        const data = (results as any[]).map(r=> {
          try{ const p = r.payload ? JSON.parse(r.payload) : {}; return {...r, _payload:p}; }catch{ return r; }
        });
        return json({ success:true, data });
      }
      if (request.method === "POST") {
        const b = await request.json<any>();
        if (!b.menu_code) return bad("ต้องระบุ menu_code");
        if (!b.name && !b.code && !b.detail && !b.doc_date && !b.branch && !b.amount && !b.payload) return bad("ต้องระบุชื่อ/รหัส/รายละเอียดอย่างน้อย 1 อย่าง");
        const payload = JSON.stringify(b.payload || b);
        await env.DB.prepare(`INSERT INTO legacy_data(menu_code,title,code,name,detail,amount,doc_date,status,payload,branch,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(b.menu_code, b.title||null, b.code||null, b.name||null, b.detail||null, Number(b.amount||0), b.doc_date||new Date().toISOString().slice(0,10), b.status||'active', payload, b.branch||'CM2', b.created_by||'system').run();
        const row = await env.DB.prepare("SELECT * FROM legacy_data WHERE menu_code=? ORDER BY id DESC LIMIT 1").bind(b.menu_code).first();
        try{ await env.DB.prepare("INSERT INTO audit_logs(action,module,ref_id,ref_no,detail,by_user) VALUES(?,?,?,?,?,?)").bind("CREATE","LEGACY", String(row?.id||''), b.menu_code, b.name||b.code||'', b.created_by||'system').run(); }catch{}
        return json({ success:true, data: row });
      }
    }
    if (path.match(/^\/api\/legacy\/\d+$/)) {
      const id = Number(path.split("/").pop());
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT * FROM legacy_data WHERE id=?").bind(id).first();
        if (!row) return bad("ไม่พบข้อมูล",404);
        return json({ success:true, data: row });
      }
      if (request.method === "PUT") {
        const b = await request.json<any>();
        const cur = await env.DB.prepare("SELECT * FROM legacy_data WHERE id=?").bind(id).first<any>();
        if (!cur) return bad("ไม่พบข้อมูล",404);
        const payload = JSON.stringify({...JSON.parse(cur.payload||'{}'), ...(b.payload||b)});
        await env.DB.prepare(`UPDATE legacy_data SET code=?, name=?, detail=?, amount=?, doc_date=?, status=?, payload=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
          .bind(b.code ?? cur.code, b.name ?? cur.name, b.detail ?? cur.detail, b.amount!==undefined?Number(b.amount):cur.amount, b.doc_date ?? cur.doc_date, b.status ?? cur.status, payload, id).run();
        const row = await env.DB.prepare("SELECT * FROM legacy_data WHERE id=?").bind(id).first();
        return json({ success:true, data: row });
      }
      if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM legacy_data WHERE id=?").bind(id).run();
        return json({ success:true });
      }
    }

    // Dashboard summary
    if (path === "/api/dashboard/summary" && request.method === "GET") {
      const ar = await env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as sum, COALESCE(SUM(net_amount),0) as net FROM documents WHERE module='AR' AND status IN ('posted','paid','overdue')").first<any>();
      const ap = await env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as sum, COALESCE(SUM(net_amount),0) as net FROM documents WHERE module='AP' AND status IN ('posted','paid','overdue')").first<any>();
      const fin = await env.DB.prepare("SELECT COUNT(*) as cnt FROM documents WHERE module='FIN'").first<any>();
      const inv = await env.DB.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(qty_on_hand),0) as qty FROM inventory_items").first<any>();
      const inq = await env.DB.prepare("SELECT COUNT(*) as cnt FROM inquiries WHERE status='new'").first<any>();
      const wht = await env.DB.prepare("SELECT COALESCE(SUM(wht_amount),0) as sum FROM tax_certs WHERE status='issued'").first<any>();
      const gl = await env.DB.prepare("SELECT COALESCE(SUM(debit),0) as dr, COALESCE(SUM(credit),0) as cr FROM gl_entries").first<any>();
      return json({ success:true, data:{ ar_total: ar.sum, ar_net: ar.net, ap_total: ap.sum, ap_net: ap.net, fin_count: fin.cnt, inv_items: inv.cnt, inv_qty: inv.qty, new_inquiries: inq.cnt, wht_total: wht.sum, gl_balanced: Math.abs(Number(gl.dr||0)-Number(gl.cr||0))<0.01 }});
    }

    return bad("Not found: "+path, 404);
  }
}
