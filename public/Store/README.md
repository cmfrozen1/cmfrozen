# ระบบสต๊อกสินค้า - ร้านชายของชา

Web Application จัดการสต๊อกสินค้าร้านชายของชา ใช้งานได้ทั้งบนมือถือและคอมพิวเตอร์
เก็บข้อมูลด้วย **SQLite (Cloudflare D1)** ซึ่งแชร์ข้อมูลร่วมกันทุกอุปกรณ์ผ่านอินเทอร์เน็ต

## ฟีเจอร์
- **จัดการสินค้า** - เพิ่ม / แก้ไข / ลบรายการสินค้าและราคา
- **รับเข้าสินค้า** - บันทึกสินค้าเข้าสต๊อก
- **จ่ายสินค้าออก (ขาย)** - บันทึกการจ่ายสินค้าออก พร้อมตรวจสต๊อกคงเหลือ
- **รายงานสินค้าคงเหลือ** - สรุปยอดคงเหลือ รับเข้า/จ่ายออก มูลค่าคงเหลือ และสินค้าหมดสต๊อก
- **เข้าสู่ระบบ** - ใช้รหัสผ่าน (ค่าเริ่มต้น `1234`)

## โครงสร้างโปรเจค
```
Store/
├── frontend/          # หน้าเว็บ (Cloudflare Pages - static)
│   ├── index.html     # หน้าล็อกอิน
│   ├── app.html       # หน้าหลัก (จัดการสินค้า/รับเข้า/จ่ายออก/รายงาน)
│   ├── css/style.css
│   ├── js/{config,api,app}.js
│   └── package.json
└── worker/            # Backend API (Cloudflare Worker + D1)
    ├── src/index.js
    ├── wrangler.toml
    ├── migrations/0001_create_tables.sql
    └── package.json
```

---

## ขั้นตอนการติดตั้งและ Deploy

### ส่วนที่ 1: Deploy ฐานข้อมูลและ API (Worker + D1)

1. **ติดตั้ง wrangler** (ถ้ายังไม่มี):
   ```bash
   cd Store/worker
   npm install
   ```

2. **ล็อกอิน Cloudflare**:
   ```bash
   npx wrangler login
   ```

3. **สร้างฐานข้อมูล D1**:
   ```bash
   npx wrangler d1 create store
   ```
   ข้อมูลที่ได้ประมาณนี้:
   ```
   database_name = "store"
   database_id   = "abcdef-1234-xxxx-....."
   ```
   นำ `database_id` ไปใส่ใน `worker/wrangler.toml` (แทน `REPLACE_WITH_YOUR_DB_ID`)

4. **สร้างตาราง (migration)**:
   ```bash
   npx wrangler d1 migrations apply store --remote
   ```

5. **ตั้งค่ารหัสผ่าน**: เปลี่ยนค่า `PASSWORD` ใน `worker/wrangler.toml` (ค่าเริ่มต้น `1234`)

6. **Deploy Worker**:
   ```bash
   npx wrangler deploy
   ```
   จะได้ URL เช่น `https://store-api.XXXX.workers.dev`

   > ถ้าต้องการฝัง worker ไว้ใน domain เดียวกับ Pages ให้รัน:
   > `npx wrangler deploy --routes /api/*`
   > แต่ต้องตั้งค่า route ใน Cloudflare Dashboard ด้วย

### ส่วนที่ 2: ตั้งค่าหน้าเว็บ (Frontend) ให้ชี้ไปที่ API

เปิดไฟล์ `Store/frontend/js/config.js` แล้วเปลี่ยน:
```js
apiBase: 'https://store-api.XXXX.workers.dev'
```

### ส่วนที่ 3: Deploy หน้าเว็บไป Cloudflare Pages

1. ไปที่ [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages**
2. เชื่อมต่อ Git repository ของคุณ หรือใช้ **Direct Upload** อัปโหลดไฟล์ในโฟลเดอร์ `Store/frontend/`
   (Upload ไฟล์ทั้งหมด: `index.html`, `app.html`, `css/`, `js/`)
3. หลัง deploy จะได้ URL เช่น `https://store.pages.dev`

---

## การใช้งาน
1. เปิดหน้าเว็บที่ deploy แล้ว
2. ใส่รหัสผ่าน (`1234` หรือตามที่ตั้งไว้)
3. เริ่มใช้งานเมนูต่าง ๆ

## การเปลี่ยนรหัสผ่าน
แก้ค่า `PASSWORD` ใน `Store/worker/wrangler.toml` แล้ว deploy worker ใหม่:
```bash
cd Store/worker
npx wrangler deploy
```
**สำคัญ:** หลังแก้ ให้เข้าเว็บใหม่และล็อกอินอีกครั้ง (Token เก่าจะใช้งานไม่ได้)

---

## ทดสอบรันบนเครื่อง (local dev)
### รัน Worker จำลอง (มี D1 local)
```bash
cd Store/worker
npx wrangler d1 migrations apply store --local
npx wrangler dev
```
เปิดหน้าเว็บด้วย local server และตั้ง `config.js` ชี้ไป `http://localhost:8787`

### รัน Frontend เดี่ยว ๆ
```bash
cd Store/frontend
python3 -m http.server 8000
```
