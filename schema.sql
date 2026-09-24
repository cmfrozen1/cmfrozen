-- ============================================
-- CMFrozen Accounting + CMS — Cloudflare D1 Schema
-- ปรับปรุง 2026-09-23 : สอดคล้อง พ.ร.บ. การบัญชี พ.ศ. 2543 + ประมวลรัษฎากร + TFRS for NPAEs
-- หลักการ: เลขที่เอกสารรันต่อเนื่องไม่ซ้ำ (ม.87/4), บัญชีคู่ (Double-Entry), ภาษีมูลค่าเพิ่ม 7%, หัก ณ ที่จ่าย ภงด.3/53, ภพ.30
-- สร้างด้วย: npx wrangler d1 execute cmfacc_db --file=./schema.sql
-- ============================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1) ผู้ใช้งานระบบ
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','account','staff','viewer')),
  branch TEXT DEFAULT 'CM2',
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 2) สาขา (ตาม พ.ร.บ.บริษัทมหาชน - แยกสาขายื่นงบ)
CREATE TABLE IF NOT EXISTS branches (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  tax_id TEXT,
  phone TEXT
);

-- 3) เลขที่เอกสารรันต่อเนื่อง (กันเลขซ้ำ/ข้าม ตามกฎหมายไทย)
CREATE TABLE IF NOT EXISTS doc_sequences (
  prefix TEXT PRIMARY KEY, -- AR, AP, AR-INV, AR-REC, etc.
  last_no INTEGER DEFAULT 0,
  format TEXT DEFAULT '{PREFIX}-{YYYYMM}-{NNNN}',
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 4) ลูกค้า (ลูกหนี้ AR) — เพิ่มเลขภาษี 13 หลัก + สาขายื่นภาษี
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT, -- 13 หลัก (นิติบุคคล 13 หลัก)
  branch_no TEXT DEFAULT '00000', -- เลขที่สาขา 00000=สำนักงานใหญ่
  address TEXT,
  phone TEXT,
  email TEXT,
  credit_limit REAL DEFAULT 0,
  credit_term INTEGER DEFAULT 30, -- วันเครดิต
  vat_type TEXT DEFAULT 'vat' CHECK(vat_type IN ('vat','nonvat','zero','exempt')),
  branch TEXT DEFAULT 'CM2',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 5) เจ้าหนี้ AP vendors
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT,
  branch_no TEXT DEFAULT '00000',
  address TEXT,
  phone TEXT,
  email TEXT,
  payment_term TEXT DEFAULT '30 วัน',
  wht_rate REAL DEFAULT 3, -- อัตรา WHT เริ่มต้น (ค่าบริการ 3% ค่าเช่า 5% ฯลฯ)
  branch TEXT DEFAULT 'CM2',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 6) ผังบัญชี GL — 6 หลักมาตรฐานกรมพัฒน์ฯ (1xxx สินทรัพย์ 2xxx หนี้สิน 3xxx ทุน 4xxx รายได้ 5xxx ต้นทุน/ค่าใช้จ่าย)
CREATE TABLE IF NOT EXISTS chart_accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  type TEXT CHECK(type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  parent_code TEXT,
  level INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  is_control INTEGER DEFAULT 0 -- บัญชีคุม (เช่น ลูกหนี้รวม/เจ้าหนี้รวม)
);

