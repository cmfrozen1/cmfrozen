# คู่มือ Deploy ขึ้น Cloudflare + D1 Database — Fukupetstore

> พอร์ตจาก PHP + MySQL (api.php) → Cloudflare Workers + D1 (SQLite) + R2 (ไฟล์รูป) แบบ 100% compatible  
> Frontend เดิม (`index.html`, `admin.html`) ใช้งานต่อได้เลย ไม่ต้องแก้ fetch URL (`api.php?action=xxx` ยังใช้ได้)

---

## 1. ไฟล์ที่เตรียมไว้ให้แล้ว

| ไฟล์ | หน้าที่ |
|---|---|
| `worker.js` | Worker หลัก - พอร์ต `api.php` ทุก endpoint (14 actions) + Serve R2 `/images/*`, `/slips/*` |
| `wrangler.toml` | Config Worker, Assets, D1, R2 binding |
| `schema-d1.sql` | สร้างตาราง D1 (SQLite) - แปลงจาก `initdatabase.sql` |
| `seed-d1.sql` | ข้อมูลเริ่มต้น (sections, settings, admin) - `INSERT OR IGNORE` รันซ้ำได้ปลอดภัย |
| `functions/api.js` | สำหรับกรณี deploy แบบ **Pages Functions** (ทางเลือก) |
| `deploy-cloudflare.sh` | สคริปต์ auto deploy สำหรับ Linux/Mac |
| `deploy-cloudflare.bat` | สคริปต์ auto deploy สำหรับ Windows |
| `.dev.vars.example` | ตัวอย่าง env สำหรับ `wrangler dev` local |

---

## 2. สถาปัตยกรรมใหม่

```
Browser
  ├─ /index.html, /admin.html, /style.css, /images/*  ─┐
  ├─ /api.php?action=get_content  (GET)                  │
  ├─ /api.php?action=create_order (POST)                 ├─► Cloudflare Worker (worker.js)
  ├─ /api.php?action=login etc.                          │     ├─ D1 Database (fukupetstore-db)
  └─ /images/xxx.jpg, /slips/xxx.jpg (R2)               ─┘     └─ R2 Bucket (fukupetstore-images)
```

- **D1**: แทน MySQL `fukupet_dbwebsite` - ตาราง `site_sections`, `orders`, `media_files`, `admin_users`, `sessions`
- **R2**: แทนโฟลเดอร์ `images/` และ `slips/` บน Hosting - เก็บไฟล์จริง, metadata เก็บใน D1
- **Sessions**: แทน PHP `$_SESSION` - เก็บ token ในตาราง `sessions` + Cookie `admin_token` (HttpOnly)

---

## 3. เตรียม Cloudflare

### 3.1 Login

```bash
npx wrangler login
# จะเปิดบราวเซอร์ให้ authorize → เลือก Account ที่จะ deploy
npx wrangler whoami  # เช็คว่า login แล้ว
```

### 3.2 สร้าง D1 + R2 (ทำครั้งเดียว)

```bash
cd public/fukupetstore

# สร้าง D1
npx wrangler d1 create fukupetstore-db
# จะได้ output: database_id = "xxxxxxxx-xxxx-...."
# → คัดลอก ID ไปแทนค่า XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX ใน wrangler.toml

# สร้าง R2
npx wrangler r2 bucket create fukupetstore-images
```

> ถ้าใช้ `deploy-cloudflare.sh` จะ auto-patch `wrangler.toml` ให้เอง

---

## 4. Deploy แบบอัตโนมัติ (แนะนำ)

### Linux / Mac / WSL
```bash
chmod +x deploy-cloudflare.sh
./deploy-cloudflare.sh
```

### Windows
ดับเบิลคลิก `deploy-cloudflare.bat` หรือ
```bat
deploy-cloudflare.bat
```

สคริปต์จะทำ:
1. `d1 create` + patch `wrangler.toml`
2. `r2 bucket create`
3. `d1 execute --file=schema-d1.sql --remote`
4. `d1 execute --file=seed-d1.sql --remote`
5. `wrangler deploy` → ได้ URL `https://fukupetstore.<subdomain>.workers.dev`

---

## 5. Deploy แบบ Manual (ทีละขั้น)

```bash
cd public/fukupetstore

# 1. แก้ wrangler.toml - ใส่ database_id จริง
# [[d1_databases]] database_id = "xxxx-xxxx-..."

# 2. สร้างตาราง
npx wrangler d1 execute fukupetstore-db --file=./schema-d1.sql --remote

# 3. ใส่ข้อมูลเริ่มต้น
npx wrangler d1 execute fukupetstore-db --file=./seed-d1.sql --remote

# 4. ทดสอบ dry-run
npx wrangler deploy --dry-run

# 5. Deploy จริง
npx wrangler deploy
```

---

## 6. ทดสอบหลัง Deploy

```bash
# สมมติ Worker URL = https://fukupetstore.xxx.workers.dev

# DB status
curl https://fukupetstore.xxx.workers.dev/api.php?action=db_status

# Get content (ควรได้ source: d1)
curl https://fukupetstore.xxx.workers.dev/api.php?action=get_content | head -n 50

# Login admin
curl -c cookies.txt -X POST https://fukupetstore.xxx.workers.dev/api.php?action=login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"fukupet2026"}'

# Check auth (พร้อม cookie)
curl -b cookies.txt https://fukupetstore.xxx.workers.dev/api.php?action=check_auth
```

