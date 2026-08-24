const functions = require("firebase-functions");
const https = require("https");

const CHANNEL_ACCESS_TOKEN = 'M3Kq6rRtEbwEqw8FwrwE961ZFGyH/XO5doAy6BYwQQF+adWLctYF162u2ruTk114Oas14dPVOE03uOR2fsh7g82UkFtc4Ssx3ryMhUQgeJ48vpoVkFv9ZsllbsdRJEneCuL6/mWsCKHYlrnKURr1CAdB04t89/1O/w1cDnyilFU=';
const MY_USER_ID = 'Udbbade279eccf58a2092f492a452e608';
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1tj5offSX2VVuUzQPInkQlTxnFXdzdKEqkegvkxeCkyM/export?format=csv';

function lineApiRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.line.me',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function fetchEmployeeSheet() {
  return new Promise((resolve, reject) => {
    const getUrl = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          getUrl(res.headers.location);
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length <= 1) { resolve([]); return; }
            const employees = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',');
              if (cols.length >= 5) {
                employees.push({
                  dept: cols[0] ? cols[0].trim() : '',
                  id: cols[1] ? cols[1].trim() : '',
                  name: cols[2] ? cols[2].trim() : '',
                  address: cols[3] ? cols[3].trim() : '',
                  salary: cols[4] ? cols[4].trim() : '0',
                  avatar: cols[5] ? cols[5].trim() : 'https://i.pravatar.cc/150'
                });
              }
            }
            resolve(employees);
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    };
    getUrl(GOOGLE_SHEET_CSV_URL);
  });
}

async function searchEmployees(query) {
  const employees = await fetchEmployeeSheet();
  if (!query) return employees;
  const q = query.toLowerCase().trim();
  return employees.filter(emp => 
    emp.name.toLowerCase().includes(q) ||
    emp.id.toLowerCase().includes(q) ||
    emp.dept.toLowerCase().includes(q) ||
    emp.address.toLowerCase().includes(q)
  );
}