-- 7) เอกสารหลัก — รองรับทุกโมดูล + ประเภทเอกสารย่อยตามกฎหมายไทย
-- doc_type: INV=ใบแจ้งหนี้/ใบกำกับภาษี, REC=ใบเสร็จรับเงิน, CN=ใบลดหนี้, DN=ใบเพิ่มหนี้, BILL=วางบิล, PAY=จ่ายชำระ, JV=รายวันทั่วไป, PV=ใบสำคัญจ่าย, RV=ใบสำคัญรับ
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL CHECK(module IN ('AR','AP','FIN','TAX','GL','INV','COST','SYS')),
  doc_type TEXT DEFAULT 'INV' CHECK(doc_type IN ('INV','REC','CN','DN','BILL','PAY','JV','PV','RV','ADJ','TRANSFER','WHT','VAT')),
  doc_no TEXT UNIQUE NOT NULL,
  doc_date TEXT NOT NULL, -- YYYY-MM-DD
  due_date TEXT, -- วันครบกำหนด (credit term)
  ref_no TEXT, -- เลขที่อ้างอิงภายนอก
  partner_code TEXT,
  partner_name TEXT,
  partner_tax_id TEXT,
  partner_branch_no TEXT DEFAULT '00000',
  partner_address TEXT,
  description TEXT,
  -- ยอดเงินตามมาตรฐาน: ยอดก่อน VAT / VAT / ยอดรวม / WHT / สุทธิ
  amount REAL DEFAULT 0, -- ยอดก่อน VAT (ฐานภาษี)
  vat_rate REAL DEFAULT 7,
  vat_amount REAL DEFAULT 0,
  wht_rate REAL DEFAULT 0,
  wht_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0, -- amount + vat_amount
  net_amount REAL DEFAULT 0, -- total - wht
  payment_method TEXT DEFAULT 'transfer' CHECK(payment_method IN ('cash','transfer','cheque','credit')),
  cheque_no TEXT,
  bank_code TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','posted','paid','cancelled','overdue','void')),
  is_posted INTEGER DEFAULT 0, -- ผ่านรายการไป GL แล้วหรือยัง
  gl_voucher_no TEXT, -- เลขที่ JV ที่ผูก
  branch TEXT DEFAULT 'CM2',
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cancelled_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_module ON documents(module);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(doc_date);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_branch ON documents(branch);

-- 8) รายละเอียดเอกสาร (line items) — ผูก GL + VAT/WHT ต่อบรรทัด
CREATE TABLE IF NOT EXISTS document_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  gl_code TEXT REFERENCES chart_accounts(code),
  qty REAL DEFAULT 1,
  unit TEXT DEFAULT 'kg',
  unit_price REAL DEFAULT 0,
  amount REAL DEFAULT 0, -- qty * unit_price
  vat_type TEXT DEFAULT 'vat' CHECK(vat_type IN ('vat','nonvat','zero','exempt')),
  vat_rate REAL DEFAULT 7,
  vat_amount REAL DEFAULT 0,
  wht_rate REAL DEFAULT 0,
  wht_amount REAL DEFAULT 0,
  cost_center TEXT,
  remarks TEXT
);

-- 9) รายการบัญชีแยกประเภท (GL Entries) — Double-Entry บังคับเดบิต=เครดิต + ห้าม Dr/Cr พร้อมกัน
CREATE TABLE IF NOT EXISTS gl_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_no TEXT NOT NULL, -- เลขที่ JV
  entry_date TEXT NOT NULL,
  doc_ref TEXT, -- อ้างอิง documents.doc_no
  account_code TEXT NOT NULL REFERENCES chart_accounts(code),
  account_name TEXT,
  description TEXT,
  debit REAL DEFAULT 0 CHECK(debit >= 0),
  credit REAL DEFAULT 0 CHECK(credit >= 0),
  branch TEXT DEFAULT 'CM2',
  period TEXT, -- YYYY-MM
  is_posted INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK((debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0))
);
CREATE INDEX IF NOT EXISTS idx_gl_voucher ON gl_entries(voucher_no);
CREATE INDEX IF NOT EXISTS idx_gl_account ON gl_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_gl_period ON gl_entries(period);

-- 10) งวดบัญชี (ปิดงวด/ปิดปี ตาม พ.ร.บ.การบัญชี ม.11-12)
CREATE TABLE IF NOT EXISTS accounting_periods (
  period TEXT PRIMARY KEY, -- YYYY-MM
  status TEXT DEFAULT 'open' CHECK(status IN ('open','closed','locked')),
  closed_by TEXT,
  closed_at TEXT,
  year_end INTEGER DEFAULT 0 -- 1 = ปิดปี
);

