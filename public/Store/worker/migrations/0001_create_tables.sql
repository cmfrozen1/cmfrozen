-- โครงสร้างฐานข้อมูล SQLite (Cloudflare D1)
-- เก็บ timestamp เป็น milliseconds (UTC) ในรูปแบบ INTEGER เพื่อความแม่นยำข้าม timezone

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),  -- in = รับเข้า, out = จ่ายออก(ขาย)
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,        -- ราคาต่อหน่วย ณ ตอนทำรายการ
  note TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
