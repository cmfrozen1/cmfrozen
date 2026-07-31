# 📘 คู่มือการใช้งานระบบ LINE MCP Server (mcptest)
**ระบบแจ้งเตือนราคาทองคำ ราคาน้ำมัน ดัชนีหุ้น และคริปโตเคอร์เรนซีผ่าน LINE Flex Message**

---

## 📌 1. บทนำ (Overview)

**LINE MCP Server (`mcptest`)** คือส่วนขยายในรูปแบบ **Model Context Protocol (MCP)** ที่พัฒนาขึ้นด้วย Node.js สำหรับเชื่อมต่อปัญญาประดิษฐ์ (AI Assistant) กับระบบ **LINE Messaging API** ช่วยให้ผู้ใช้และ AI สามารถสั่งการให้ดึงข้อมูลการเงิน การลงทุน และราคาสินค้าโภคภัณฑ์แบบ Real-time แล้วสร้างเป็น **LINE Flex Message** ดีไซน์พรีเมียม สวยงาม อ่านง่าย ส่งตรงไปยังบัญชี LINE ผู้ใช้หรือส่งประกาศ (Broadcast) ได้ทันที

---

## 🏗️ 2. สถาปัตยกรรมระบบ (System Architecture)

```
[ Antigravity / AI Assistant ]
              │ (MCP JSON-RPC / Stdin-Stdout)
              ▼
    [ LINE MCP Server ] (line-mcp-server.js)
              │
     ┌────────┼───────────────┬────────────────┐
     ▼        ▼               ▼                ▼
[สมาคมค้าทองคำ] [บางจาก]  [Yahoo Finance]  [CoinGecko]
     │        │               │                │
     └────────┴───────┬───────┴────────────────┘
                      ▼
            [ LINE Messaging API ]
                      │ (Push / Broadcast)
                      ▼
           📱 [ ผู้ใช้งาน LINE App ]
```

---

## 🛠️ 3. การติดตั้งและตั้งค่าระบบ (Setup & Configuration)

### 3.1 ความต้องการของระบบ (Prerequisites)
- **Node.js**: เวอร์ชัน 18.x หรือใหม่กว่า (แนะนำ v20+)
- **LINE Official Account Access Token**: สำหรับใช้งาน Push / Broadcast API
- **LINE User ID**: รหัสผู้รับข้อความแจ้งเตือน

### 3.2 โครงสร้างโฟลเดอร์โปรเจกต์
```
mcptest/
├── .antigravity/
│   └── mcp.json               # ไฟล์ตั้งค่าสำหรับ Antigravity MCP Client
├── line-mcp-server.js         # ซอร์สโค้ดหลักของ MCP Server
└── USER_MANUAL_MCPTEST.pdf    # คู่มือการใช้งาน (ไฟล์ PDF)
```

### 3.3 การตั้งค่า API Token และ User ID
เปิดไฟล์ `line-mcp-server.js` เพื่อตรวจสอบหรือแก้ไข Token:
```javascript
const CHANNEL_ACCESS_TOKEN = 'YOUR_LINE_CHANNEL_ACCESS_TOKEN';
const MY_USER_ID = 'YOUR_LINE_USER_ID';
```

---

## 🧰 4. เครื่องมือที่รองรับ (Available MCP Tools)

ระบบมีเครื่องมือ (Tools) สำหรับให้ AI หรือระบบภายนอกเรียกใช้งานทั้งหมด **6 เครื่องมือหลัก**:

| ชื่อ เครื่องมือ (Tool Name) | คำอธิบาย (Description) | พารามิเตอร์ (Parameters) |
| :--- | :--- | :--- |
| `send_gold_price_flex` | ดึงราคาทองคำแท่ง/รูปพรรณ 96.5%, Gold Spot และ USD/THB ส่งเป็น Flex Message | `userId` (Optional) |
| `send_oil_price_flex` | ดึงราคาน้ำมันทุกประเภทจากบางจาก (Bangchak) ส่งเป็น Flex Message | `userId` (Optional) |
| `send_set50_flex` | ดึงดัชนี SET/SET50 และราคาหุ้นไทยยอดนิยม 10 อันดับ ส่งเป็น Flex Message | `userId` (Optional) |
| `send_crypto_flex` | ดึงราคาคริปโตเคอร์เรนซี 10 อันดับแรกจาก CoinGecko ส่งเป็น Flex Message | `userId` (Optional) |
| `send_line_message` | ส่งข้อความตัวอักษรธรรมดา (Text Message) หาผู้ใช้ | `message` (Required), `userId` (Optional) |
| `broadcast` | ส่งข้อความประกาศหาผู้ใช้ทุกคนที่เป็นเพื่อนกับ LINE Official Account | `message` (Required) |

---

## 📊 5. รายละเอียดคุณสมบัติเด่น (Key Features)

### 5.1 ระบบแจ้งเตือนราคาทองคำ (`send_gold_price_flex`)
- **แหล่งข้อมูล**: สมาคมค้าทองคำ (Gold Traders Association) + Yahoo Finance (`GC=F`, `THB=X`)
- **ข้อมูลที่แสดง**:
  - ราคารับซื้อ - ขายออก **ทองคำแท่ง 96.5%**
  - ราคารับซื้อ (ฐานภาษี) - ขายออก **ทองรูปพรรณ 96.5%**
  - ราคา **Gold Spot ตลาดโลก** (USD/oz) พร้อมอัตราเปลี่ยนแปลง
  - อัตราแลกเปลี่ยน **USD / THB**
- **ธีม Flex Message**: ธีมทองคำหรูหรา (Golden Luxury Header `#b78103`)

### 5.2 ระบบแจ้งเตือนราคาน้ำมันบางจาก (`send_oil_price_flex`)
- **แหล่งข้อมูล**: Bangchak Oil Price API
- **ข้อมูลที่แสดง**: ราคาน้ำมัน Hi Premium, E20, E85, Gasohol 95/91, Diesel พร้อมส่วนต่างราคาจากเมื่อวาน

### 5.3 ระบบแจ้งเตือนราคาหุ้นไทย (`send_set50_flex`)
- **แหล่งข้อมูล**: Yahoo Finance
- **ข้อมูลที่แสดง**: ดัชนี SET Index, SET50 Index และหุ้น 10 ตัวยอดนิยม (PTT, AOT, CPALL, BDMS, ADVANC, GULF, KBANK, SCB, DELTA, PTTEP)

---

## 💻 6. ตัวอย่างการใช้งาน (Usage Examples)

### การเรียกสั่งการผ่าน AI Assistant (Antigravity):
- *"ดึงราคาทองคำส่งเข้า LINE หน่อย"* ➔ AI จะเรียก tool `send_gold_price_flex`
- *"ขอราคาน้ำมันบางจากวันนี้"* ➔ AI จะเรียก tool `send_oil_price_flex`
- *"อัปเดตราคาหุ้น SET50"* ➔ AI จะเรียก tool `send_set50_flex`

---

## ❓ 7. การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

1. **ส่งข้อความไม่ผ่าน / เกิด Error 401 Unauthorized**:
   - ให้ตรวจสอบ `CHANNEL_ACCESS_TOKEN` ในไฟล์ `line-mcp-server.js` ว่ายังไม่หมดอายุหรือสะกดถูกต้อง
2. **ไม่ได้รับข้อความใน LINE**:
   - ตรวจสอบ `MY_USER_ID` ว่าเป็น User ID ของบัญชี LINE ที่สแกนเป็นเพื่อนกับ LINE Official Account แล้วหรือไม่
3. **พอร์ต 3000 ชน (EADDRINUSE)**:
   - หากรันเว็บเซิร์ฟเวอร์เสริมพอร์ต 3000 ให้ตรวจสอบกระบวนการ Node.js ที่ค้างอยู่ด้วย `lsof -i:3000` แล้วสั่งปิดกระบวนการเดิม

---
*เอกสารจัดทำขึ้นเมื่อ: 31 กรกฎาคม 2026*