หน้าเว็บ:
- เปิด `https://<worker-url>/` → หน้า storefront โหลดปกติ
- เปิด `https://<worker-url>/admin.html` → Login `admin / fukupet2026` → จัดการเนื้อหา/ออเดอร์ได้

---

## 7. Dev Local (ทดสอบก่อน deploy จริง)

```bash
# สร้าง .dev.vars จากตัวอย่าง
cp .dev.vars.example .dev.vars

# รัน local dev (ใช้ D1 local + R2 memory)
npx wrangler dev --local

# เปิด http://localhost:8787
# ทดสอบ API: http://localhost:8787/api.php?action=get_content
```

> `wrangler dev --local` จะสร้าง D1 local แยกจาก `--remote` ไม่กระทบ DB จริง

---

## 8. การเชื่อมต่อฐานข้อมูล D1

### ดูข้อมูล
```bash
# List tables
npx wrangler d1 execute fukupetstore-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"

# ดู orders
npx wrangler d1 execute fukupetstore-db --remote --command "SELECT order_no, customer_name, total_price, status FROM orders ORDER BY created_at DESC LIMIT 10"

# ดู site_sections
npx wrangler d1 execute fukupetstore-db --remote --command "SELECT section_key, substr(data_json,1,80) FROM site_sections"

# ดู sessions
npx wrangler d1 execute fukupetstore-db --remote --command "SELECT username, expires_at FROM sessions"
```

### Backup / Export
```bash
# Export ทั้ง DB เป็น SQL
npx wrangler d1 export fukupetstore-db --output=backup.sql --remote
```

### Migration จาก MySQL เดิม
ถ้ามีข้อมูลใน MySQL `147.50.254.11` ต้องการย้ายมา D1:

**วิธีที่ 1: ผ่าน Admin CMS**
- Export orders จาก MySQL → JSON → ใช้ `api.php?action=create_order` loop ยิงเข้า D1 (สคริปต์ Node)

**วิธีที่ 2: สร้าง SQL dump แล้วแปลง**
```bash
# บนเซิร์ฟเวอร์เดิม
mysqldump -u fukupet_yok -p fukupet_dbwebsite --no-create-info --complete-insert site_sections orders > dump.sql
# แปลง syntax MySQL → SQLite (ลบ backticks, แปลง ENUM ฯลฯ) แล้ว
npx wrangler d1 execute fukupetstore-db --file=dump_converted.sql --remote
```

---

## 9. Custom Domain

1. Cloudflare Dashboard → Workers & Pages → `fukupetstore` → Settings → Domains & Routes
2. Add Custom Domain → ใส่ `fukupetstore.yourdomain.com` → ยืนยัน
3. หรือ Route: `fukupetstore.com/*` → Worker `fukupetstore`

---

## 10. ความแตกต่างจาก PHP เดิม

| เดิม (PHP/MySQL) | ใหม่ (Workers/D1/R2) |
|---|---|
| `config.php` มีรหัส MySQL plain | ใช้ `wrangler.toml` vars + Dashboard Secrets (ปลอดภัยกว่า) |
| `$_SESSION` + `session_start()` | ตาราง `sessions` + Cookie `admin_token` (HttpOnly) |
| `mkdir(images)` + `move_uploaded_file` | `BUCKET.put("images/...")` (R2) |
| `SELECT * FROM orders` (MySQL) | `DB.prepare(...).all()` (D1 SQLite) |
| `SHOW COLUMNS` → `ALTER TABLE` | D1 schema มีคอลัมน์ครบตั้งแต่ต้น (`slip_path`, `shipping_carrier`, `tracking_number`) |
| `initdatabase.sql` (MySQL) | `schema-d1.sql` + `seed-d1.sql` (SQLite `INSERT OR IGNORE`) |
| `.htaccess` block `.json/.sql` | Worker ไม่ serve `*.sql` (assets binding + route filter) |

> API contract เหมือนเดิม 100% → `index.html` และ `admin.html` ไม่ต้องแก้

---

## 11. Secrets (แนะนำ)

อย่าเก็บรหัสผ่านใน `wrangler.toml` แบบ plain บน prod:

```bash
npx wrangler secret put ADMIN_USER
# input: admin

npx wrangler secret put ADMIN_PASS
# input: fukupet2026

# แล้วลบ [vars] ออกจาก wrangler.toml หรือปล่อยไว้เป็น fallback
```

---

## 12. Troubleshooting

| ปัญหา | แก้ |
|---|---|
| `database_id XXXXXXXX...` | ยังไม่ได้แก้ ID → `npx wrangler d1 list` แล้ว copy ID จริงไปใส่ `wrangler.toml` |
| `Bucket not found` | ยังไม่ได้สร้าง R2 → `npx wrangler r2 bucket create fukupetstore-images` |
| `401 กรุณาเข้าสู่ระบบ` | Cookie หมดอายุ → login ใหม่ `admin/fukupet2026` |
| รูปไม่อัพโหลด | ตรวจว่า R2 bucket สร้างแล้ว, ไฟล์ <5MB, mime jpg/png/webp |
| `D1_ERROR: no such table` | ยังไม่ได้รัน `schema-d1.sql` → `npx wrangler d1 execute ... --file=schema-d1.sql --remote` |

---

## 13. Rollback

- D1: `npx wrangler d1 export` เก็บ backup ก่อน deploy ทุกครั้ง
- Worker: Dashboard → Workers → `fukupetstore` → Manage → Rollback to previous version
- R2: ไฟล์เก่าไม่ถูกลบ Deploy ใหม่ (additive)