-- 11) การเงิน - ธนาคาร/แคชบุ๊ค
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_no TEXT,
  balance REAL DEFAULT 0,
  gl_code TEXT REFERENCES chart_accounts(code),
  branch TEXT DEFAULT 'CM2',
  is_active INTEGER DEFAULT 1
);

-- 12) ภาษี หัก ณ ที่จ่าย — รองรับ ภ.ง.ด.3 / ภ.ง.ด.53 ตามประมวลรัษฎากร
CREATE TABLE IF NOT EXISTS tax_certs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_no TEXT UNIQUE NOT NULL, -- เลขที่หนังสือรับรองฯ (รันต่อเนื่อง)
  cert_date TEXT NOT NULL,
  form_type TEXT DEFAULT '53' CHECK(form_type IN ('3','53','1','2')), -- ภงด.3 = บุคคลธรรมดา, 53 = นิติบุคคล
  vendor_code TEXT,
  vendor_name TEXT,
  vendor_tax_id TEXT,
  vendor_address TEXT,
  payer_name TEXT, -- ผู้จ่ายเงิน (บริษัทเรา)
  payer_tax_id TEXT,
  income_type TEXT NOT NULL, -- 1=เงินเดือน 2=ค่าธรรมเนียม 3=ค่าแห่งลิขสิทธิ์ 5=ค่าจ้างทำของ 6=ค่าเช่า ฯลฯ
  income_desc TEXT,
  amount REAL NOT NULL, -- จำนวนเงินได้
  wht_rate REAL NOT NULL,
  wht_amount REAL NOT NULL,
  vat_amount REAL DEFAULT 0,
  payment_date TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','issued','cancelled','submitted')),
  doc_ref TEXT, -- ผูกกับ documents.id
  branch TEXT DEFAULT 'CM2',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- แก้ typo real
CREATE TABLE IF NOT EXISTS _tax_certs_fix_check (dummy TEXT);

-- 13) ภาษีมูลค่าเพิ่ม ภ.พ.30 — สรุปยอดซื้อ/ขาย ต่อเดือน
CREATE TABLE IF NOT EXISTS vat_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT UNIQUE NOT NULL, -- YYYY-MM
  sale_base REAL DEFAULT 0, -- ฐานภาษีขาย
  sale_vat REAL DEFAULT 0,  -- ภาษีขาย
  purchase_base REAL DEFAULT 0, -- ฐานภาษีซื้อ
  purchase_vat REAL DEFAULT 0,  -- ภาษีซื้อ
  vat_payable REAL DEFAULT 0, -- ต้องชำระ (sale_vat - purchase_vat)
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','filed','paid')),
  filed_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 14) สินค้าคงคลัง — เพิ่ม GL + เฉลี่ยถ่วงน้ำหนักตาม TFRS
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT,
  category TEXT DEFAULT 'vegetable',
  unit TEXT DEFAULT 'kg',
  temp TEXT DEFAULT '-18°C',
  qty_on_hand REAL DEFAULT 0,
  avg_cost REAL DEFAULT 0,
  cost_per_unit REAL DEFAULT 0,
  gl_code TEXT, -- บัญชีสินค้าคงคลัง
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS inventory_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  move_date TEXT NOT NULL,
  sku TEXT NOT NULL REFERENCES inventory_items(sku),
  move_type TEXT CHECK(move_type IN ('RECEIVE','ISSUE','TRANSFER','ADJUST','COUNT')),
  qty REAL NOT NULL,
  unit_cost REAL DEFAULT 0,
  ref_no TEXT,
  description TEXT,
  branch TEXT DEFAULT 'CM2',
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_moves_sku ON inventory_moves(sku);
CREATE INDEX IF NOT EXISTS idx_inv_moves_date ON inventory_moves(move_date);

