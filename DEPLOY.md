# คู่มือ Deploy — เมนูสมบูรณ์ + Upload + D1 Live

## ภาพรวม 2 ส่วน
- **ส่วนที่ 1: Next.js Landing (cmfacc/)** — เว็บหลัก + เครื่องคำนวณ + ฟอร์มติดต่อ → บันทึก `inquiries` ลง D1, จัดการที่ `/admin`
- **ส่วนที่ 2: ระบบบัญชี (public/cmfacc/)** — `index.html` (login) + `main.html` (9 หมวดเมนู) → CRUD + อัปโหลดไฟล์ลง R2 + บันทึก `attachments` ลง D1

ทั้งสองส่วนเรียก **Worker API เดียวกัน** (`worker/src/index.ts`) ที่ต่อ D1 + R2

---

## 1) เตรียมเครื่อง
```bash
npm i -g wrangler
npx wrangler login
```

## 2) สร้าง D1 + R2
```bash
npx wrangler d1 create cmfacc_db
# ก๊อป database_id ไปใส่ worker/wrangler.toml และ wrangler.toml ที่ราก

npx wrangler r2 bucket create cmfacc-uploads

# รันสคีมา (14 ตาราง: users, customers, vendors, documents, attachments, inventory_items, inquiry ฯลฯ)
npx wrangler d1 execute cmfacc_db --file=./schema.sql
# ถ้าใช้ local
npx wrangler d1 execute cmfacc_db --local --file=./schema.sql
```

ตรวจสอบ seed:
```bash
npx wrangler d1 execute cmfacc_db --command "SELECT * FROM users; SELECT * FROM documents LIMIT 5;"
```

## 3) Deploy Worker API
```bash
cd worker
npm install
npx wrangler deploy
# จะได้ URL เช่น https://cmfacc-api.xxx.workers.dev
```

ทดสอบ:
```bash
curl https://cmfacc-api.xxx.workers.dev/api/health
curl -X POST https://cmfacc-api.xxx.workers.dev/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
curl -F "file=@test.pdf" -F "module=GEN" https://cmfacc-api.xxx.workers.dev/api/upload
```

## 4) ตั้งค่า Frontend ให้เชื่อม Worker
### วิธี A — ใส่ใน localStorage (ไม่ต้อง build ใหม่)
เปิด `public/cmfacc/index.html` หรือ `main.html` → ช่อง **API** ล่างซ้าย → ใส่ `https://cmfacc-api.xxx.workers.dev` → บันทึก

### วิธี B — ใส่ ENV แล้ว build (แนะนำ)
```bash
echo "NEXT_PUBLIC_API_BASE=https://cmfacc-api.xxx.workers.dev" > cmfacc/.env.local
cd cmfacc
npm install
npm run build
# output จะอยู่ที่ public/cmfacc/ (ตาม next.config.ts distDir)
firebase deploy --only hosting
# หรือ Cloudflare Pages: ต่อ repo แล้วตั้ง Build command = npm run build
```

## 5) เมนูที่สมบูรณ์แล้ว
### ระบบบัญชี (main.html) — 9 หมวด
1. ข้อมูลพื้นฐาน: 1.1 params, 1.2 master (customers/vendors/chart), 1.3 report
2. ลูกหนี้ AR: 2.1 customers, 2.2 daily, 2.3 process, 2.4 print, 2.5 report — ต่อ `documents?module=AR`
3. เจ้าหนี้ AP: 3.1 vendors, 3.2 daily, 3.3 process — `module=AP`
4. การเงิน: 4.1 cash, 4.2 bank — `module=FIN` + `bank_accounts`
5. ภาษี: 5.1 WHT, 5.2 VAT — `tax_certs` / `module=TAX`
6. GL: 6.1 voucher, 6.2 post, 6.3 close — `module=GL`
7. สินค้าคงคลัง: 7.1 items (+upload), 7.2 move — `inventory_items`
8. ต้นทุน: cost_centers + cost_entries
9. ระบบ: users
+ คลังอัปโหลดรวม: `attachments` + R2 (`/api/upload`, `/api/files/:key`)

ทุกตารางมีปุ่ม **ค้นหา / เพิ่ม / ลบ / อัปโหลด** และเรียก API จริง ถ้ายังไม่ต่อ D1 จะ fallback เป็น Mock ในเครื่องให้เห็นครบ

### Landing (Next.js)
- `/` — ฮีโร่ / คำนวณ Reefer / ฟอร์มติดต่อ → POST `/api/inquiries` (D1)
- `/admin` — ดู inquiries, สินค้า CMS, inventory, documents, uploads, ตั้งค่า API

## 6) อัปโหลดไฟล์
- เลือกไฟล์ที่ปุ่ม **อัปโหลด** ในแต่ละเมนู → `POST /api/upload` (multipart) → เก็บลง R2 (`cmfacc-uploads`) + บันทึก `attachments`
- ดาวน์โหลด: `GET /api/files/<key>`
- ดูรวม: `GET /api/attachments?module=DOC`

## 7) Login
- Demo: `admin/admin123`, `account1/acc123`, `viewer/view123`
- จริง: `POST /api/auth/login` เทียบ `users` ใน D1 (seed มี 3 user)

## 8) Firebase Hosting (เดิม)
`firebase.json` ยังใช้งานได้ — `public/cmfacc` เป็น static export ของ Next.js + `main.html` แยก
ถ้าต้องการให้ `/api/*` วิ่งไป Worker ผ่าน Firebase Hosting ให้เพิ่ม rewrites แบบ Cloud Run/Functions หรือตั้ง proxy ที่ Worker โดยตรง

---

## ทดสอบเร็ว (ไม่ต้อง deploy)
เปิด `public/cmfacc/index.html` ด้วย `python3 -m http.server` แล้ว login `admin/admin123` → เข้า `main.html` → ทุกเมนูกดได้ มี Mock + อัปโหลดแบบ local
```bash
cd public/cmfacc && python3 -m http.server 8000
cd cmfacc && npm run dev  # Next.js dev ที่พอร์ต 3000
```
