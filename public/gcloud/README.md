# Google Cloud CRUD Manager (Node.js + Tailwind CSS)

ระบบ CRUD (Create, Read, Update, Delete) สำหรับจัดการข้อมูลผู้ใช้แบบเรียลไทม์ โดยบันทึกข้อมูลลง **Google Cloud Firestore** พัฒนาด้วย **Node.js (Express)** สำหรับ Backend และ **Tailwind CSS** สำหรับ Frontend

## คุณสมบัติเด่น (Features)
- 💾 **Google Cloud Integration**: รองรับการบันทึกข้อมูลลง Google Cloud Firestore
- 🎨 **Premium Modern UI**: ออกแบบ GUI สวยงามด้วย Tailwind CSS ธีม Dark Mode, ใช้ฟอนต์ Outfit/Inter, ตกแต่งด้วย Glassmorphism, เอฟเฟกต์ Glow, โหลดข้อมูลด้วย Skeleton Loader และปุ่มกดมี Micro-animations
- 🛡️ **Data Validation & Verification (ตามข้อกำหนดของระบบ)**:
  - ตรวจสอบความถูกต้องของรูปแบบอีเมล (Email format regex check) ทั้งในฝั่ง Frontend และ Backend ก่อนจะทำการสร้าง (Create) หรืออัปเดต (Update) ข้อมูล
  - มีระบบยืนยัน (Confirmation Modal) แสดงขึ้นเตือนผู้ใช้เสมอเพื่อขอรับคำยืนยัน ก่อนที่จะดำเนินการลบข้อมูล (Delete) ป้องกันข้อผิดพลาดจากการเผลอไปกดลบโดยไม่ได้ตั้งใจ
- 🔄 **Fallback Local Demo Mode**: หากเครื่องที่รันยังไม่ได้รับการยืนยันสิทธิ์หรือไม่มีไฟล์กุญแจเชื่อมต่อ Google Cloud ระบบจะเปิดใช้งาน In-Memory Local Database ทันทีโดยอัตโนมัติ เพื่อให้โปรแกรมสามารถทดสอบและเปิดรันได้ในเครื่องตัวเองอย่างรวดเร็ว

## โครงสร้างโปรเจกต์ (Project Structure)
- `server.js`: Node.js backend (Express) เชื่อมต่อ Firestore
- `public/index.html`: Tailwind CSS frontend (Single Page Application)
- `.env`: กำหนดพอร์ต และกุญแจเชื่อมต่อบริการของ Google Cloud

---

## ขั้นตอนการติดตั้งและรันระบบ (Setup & Running)

### 1. การติดตั้ง Library และ Dependencies
เรียกใช้คำสั่งนี้ในห้องโฟลเดอร์นี้เพื่อติดตั้ง dependencies:
```bash
npm install
```

### 2. กำหนดสิทธิ์การเชื่อมต่อ Google Cloud (เลือกวิธีใดวิธีหนึ่ง)
หากต้องการทดสอบระบบเฉยๆ **ไม่จำเป็นต้องทำขั้นตอนนี้** ระบบจะเปลี่ยนไปใช้ In-Memory database ให้เองโดยอัตโนมัติ

หากต้องการเชื่อมต่อกับ Google Cloud Firestore จริง:
1. ไปที่ **Firebase Console** (หรือ Google Cloud Console) -> Project Settings -> Service Accounts
2. กดคลิก **Generate new private key** เพื่อดาวน์โหลดไฟล์คีย์ JSON มาเก็บไว้
3. บันทึกไฟล์ JSON นั้นไว้ที่ห้องโปรเจกต์นี้ (เช่น ตั้งชื่อไฟล์ว่า `service-account.json`)
4. เปิดไฟล์ `.env` ในโฟลเดอร์นี้ แล้วเปลี่ยนค่า:
   ```env
   SERVICE_ACCOUNT_KEY=./service-account.json
   FIREBASE_PROJECT_ID=cmfrozen-387fd
   ```

### 3. รันโปรเจกต์ (Localhost)
รันคำสั่งพัฒนา:
```bash
npm run dev
```
หรือรันปกติ:
```bash
npm start
```

เปิดบราวเซอร์เพื่อดูผลลัพธ์ได้ที่:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## รายละเอียด API Endpoints (API Specification)
ฐานข้อมูลจะจัดการผ่าน Base URL: `/api`
- `GET /api/status` : ดึงข้อมูลสถานะการเชื่อมต่อ (Live vs. Demo fallback) และชื่อโปรเจกต์ Google Cloud
- `GET /api/users` : เรียกดูข้อมูลผู้ใช้ทั้งหมด (เรียงตามเวลาที่สร้างล่าสุด)
- `GET /api/users/:id` : เรียกดูรายละเอียดของข้อมูลผู้ใช้เฉพาะ ID นั้นๆ
- `POST /api/users` : บันทึกข้อมูลผู้ใช้ใหม่ (`name` และ `email` เป็นช่องบังคับกรอก)
- `PUT /api/users/:id` : อัปเดตข้อมูลผู้ใช้ที่มีอยู่แล้ว
- `DELETE /api/users/:id` : ลบข้อมูลผู้ใช้ (ต้องการคำยืนยันล่วงหน้า)