-- 15) ต้นทุน cost centers
CREATE TABLE IF NOT EXISTS cost_centers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT,
  budget REAL DEFAULT 0,
  gl_code TEXT
);
CREATE TABLE IF NOT EXISTS cost_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  center_code TEXT REFERENCES cost_centers(code),
  gl_code TEXT,
  description TEXT,
  amount REAL,
  doc_ref TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 16) ไฟล์/PDF ที่สร้าง (แทนอัปโหลด — เก็บลิงก์ PDF ที่สร้างด้วย pdfMake)
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  ref_id INTEGER,
  ref_code TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  is_generated INTEGER DEFAULT 0, -- 1 = PDF ที่สร้างโดยระบบ
  pdf_type TEXT, -- INV, REC, CN, WHT, VAT, JV, etc.
  uploaded_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_ref ON attachments(module, ref_id);

-- 16.1) การจัดสรรรับชำระ/วางบิล — ผูกเอกสาร AR/AP แบบบัญชีจริง
CREATE TABLE IF NOT EXISTS ar_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, -- เอกสารชำระ (REC/PAY)
  allocated_doc_id INTEGER NOT NULL REFERENCES documents(id), -- บิลต้นทาง (INV/BILL)
  amount REAL NOT NULL CHECK(amount > 0),
  allocated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_alloc_doc ON ar_allocations(doc_id);
CREATE INDEX IF NOT EXISTS idx_alloc_target ON ar_allocations(allocated_doc_id);

-- 16.2) ยอดค้างชำระคงเหลือ (วิวช่วย aging/statement)
CREATE VIEW IF NOT EXISTS v_ar_outstanding AS
SELECT d.id, d.doc_no, d.partner_code, d.partner_name, d.doc_date, d.due_date, d.total_amount, d.net_amount,
       COALESCE(d.total_amount,0) - COALESCE((SELECT SUM(amount) FROM ar_allocations WHERE allocated_doc_id=d.id),0) AS outstanding
FROM documents d WHERE d.module='AR' AND d.doc_type IN ('INV','DN','BILL') AND d.status IN ('posted','overdue');

-- 17) CMS
CREATE TABLE IF NOT EXISTS cms_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT,
  description_th TEXT,
  description_en TEXT,
  temp TEXT,
  humidity TEXT,
  carton_weight REAL,
  pallet_factor REAL,
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  product_slug TEXT,
  weight_tons REAL,
  destination TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','quoted','closed')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 18) พารามิเตอร์ระบบ
CREATE TABLE IF NOT EXISTS system_params (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 19) Audit log — ตาม พ.ร.บ.การบัญชี ต้องตรวจสอบย้อนหลังได้ 5 ปี
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, POST, VOID, CLOSE
  module TEXT,
  ref_id TEXT,
  ref_no TEXT,
  detail TEXT,
  by_user TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_ref ON audit_logs(ref_no);

-- ============================================
-- SEED DATA
-- ============================================
INSERT OR IGNORE INTO users(username,password_hash,display_name,role,branch) VALUES
 ('Supacha','pm2524','สุพชยาฌ์ ปัญญากาศ','admin','CM2');

INSERT OR IGNORE INTO branches(code,name,address,tax_id) VALUES
 ('CM1','สาขาเชียงใหม่ 1 (สันทราย 1)','88 ม.5 ต.หนองแหย่ง อ.สันทราย จ.เชียงใหม่ 50210','0107536000381'),
 ('CM2','สาขาเชียงใหม่ 2 (สันทราย 2)','99/9 ม.8 ต.สันทรายน้อย อ.สันทราย จ.เชียงใหม่ 50210','0107536000381'),
 ('BKK','สำนักงานใหญ่ กรุงเทพ','123 อาคารสาทร ถ.สาทร กทม. 10120','0107536000381');