function fetchGoldPrices() {
  return new Promise((resolve) => {
    https.get('https://goldtraders.or.th/', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const unescaped = data.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const prices = unescaped.match(/\d{2},\d{3}/g);
          let dateStr = '';
          const dateMatch = unescaped.match(/ประจำวันที่\s*([0-9\/\s\-a-zA-Zก-๙]+)/) || unescaped.match(/(\d{1,2}\s+[ก-๙]+\s+\d{4})/);
          if (dateMatch) dateStr = dateMatch[1].trim();
          let timeStr = '';
          const timeMatch = unescaped.match(/เวลา\s*(\d{1,2}:\d{2})/);
          if (timeMatch) timeStr = timeMatch[1].trim();

          if (prices && prices.length >= 4) {
            resolve({
              goldBarBuy: prices[0], goldBarSell: prices[1],
              goldOmBuy: prices[2], goldOmSell: prices[3],
              date: dateStr || new Date().toLocaleDateString('th-TH'),
              time: timeStr || new Date().toLocaleTimeString('th-TH')
            });
          } else { resolve(null); }
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchOilPrices() {
  return new Promise((resolve, reject) => {
    https.get('https://oil-price.bangchak.co.th/ApiOilPrice2/th', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.length > 0) {
            const oilList = JSON.parse(parsed[0].OilList);
            resolve({ date: parsed[0].OilDateNow || new Date().toLocaleDateString('th-TH'), oilList: oilList });
          } else { reject(new Error('ไม่พบข้อมูลราคาน้ำมัน')); }
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// LINE Webhook Function
exports.lineWebhook = functions.region("asia-southeast1").https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("LINE Webhook Cloud Function is running!");
    return;
  }

  const events = req.body.events || [];
  for (const event of events) {
    if (event.type === 'message' && event.message) {
      const replyToken = event.replyToken;
      if (event.message.type === 'text') {
        const text = event.message.text.trim();
        let replyMessage = null;

        if (text.includes('ทอง') || text.includes('gold')) {
          const data = await fetchGoldPrices();
          if (data) {
            replyMessage = `🟡 ราคาทองคำวันนี้ (${data.date} ${data.time})\n- ทองคำแท่ง รับซื้อ ${data.goldBarBuy} / ขายออก ${data.goldBarSell}\n- ทองรูปพรรณ รับซื้อ ${data.goldOmBuy} / ขายออก ${data.goldOmSell}`;
          }
        } else if (text.includes('น้ำมัน') || text.includes('oil')) {
          const data = await fetchOilPrices();
          if (data) {
            replyMessage = `⛽ ราคาน้ำมันบางจากวันนี้ (${data.date})\n` + data.oilList.map(o => `- ${o.OilName}: ${o.PriceToday} บาท/ลิตร`).join('\n');
          }
        } else {
          const matched = await searchEmployees(text);
          if (matched && matched.length > 0) {
            const emp = matched[0];
            replyMessage = `👤 ข้อมูลพนักงาน (${matched.length} รายการ):\n- รหัส: ${emp.id}\n- ชื่อ: ${emp.name}\n- แผนก: ${emp.dept}\n- ที่อยู่: ${emp.address}\n- เงินเดือน: ${parseInt(emp.salary.replace(/[^0-9]/g,'')).toLocaleString()} บาท`;
          } else if (text.toLowerCase() === 'help' || text === 'ช่วยเหลือ') {
            replyMessage = `🤖 คำสั่งที่รองรับ:\n- พิมพ์ ชื่อ/รหัสพนักงาน/แผนก เพื่อค้นหาข้อมูลพนักงาน\n- พิมพ์ "ราคาทอง"\n- พิมพ์ "ราคาน้ำมัน"\n- ส่งตำแหน่งแผนที่ (Location) เพื่อเช็กสภาพอากาศในพิกัดของคุณ`;
          }
        }

        if (replyMessage && replyToken) {
          await lineApiRequest('/v2/bot/message/reply', 'POST', {
            replyToken: replyToken,
            messages: [{ type: 'text', text: replyMessage }]
          });
        }
      } else if (event.message.type === 'location') {
        try {
          const { latitude, longitude, address, title } = event.message;
          const weatherData = await fetchWeather(latitude, longitude);
          if (weatherData && weatherData.current) {
            const temp = weatherData.current.temperature_2m;
            const humidity = weatherData.current.relative_humidity_2m;
            const code = weatherData.current.weather_code;
            const details = getWeatherDetails(code);
            const displayName = title || address || `พิกัด ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            
            const flexMsg = makeWeatherFlex(displayName, temp, humidity, details);
            
            await lineApiRequest('/v2/bot/message/reply', 'POST', {
              replyToken: replyToken,
              messages: [{
                type: 'flex',
                altText: `สภาพอากาศสำหรับ ${displayName}`,
                contents: flexMsg
              }]
            });
          } else {
            if (replyToken) {
              await lineApiRequest('/v2/bot/message/reply', 'POST', {
                replyToken: replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงข้อมูลสภาพอากาศในขณะนี้ได้ครับ' }]
              });
            }
          }
        } catch (err) {
          console.error('Error handling location weather:', err);
          if (replyToken) {
            await lineApiRequest('/v2/bot/message/reply', 'POST', {
              replyToken: replyToken,
              messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการตรวจสอบสภาพอากาศ กรุณาลองใหม่อีกครั้งครับ' }]
            });
          }
        }
      }
    }
  }

  res.status(200).json({ status: "ok" });
});

// ============================================================
//  Webhook proxy สำหรับ LINE OA "Map_API" (@042shrup) — ระบบ pushmessage
//
//  ทำไมต้องมี: LINE กำหนดให้ webhook ต้องตอบ 2xx ตรง ๆ แต่ GAS Web App
//  ตอบ POST ทุกครั้งด้วย 302 redirect (LINE ไม่ติดตาม redirect ->
//  error_status_code 302 -> ข้อความ "ยืนยันสมาชิก TOKEN" ไม่เคยถึง GAS)
//
//  ฟังก์ชันนี้ตอบ 200 ให้ LINE ทันที แล้ว forward payload ไปที่ GAS /exec
//  โดย follow redirect ไปที่ echo URL (การ GET echo URL จะทำให้ doPost
//  ฝั่ง GAS ทำงานกับ payload เดิม)
//
//  ตั้งค่า: เปลี่ยน Webhook URL ใน LINE Developers Console เป็น URL ของฟังก์ชันนี้
// ============================================================
const PUSHMESSAGE_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwJW1B4Vp9lzLo-MQxl2MoK22h8Xo0KHQbYtbgUnBaDsYPxDtgRQzOAzubQcl4Vnkd0/exec';

exports.pushmessageWebhook = functions.region("asia-southeast1").https.onRequest((req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("pushmessage webhook proxy is running!");
    return;
  }

  const body = (typeof req.body === 'string') ? req.body : JSON.stringify(req.body || {});

  // ตอบ LINE ทันที (LINE ต้องการ 2xx)
  res.status(200).send("ok");

  // forward ไป GAS แบบ fire-and-forget — GAS ตอบ 302 แล้วต้อง follow redirect
  forwardToGas(body).catch((err) => {
    console.error('pushmessageWebhook forward error:', err);
  });
});

function forwardToGas(body) {
  return new Promise((resolve, reject) => {
    const url = new URL(PUSHMESSAGE_GAS_WEB_APP_URL);
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
        // GAS redirect -> ไป GET ที่ echo URL (payload ถูกฝังใน user_content_key แล้ว)
        res.resume();
        const loc = new URL(res.headers.location);
        https.get(loc, (r2) => {
          r2.resume();
          resolve();
        }).on('error', (e) => {
          // GAS ยังประมวลผลต่อฝั่ง server ถึงแม้ client จะตัดการเชื่อมต่อ
          console.error('pushmessageWebhook: GAS echo error:', e);
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

function fetchWeather(lat, lon) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function getWeatherDetails(code) {
  if (code === 0) {
    return {
      desc: "ท้องฟ้าแจ่มใส / แดดออก",
      icon: "https://cdn-icons-png.flaticon.com/512/3222/3222800.png",
      tip: "วันนี้แดดแรง อย่าลืมทาครีมกันแดดและพกน้ำดื่มระหว่างวันด้วยนะคะ"
    };
  } else if (code >= 1 && code <= 3) {
    return {
      desc: "มีเมฆบางส่วน / เมฆครึ้ม",
      icon: "https://cdn-icons-png.flaticon.com/512/1163/1163624.png",
      tip: "อากาศค่อนข้างครึ้มฟ้าครึ้มฝน เหมาะกับการเดินทางท่องเที่ยวใกล้ๆ"
    };
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      desc: "ฝนตก / ฝนฟ้าคะนอง",
      icon: "https://cdn-icons-png.flaticon.com/512/1163/1163734.png",
      tip: "มีฝนตกในพื้นที่ ควรพกร่มหรือเสื้อกันฝน และขับรถด้วยความระมัดระวัง"
    };
  } else if (code >= 71 && code <= 77) {
    return {
      desc: "หิมะตก",
      icon: "https://cdn-icons-png.flaticon.com/512/2315/2315309.png",
      tip: "อากาศหนาวจัดและมีหิมะตก ดูแลสุขภาพและรักษาความอบอุ่นของร่างกาย"
    };
  } else {
    return {
      desc: "สภาพอากาศแปรปรวน / หมอกลง",
      icon: "https://cdn-icons-png.flaticon.com/512/2910/2910202.png",
      tip: "มีหมอกลงหนาจัด ทัศนวิสัยจำกัดโปรดระมัดระวังในการเดินทางด้วยค่ะ"
    };
  }
}

function makeWeatherFlex(address, temp, humidity, details) {
  return {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "สภาพอากาศตำแหน่งของคุณ",
                  "color": "#FFFFFFB3",
                  "size": "xs"
                },
                {
                  "type": "text",
                  "text": address || "ตำแหน่งปัจจุบัน",
                  "color": "#FFFFFF",
                  "weight": "bold",
                  "size": "lg",
                  "wrap": true
                }
              ],
              "flex": 7
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "วันนี้",
                  "color": "#FFFFFF",
                  "weight": "bold",
                  "size": "sm",
                  "align": "end"
                },
                {
                  "type": "text",
                  "text": "อัปเดตสดๆ",
                  "color": "#FFFFFFB3",
                  "size": "xxs",
                  "align": "end"
                }
              ],
              "flex": 3,
              "justifyContent": "center"
            }
          ]
        }
      ],
      "backgroundColor": "#2B5876",
      "paddingTop": "19px",
      "paddingBottom": "19px"
    },
    "hero": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "image",
              "url": details.icon,
              "size": "lg",
              "flex": 4
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": `${temp}°C`,
                  "size": "4xl",
                  "weight": "bold",
                  "color": "#111111"
                },
                {
                  "type": "text",
                  "text": details.desc,
                  "size": "sm",
                  "color": "#555555",
                  "weight": "bold"
                }
              ],
              "flex": 6,
              "justifyContent": "center",
              "paddingStart": "10px"
            }
          ],
          "paddingAll": "20px"
        }
      ],
      "backgroundColor": "#F4F7F6"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "image",
                  "url": "https://cdn-icons-png.flaticon.com/512/727/727790.png",
                  "size": "xxs"
                },
                {
                  "type": "text",
                  "text": "ความชื้น",
                  "size": "xs",
                  "color": "#888888",
                  "margin": "sm"
                },
                {
                  "type": "text",
                  "text": `${humidity}%`,
                  "size": "sm",
                  "weight": "bold",
                  "color": "#333333"
                }
              ],
              "alignItems": "center"
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "image",
                  "url": "https://cdn-icons-png.flaticon.com/512/4814/4814268.png",
                  "size": "xxs"
                },
                {
                  "type": "text",
                  "text": "แหล่งข้อมูล",
                  "size": "xs",
                  "color": "#888888",
                  "margin": "sm"
                },
                {
                  "type": "text",
                  "text": "Open-Meteo",
                  "size": "sm",
                  "weight": "bold",
                  "color": "#333333"
                }
              ],
              "alignItems": "center"
            }
          ],
          "spacing": "md"
        },
        {
          "type": "separator",
          "margin": "xxl",
          "color": "#EEEEEE"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "text",
              "text": "คำแนะนำ:",
              "size": "xs",
              "color": "#4E73DF",
              "weight": "bold",
              "flex": 3
            },
            {
              "type": "text",
              "text": details.tip,
              "size": "xs",
              "color": "#666666",
              "wrap": true,
              "flex": 9
            }
          ],
          "margin": "md"
        }
      ],
      "paddingAll": "20px"
    },
    "styles": {
      "footer": {
        "separator": true
      }
    }
  };
}
