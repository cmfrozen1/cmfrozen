// ============================================================
//  LINE Webhook Proxy -> Google Apps Script (pushmessage)
//
//  เหตุผล: LINE ต้องการ webhook response 2xx ตรง ๆ แต่ GAS Web App
//  ตอบ 302 redirect เสมอ -> LINE ไม่รับ webhook -> ระบบยืนยันสมาชิกไม่ทำงาน
//
//  ฟังก์ชันนี้: ตอบ 200 ให้ LINE ทันที แล้ว forward payload ไป GAS
//  (follow redirect ไป echo URL ซึ่งจะทำให้ doPost ฝั่ง GAS ทำงาน)
//
//  Deploy ได้กับ: Render / Railway / Koyeb / Fly.io / VPS ใด ๆ
//  คำสั่งรัน: node server.js  (PORT = env PORT หรือ 3000)
// ============================================================
const http = require('http');
const https = require('https');

// 👇 URL ของ Web App GAS (ระบบ pushmessage) — เปลี่ยนได้ถ้า deploy ใหม่
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwJW1B4Vp9lzLo-MQxl2MoK22h8Xo0KHQbYtbgUnBaDsYPxDtgRQzOAzubQcl4Vnkd0/exec';

const PORT = process.env.PORT || 3000;

function forwardToGas(body) {
  return new Promise((resolve, reject) => {
    const url = new URL(GAS_WEB_APP_URL);
    const data = Buffer.from(body, 'utf8');

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // GAS redirect -> GET ที่ echo URL (payload ฝังอยู่ใน user_content_key แล้ว)
        res.resume();
        const loc = new URL(res.headers.location);
        https.get(loc, (r2) => {
          r2.resume();
          resolve();
        }).on('error', (e) => {
          // GAS ยังประมวลผลต่อฝั่ง server ถึงแม้ client จะตัดการเชื่อมต่อ
          console.error('GAS echo error:', e);
          resolve();
        });
      } else {
        res.resume();
        resolve();
      }
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      // ตอบ LINE ทันที (LINE ต้องการ 2xx ภายในเวลาจำกัด)
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');

      // forward ไป GAS แบบ fire-and-forget
      forwardToGas(raw || '{}').catch((e) => {
        console.error('forward error:', e);
      });
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pushmessage webhook proxy is running!');
  }
});

server.listen(PORT, () => {
  console.log('pushmessage proxy listening on port', PORT);
});