INSERT OR IGNORE INTO doc_sequences(prefix,last_no,format) VALUES
 ('AR-INV',0,'AR-INV-{YYYYMM}-{NNNN}'),
 ('AR-REC',0,'AR-REC-{YYYYMM}-{NNNN}'),
 ('AR-CN',0,'AR-CN-{YYYYMM}-{NNNN}'),
 ('AR-DN',0,'AR-DN-{YYYYMM}-{NNNN}'),
 ('AP-INV',0,'AP-INV-{YYYYMM}-{NNNN}'),
 ('AP-PAY',0,'AP-PAY-{YYYYMM}-{NNNN}'),
 ('FIN-PV',0,'FIN-PV-{YYYYMM}-{NNNN}'),
 ('FIN-RV',0,'FIN-RV-{YYYYMM}-{NNNN}'),
 ('GL-JV',0,'GL-JV-{YYYYMM}-{NNNN}'),
 ('WHT',0,'WHT-{YYYY}-{NNNN}'),
 ('VAT',0,'VAT-{YYYYMM}'),
 ('INV-REC',0,'INV-REC-{YYYYMM}-{NNNN}'),
 ('AR',5,'AR-{YYYYMM}-{NNNN}'),
 ('AP',5,'AP-{YYYYMM}-{NNNN}'),
 ('FIN',5,'FIN-{YYYYMM}-{NNNN}');

-- ผังบัญชีมาตรฐานกรมพัฒน์ฯ (ย่อ — ครบ 5 หมวด)
INSERT OR IGNORE INTO chart_accounts(code,name,name_en,type,level,parent_code,is_control) VALUES
 ('100000','สินทรัพย์','ASSETS','ASSET',1,NULL,0),
 ('110000','สินทรัพย์หมุนเวียน','Current Assets','ASSET',2,'100000',0),
 ('110100','เงินสดและรายการเทียบเท่าเงินสด','Cash & Equivalents','ASSET',3,'110000',0),
 ('110101','เงินสดในมือ','Cash on Hand','ASSET',3,'110100',0),
 ('110102','เงินฝากธนาคาร','Bank Deposits','ASSET',3,'110100',0),
 ('110200','ลูกหนี้การค้า','Trade Receivables','ASSET',3,'110000',1),
 ('110201','ลูกหนี้การค้า - ในประเทศ','Trade AR Domestic','ASSET',3,'110200',0),
 ('110202','ลูกหนี้การค้า - ต่างประเทศ','Trade AR Export','ASSET',3,'110200',0),
 ('110300','สินค้าคงเหลือ','Inventories','ASSET',3,'110000',0),
 ('110400','ลูกหนี้อื่น','Other Receivables','ASSET',3,'110000',0),
 ('110500','ภาษีซื้อรอขอคืน','Input VAT','ASSET',3,'110000',0),
 ('110501','ภาษีซื้อ','Input VAT 7%','ASSET',3,'110500',0),
 ('110502','ภาษีซื้อที่ยังไม่ถึงกำหนด','Undue Input VAT','ASSET',3,'110500',0),
 ('120000','สินทรัพย์ไม่หมุนเวียน','Non-Current Assets','ASSET',2,'100000',0),
 ('120100','ที่ดิน อาคาร อุปกรณ์','PPE','ASSET',3,'120000',0),
 ('200000','หนี้สิน','LIABILITIES','LIABILITY',1,NULL,0),
 ('210000','หนี้สินหมุนเวียน','Current Liabilities','LIABILITY',2,'200000',0),
 ('210100','เจ้าหนี้การค้า','Trade Payables','LIABILITY',3,'210000',1),
 ('210200','เจ้าหนี้อื่น','Other Payables','LIABILITY',3,'210000',0),
 ('210300','ภาษีขายรอการชำระ','Output VAT','LIABILITY',3,'210000',0),
 ('210301','ภาษีขาย','Output VAT 7%','LIABILITY',3,'210300',0),
 ('210302','ภาษีขายยังไม่ถึงกำหนด','Undue Output VAT','LIABILITY',3,'210300',0),
 ('210400','ภาษีหัก ณ ที่จ่ายค้างนำส่ง','WHT Payable','LIABILITY',3,'210000',0),
 ('210500','ค่าใช้จ่ายค้างจ่าย','Accrued Expenses','LIABILITY',3,'210000',0),
 ('300000','ส่วนของเจ้าของ','EQUITY','EQUITY',1,NULL,0),
 ('310000','ทุนจดทะเบียน','Share Capital','EQUITY',2,'300000',0),
 ('320000','กำไรสะสม','Retained Earnings','EQUITY',2,'300000',0),
 ('400000','รายได้','REVENUE','REVENUE',1,NULL,0),
 ('410000','รายได้จากการขาย','Sales','REVENUE',2,'400000',0),
 ('410100','รายได้ขายในประเทศ','Domestic Sales','REVENUE',3,'410000',0),
 ('410200','รายได้ส่งออก (0%)','Export Sales 0%','REVENUE',3,'410000',0),
 ('420000','รายได้อื่น','Other Income','REVENUE',2,'400000',0),
 ('500000','ต้นทุนขาย','COGS','EXPENSE',1,NULL,0),
 ('510000','ต้นทุนขาย','Cost of Goods Sold','EXPENSE',2,'500000',0),
 ('510100','ต้นทุนวัตถุดิบ','Raw Material Cost','EXPENSE',3,'510000',0),
 ('600000','ค่าใช้จ่ายขายและบริหาร','SG&A','EXPENSE',1,NULL,0),
 ('610000','ค่าใช้จ่ายในการขาย','Selling Expenses','EXPENSE',2,'600000',0),
 ('620000','ค่าใช้จ่ายในการบริหาร','Admin Expenses','EXPENSE',2,'600000',0),
 ('620100','เงินเดือนและค่าแรง','Salaries','EXPENSE',3,'620000',0),
 ('620200','ค่าเช่า','Rental','EXPENSE',3,'620000',0),
 ('620300','ค่าขนส่ง','Transportation','EXPENSE',3,'620000',0);

