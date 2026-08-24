# pushmessage-line-proxy

LINE webhook proxy สำหรับระบบ pushmessage (LINE OA @042shrup)

LINE ต้องการให้ webhook ตอบ **2xx ตรง ๆ** แต่ Google Apps Script Web App
ตอบ **302 redirect** เสมอ (LINE ไม่ติดตาม redirect) → ข้อความ "ยืนยันสมาชิก TOKEN"
ไม่เคยถึง GAS → ต้องมี proxy ตัวนี้ตอบ 200 ให้ LINE แล้ว forward ไป GAS

## Deploy (เลือกอย่างใดอย่างหนึ่ง)

### Render (ฟรี)
1. Push โฟลเดอร์นี้ขึ้น GitHub
2. https://render.com → New → **Web Service** → เชื่อม repo นี้
3. ตั้งค่า: Environment = **Node**, Start Command = `node server.js`
4. Deploy → ได้ URL เช่น `https://xxx.onrender.com`
5. **เปิด URL นี้ใน Webhook URL ของ LINE** (LINE Developers Console → Messaging API → Webhook settings) → เปิด Use webhook → Verify ควรสำเร็จ

### Railway / Koyeb / Fly.io / VPS
- รันด้วย `node server.js` (PORT มาจาก env `PORT` หรือ 3000)
- นำ URL ที่ได้ไปใส่เป็น Webhook URL ของ LINE

## ทดสอบ
```
curl -X POST https://<your-url>/ -H "Content-Type: application/json" -d '{"events":[]}'
# ควรได้ HTTP 200 และ response "ok"
```