INSERT OR IGNORE INTO bank_accounts(code,name,bank_name,account_no,balance,gl_code) VALUES
 ('KBANK-001','กสิกรไทย สันทราย','KBANK','123-4-56789-0',1250000,'110102'),
 ('SCB-001','ไทยพาณิชย์ สุรวงศ์','SCB','456-7-89012-3',890000,'110102');

INSERT OR IGNORE INTO cost_centers(code,name,dept,budget,gl_code) VALUES
 ('CC-PROD','ฝ่ายผลิต','PROD',5000000,'510000'),
 ('CC-QC','ฝ่ายคุณภาพ','QC',800000,'620000'),
 ('CC-LOG','คลังเย็น/โลจิสติกส์','LOG',1200000,'610000');

INSERT OR IGNORE INTO inventory_items(sku,name_th,name_en,category,qty_on_hand,avg_cost,cost_per_unit,gl_code) VALUES
 ('FG-EDA-10','ถั่วแระญี่ปุ่น 10kg','Frozen Edamame 10kg','vegetable',5400,85,85,'110300'),
 ('FG-SWC-12','ข้าวโพดหวาน 12kg','Frozen Sweet Corn 12kg','vegetable',3200,72,72,'110300'),
 ('FG-GBN-08','ถั่วแขก 8kg','Frozen Green Beans 8kg','vegetable',2100,68,68,'110300'),
 ('FG-MIX-10','ผักรวม 10kg','Frozen Mixed Veg 10kg','vegetable',1800,90,90,'110300');

INSERT OR IGNORE INTO cms_products(slug,name_th,name_en,category,temp,humidity,carton_weight,pallet_factor,description_th,description_en,image_url) VALUES
 ('edamame','ถั่วแระญี่ปุ่นแช่แข็ง','Frozen Edamame','vegetable','-18°C ถึง -22°C','85% - 90%',10,0.95,'ถั่วแระญี่ปุ่นคัดฝักสวย แช่แข็ง IQF รักษาความหวาน','Premium edamame IQF selected pods',''),
 ('sweetcorn','ข้าวโพดหวานแช่แข็ง','Frozen Sweet Corn','vegetable','-18°C ถึง -20°C','85%',12,1.1,'ข้าวโพดหวานแกะเมล็ดทอง หวานฉ่ำ','Golden sweet corn kernels',''),
 ('greenbeans','ถั่วแขกแช่แข็ง','Frozen Green Beans','vegetable','-18°C ถึง -20°C','90%',8,0.85,'ถั่วแขกฝักตรง กรอบ สีเขียวสด','Straight green beans crisp',''),
 ('mixedveg','ผักรวมหั่นเต๋า','Frozen Mixed Veg','vegetable','-18°C ถึง -22°C','85%',10,1.0,'ผักรวม 5 สีพร้อมใช้','5-color mixed vegetables','');

INSERT OR IGNORE INTO system_params(key,value,description) VALUES
 ('company_name','บริษัท เชียงใหม่โฟรเซ่นฟูดส์ จำกัด (มหาชน)','ชื่อบริษัทตามหนังสือรับรอง'),
 ('company_name_en','Chiangmai Frozen Foods Public Company Limited','Company name EN'),
 ('tax_id','0107536000381','เลขประจำตัวผู้เสียภาษี 13 หลัก'),
 ('branch_no','00000','เลขที่สาขา 00000=สำนักงานใหญ่'),
 ('address_th','99/9 ม.8 ต.สันทรายน้อย อ.สันทราย จ.เชียงใหม่ 50210','ที่อยู่จดทะเบียน'),
 ('address_en','99/9 Moo 8, Sansai Noi, Sansai, Chiang Mai 50210','Registered address EN'),
 ('phone','053-345-678','โทรศัพท์'),
 ('vat_rate','7','อัตราภาษีมูลค่าเพิ่ม % (พิกัดกรมสรรพากร)'),
 ('wht_rate_default','3','อัตราหัก ณ ที่จ่าย เริ่มต้น % (ค่าบริการ)'),
 ('wht_rate_rent','5','หัก ณ ที่จ่ายค่าเช่า %'),
 ('doc_prefix_AR','AR','prefix ลูกหนี้'),
 ('doc_prefix_AP','AP','prefix เจ้าหนี้'),
 ('doc_prefix_GL','GL','prefix GL'),
 ('accounting_year_end','12','เดือนปิดปีบัญชี (12=ธันวาคม)'),
 ('currency','THB','สกุลเงิน'),
 ('pdf_footer','เอกสารนี้จัดทำด้วยระบบอิเล็กทรอนิกส์ ตาม พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์','ท้ายเอกสาร PDF');

-- ตัวอย่างเอกสาร (รวม VAT/WHT/net)
INSERT OR IGNORE INTO documents(module,doc_type,doc_no,doc_date,due_date,partner_code,partner_name,description,amount,vat_amount,wht_amount,total_amount,net_amount,status,branch,created_by,is_posted) VALUES
 ('AR','INV','AR-202609-0001','2026-09-20','2026-10-20','CUST-001','บจก. สยามส่งออก','ขายถั่วแระญี่ปุ่น 20 ตัน - ใบกำกับภาษี/ใบแจ้งหนี้',680000,47600,0,727600,727600,'posted','CM2','admin',1),
 ('AP','INV','AP-202609-0001','2026-09-19','2026-10-19','VEND-001','สหกรณ์เกษตรเชียงใหม่','ซื้อวัตถุดิบข้าวโพด 15 ตัน',320000,22400,9600,342400,332800,'paid','CM2','admin',1),
 ('FIN','RV','FIN-202609-0001','2026-09-21',NULL,'','', 'รับชำระลูกหนี้ AR-202609-0001 โอน KBANK',727600,0,0,727600,727600,'posted','CM2','admin',1);

-- GL ตัวอย่าง (เดบิต=เครดิต)
INSERT OR IGNORE INTO gl_entries(voucher_no,entry_date,doc_ref,account_code,account_name,description,debit,credit,branch,period,is_posted) VALUES
 ('GL-JV-202609-0001','2026-09-20','AR-202609-0001','110201','ลูกหนี้การค้า - ในประเทศ','ขายถั่วแระญี่ปุ่น บจก.สยามส่งออก',727600,0,'CM2','2026-09',1),
 ('GL-JV-202609-0001','2026-09-20','AR-202609-0001','410100','รายได้ขายในประเทศ','ขายถั่วแระญี่ปุ่น',0,680000,'CM2','2026-09',1),
 ('GL-JV-202609-0001','2026-09-20','AR-202609-0001','210301','ภาษีขาย','VAT 7% ขาย',0,47600,'CM2','2026-09',1);
