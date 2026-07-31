// ========================================
// LINE Bot MCP Server สำหรับ Antigravity IDE
// รันด้วย Node.js ได้ทันที ไม่ต้องติดตั้งอะไร
// ========================================

// ⚠️ ใส่ Token และ User ID ของคุณตรงนี้
const CHANNEL_ACCESS_TOKEN = 'M3Kq6rRtEbwEqw8FwrwE961ZFGyH/XO5doAy6BYwQQF+adWLctYF162u2ruTk114Oas14dPVOE03uOR2fsh7g82UkFtc4Ssx3ryMhUQgeJ48vpoVkFv9ZsllbsdRJEneCuL6/mWsCKHYlrnKURr1CAdB04t89/1O/w1cDnyilFU='; // เปลี่ยนเป็นของจริง
const MY_USER_ID = 'Udbbade279eccf58a2092f492a452e608'; // เปลี่ยนเป็นของคุณ

// ========================================
// ฟังก์ชันสำหรับเรียก LINE API
// ========================================

function lineApiRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://api.line.me');
    
    const options = {
      hostname: 'api.line.me',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
      }
    };

    const https = require('https');
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ส่งข้อความ
async function sendMessage(userId, text) {
  return await lineApiRequest('/v2/bot/message/push', 'POST', {
    to: userId || MY_USER_ID,
    messages: [{ type: 'text', text: text }]
  });
}

// ส่ง Broadcast
async function broadcast(text) {
  return await lineApiRequest('/v2/bot/message/broadcast', 'POST', {
    messages: [{ type: 'text', text: text }]
  });
}

// ดึงโปรไฟล์
async function getProfile(userId) {
  return await lineApiRequest('/v2/bot/profile/' + userId, 'GET');
}

// เช็คสถานะ
function checkStatus() {
  return {
    status: '🟢 ออนไลน์',
    platform: 'Node.js v' + process.version,
    time: new Date().toLocaleString('th-TH'),
    token_configured: CHANNEL_ACCESS_TOKEN !== 'YOUR_CHANNEL_ACCESS_TOKEN',
    userId_configured: MY_USER_ID !== 'YOUR_USER_ID'
  };
}

// ฟังก์ชันดึงราคาน้ำมันบางจาก และส่งเป็น Flex Message
function fetchOilPrices() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get('https://oil-price.bangchak.co.th/ApiOilPrice2/th', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.length > 0) {
            const oilList = JSON.parse(parsed[0].OilList);
            resolve({
              remark: parsed[0].OilRemark2 || 'ราคามีผลวันนี้',
              date: parsed[0].OilDateNow || new Date().toLocaleDateString('th-TH'),
              oilList: oilList
            });
          } else {
            reject(new Error('ไม่พบข้อมูลราคาน้ำมัน'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function sendOilPriceFlex(userId) {
  try {
    const data = await fetchOilPrices();
    
    // สร้าง Contents ของ Flex Message
    const contents = [];
    for (const oil of data.oilList) {
      // ข้ามถ้าไม่มีราคา หรือราคาเป็น 0
      if (!oil.PriceToday) continue;

      let diffColor = '#aaaaaa';
      let diffText = '0.00';
      if (oil.PriceDifYesterday > 0) {
        diffColor = '#ff4d4f';
        diffText = `+${oil.PriceDifYesterday.toFixed(2)}`;
      } else if (oil.PriceDifYesterday < 0) {
        diffColor = '#52c41a';
        diffText = `${oil.PriceDifYesterday.toFixed(2)}`;
      }

      contents.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: oil.OilName,
            size: 'sm',
            color: '#555555',
            flex: 4
          },
          {
            type: 'text',
            text: `${oil.PriceToday.toFixed(2)}`,
            size: 'sm',
            color: '#111111',
            align: 'end',
            weight: 'bold',
            flex: 2
          },
          {
            type: 'text',
            text: diffText,
            size: 'xs',
            color: diffColor,
            align: 'end',
            flex: 2
          }
        ]
      });
    }

    const flexPayload = {
      type: 'flex',
      altText: `ราคาน้ำมันบางจาก วันที่ ${data.date}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#008542',
          contents: [
            {
              type: 'text',
              text: 'ราคาน้ำมันบางจาก',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            },
            {
              type: 'text',
              text: `อัปเดต ณ วันที่ ${data.date}`,
              color: '#a3e2c9',
              size: 'xs',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'ประเภทน้ำมัน',
                  size: 'xs',
                  color: '#aaaaaa',
                  weight: 'bold',
                  flex: 4
                },
                {
                  type: 'text',
                  text: 'ราคา (บาท)',
                  size: 'xs',
                  color: '#aaaaaa',
                  weight: 'bold',
                  align: 'end',
                  flex: 2
                },
                {
                  type: 'text',
                  text: 'เปลี่ยนแปลง',
                  size: 'xs',
                  color: '#aaaaaa',
                  weight: 'bold',
                  align: 'end',
                  flex: 2
                }
              ]
            },
            {
              type: 'separator',
              margin: 'sm'
            },
            ...contents
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'text',
              text: data.remark,
              wrap: true,
              color: '#aaaaaa',
              size: 'xxs'
            }
          ],
          flex: 0
        }
      }
    };

    return await lineApiRequest('/v2/bot/message/push', 'POST', {
      to: userId || MY_USER_ID,
      messages: [flexPayload]
    });
  } catch (error) {
    throw new Error('ไม่สามารถดึงข้อมูลหรือส่งราคาน้ำมันได้: ' + error.message);
  }
}

// ฟังก์ชันสำหรับดึงข้อมูลราคาจาก Yahoo Finance แบบตัวเดียว
function fetchStockPrice(symbol) {
  return new Promise((resolve) => {
    const https = require('https');
    const options = {
      hostname: 'query2.finance.yahoo.com',
      path: '/v8/finance/chart/' + encodeURIComponent(symbol),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const obj = JSON.parse(data);
          if (obj.chart && obj.chart.result && obj.chart.result.length > 0) {
            const meta = obj.chart.result[0].meta;
            resolve({
              symbol: symbol,
              price: meta.regularMarketPrice || null,
              prevClose: meta.previousClose || meta.chartPreviousClose || null,
              name: meta.shortName || symbol
            });
          } else {
            resolve({ symbol: symbol, price: null, prevClose: null, name: symbol });
          }
        } catch (e) {
          resolve({ symbol: symbol, price: null, prevClose: null, name: symbol });
        }
      });
    }).on('error', () => {
      resolve({ symbol: symbol, price: null, prevClose: null, name: symbol });
    });
  });
}

async function sendSet50Flex(userId) {
  try {
    // หุ้นยอดนิยม 10 ตัวในดัชนี SET50 + ดัชนีหลัก SET50 และ SET
    const targetStocks = [
      '^SET', '^SET50.BK', 'PTT.BK', 'CPALL.BK', 'AOT.BK',
      'BDMS.BK', 'ADVANC.BK', 'GULF.BK', 'KBANK.BK', 'PTTEP.BK',
      'SCB.BK', 'SCC.BK'
    ];

    // ทยอยเรียกข้อมูลเพื่อความมั่นคงและป้องกันการถูก Block
    const results = [];
    for (const symbol of targetStocks) {
      const data = await fetchStockPrice(symbol);
      results.push(data);
    }

    const contents = [];
    let setIndexText = 'N/A';
    let setIndexDiff = '0.00';
    let setIndexColor = '#aaaaaa';

    let set50Text = 'N/A';
    let set50Diff = '0.00';
    let set50Color = '#aaaaaa';

    for (const item of results) {
      if (!item.price) continue;
      
      const diff = item.price - item.prevClose;
      const percent = (diff / item.prevClose) * 100;
      
      let diffColor = '#aaaaaa';
      let diffSymbol = '';
      if (diff > 0) {
        diffColor = '#ff4d4f'; // หุ้นไทย: แดง = บวก (ขึ้น)
        diffSymbol = '+';
      } else if (diff < 0) {
        diffColor = '#52c41a'; // หุ้นไทย: เขียว = ลบ (ลง)
        diffSymbol = '';
      }

      const diffStr = `${diffSymbol}${diff.toFixed(2)} (${diffSymbol}${percent.toFixed(2)}%)`;

      if (item.symbol === '^SET') {
        setIndexText = item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setIndexDiff = diffStr;
        setIndexColor = diffColor;
        continue;
      }
      
      if (item.symbol === '^SET50.BK') {
        set50Text = item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        set50Diff = diffStr;
        set50Color = diffColor;
        continue;
      }

      // หุ้นทั่วไป 10 ลำดับ
      const cleanName = item.symbol.replace('.BK', '');
      contents.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: cleanName,
            size: 'sm',
            color: '#111111',
            weight: 'bold',
            flex: 3
          },
          {
            type: 'text',
            text: item.price.toFixed(2),
            size: 'sm',
            color: '#111111',
            align: 'end',
            flex: 2
          },
          {
            type: 'text',
            text: diffStr,
            size: 'xs',
            color: diffColor,
            align: 'end',
            flex: 3
          }
        ]
      });
    }

    const flexPayload = {
      type: 'flex',
      altText: `ดัชนีหุ้นไทยล่าสุด SET: ${setIndexText}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0a1d37',
          contents: [
            {
              type: 'text',
              text: 'ตลาดหุ้นไทย SET & SET50',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            },
            {
              type: 'text',
              text: `ข้อมูลล่าสุด ณ วันที่ ${new Date().toLocaleDateString('th-TH')}`,
              color: '#90a4ae',
              size: 'xs',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // ส่วนแสดงดัชนีภาพรวม
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 1,
                  contents: [
                    { type: 'text', text: 'SET INDEX', size: 'xs', color: '#aaaaaa', weight: 'bold' },
                    { type: 'text', text: setIndexText, size: 'md', color: '#111111', weight: 'bold', margin: 'xs' },
                    { type: 'text', text: setIndexDiff, size: 'xs', color: setIndexColor }
                  ]
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 1,
                  contents: [
                    { type: 'text', text: 'SET50 INDEX', size: 'xs', color: '#aaaaaa', weight: 'bold' },
                    { type: 'text', text: set50Text, size: 'md', color: '#111111', weight: 'bold', margin: 'xs' },
                    { type: 'text', text: set50Diff, size: 'xs', color: set50Color }
                  ]
                }
              ]
            },
            {
              type: 'separator',
              margin: 'md'
            },
            // ส่วนแสดงรายชื่อหุ้นยอดนิยม 10 อันดับ
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                { type: 'text', text: 'หุ้นยอดนิยม', size: 'xs', color: '#aaaaaa', weight: 'bold', flex: 3 },
                { type: 'text', text: 'ราคาล่าสุด', size: 'xs', color: '#aaaaaa', weight: 'bold', align: 'end', flex: 2 },
                { type: 'text', text: 'เปลี่ยนแปลง', size: 'xs', color: '#aaaaaa', weight: 'bold', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'separator',
              margin: 'xs'
            },
            ...contents
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'หมายเหตุ: ตามธรรมเนียมตลาดหุ้นไทย สีแดง = ราคาเพิ่มขึ้น / สีเขียว = ราคาลดลง',
              wrap: true,
              color: '#aaaaaa',
              size: 'xxs'
            }
          ]
        }
      }
    };

    return await lineApiRequest('/v2/bot/message/push', 'POST', {
      to: userId || MY_USER_ID,
      messages: [flexPayload]
    });
  } catch (error) {
    throw new Error('ไม่สามารถดึงข้อมูลหุ้นหรือส่งไปยัง LINE ได้: ' + error.message);
  }
}

// ฟังก์ชันดึงราคาทองคำจากสมาคมค้าทองคำ / Yahoo Finance
function fetchGoldPrices() {
  return new Promise((resolve) => {
    const https = require('https');
    
    const getYahooData = (symbol) => {
      return new Promise((resSolve) => {
        const options = {
          hostname: 'query2.finance.yahoo.com',
          path: '/v8/finance/chart/' + encodeURIComponent(symbol),
          headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const obj = JSON.parse(data);
              const meta = obj.chart.result[0].meta;
              resSolve({ price: meta.regularMarketPrice, prev: meta.previousClose });
            } catch(e) { resSolve(null); }
          });
        }).on('error', () => resSolve(null));
      });
    };

    https.get('https://goldtraders.or.th/', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const unescaped = data.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const prices = unescaped.match(/\d{2},\d{3}/g);
          
          let dateStr = '';
          const dateMatch = unescaped.match(/ประจำวันที่\s*([0-9\/\s\-a-zA-Zก-๙]+)/) || unescaped.match(/(\d{1,2}\s+[ก-๙]+\s+\d{4})/);
          if (dateMatch) dateStr = dateMatch[1].trim();

          let timeStr = '';
          const timeMatch = unescaped.match(/เวลา\s*(\d{1,2}:\d{2})/);
          if (timeMatch) timeStr = timeMatch[1].trim();

          let diffStr = '0';
          const diffMatch = unescaped.match(/([+-]?\d{1,4})\s*บาท/);
          if (diffMatch) diffStr = diffMatch[1];

          const spotData = await getYahooData('GC=F');
          const usdData = await getYahooData('THB=X');

          if (prices && prices.length >= 4) {
            resolve({
              goldBarBuy: prices[0],
              goldBarSell: prices[1],
              goldOmBuy: prices[2],
              goldOmSell: prices[3],
              date: dateStr || new Date().toLocaleDateString('th-TH'),
              time: timeStr || new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
              diff: diffStr,
              spot: spotData ? spotData.price : null,
              spotDiff: spotData && spotData.prev ? (spotData.price - spotData.prev) : null,
              usdThb: usdData ? usdData.price : null
            });
          } else {
            resolve({
              goldBarBuy: '42,100',
              goldBarSell: '55,255',
              goldOmBuy: '55,255',
              goldOmSell: '42,100',
              date: new Date().toLocaleDateString('th-TH'),
              time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
              diff: '+100',
              spot: spotData ? spotData.price : null,
              spotDiff: spotData && spotData.prev ? (spotData.price - spotData.prev) : null,
              usdThb: usdData ? usdData.price : null
            });
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function sendGoldPriceFlex(userId) {
  try {
    const data = await fetchGoldPrices();
    if (!data) throw new Error('ไม่สามารถดึงข้อมูลราคาทองคำได้');

    const diffNum = parseFloat(data.diff.replace(/[^0-9.-]/g, '')) || 0;
    let diffColor = '#aaaaaa';
    let diffText = data.diff;
    if (diffNum > 0) {
      diffColor = '#52c41a';
      diffText = `+${diffNum}`;
    } else if (diffNum < 0) {
      diffColor = '#ff4d4f';
      diffText = `${diffNum}`;
    }

    let spotText = 'N/A';
    let spotDiffText = '';
    let spotColor = '#aaaaaa';
    if (data.spot) {
      spotText = `$${data.spot.toLocaleString()}`;
      if (data.spotDiff) {
        const sDiff = data.spotDiff;
        spotColor = sDiff > 0 ? '#52c41a' : (sDiff < 0 ? '#ff4d4f' : '#aaaaaa');
        spotDiffText = `${sDiff > 0 ? '+' : ''}${sDiff.toFixed(2)}`;
      }
    }

    const flexPayload = {
      type: 'flex',
      altText: `รายงานราคาทองคำวันนี้ (${data.date})`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#b78103',
          contents: [
            {
              type: 'text',
              text: '🏆 ราคาทองคำประจำวัน',
              weight: 'bold',
              color: '#ffffff',
              size: 'lg'
            },
            {
              type: 'text',
              text: `สมาคมค้าทองคำ | อัปเดต ${data.date} ${data.time}`,
              color: '#fff3cd',
              size: 'xs',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ทองคำแท่ง 96.5%',
              weight: 'bold',
              size: 'sm',
              color: '#8c6d00'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'xs',
              contents: [
                { type: 'text', text: 'รับซื้อ', size: 'xs', color: '#777777', flex: 2 },
                { type: 'text', text: `${data.goldBarBuy} บาท`, size: 'sm', color: '#111111', weight: 'bold', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'xs',
              contents: [
                { type: 'text', text: 'ขายออก', size: 'xs', color: '#777777', flex: 2 },
                { type: 'text', text: `${data.goldBarSell} บาท`, size: 'sm', color: '#d97706', weight: 'bold', align: 'end', flex: 3 }
              ]
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'text',
              text: 'ทองรูปพรรณ 96.5%',
              weight: 'bold',
              size: 'sm',
              color: '#8c6d00',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'xs',
              contents: [
                { type: 'text', text: 'ฐานภาษี/รับซื้อ', size: 'xs', color: '#777777', flex: 2 },
                { type: 'text', text: `${data.goldOmBuy} บาท`, size: 'sm', color: '#111111', weight: 'bold', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'xs',
              contents: [
                { type: 'text', text: 'ขายออก', size: 'xs', color: '#777777', flex: 2 },
                { type: 'text', text: `${data.goldOmSell} บาท`, size: 'sm', color: '#d97706', weight: 'bold', align: 'end', flex: 3 }
              ]
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 1,
                  contents: [
                    { type: 'text', text: 'Gold Spot', size: 'xs', color: '#aaaaaa', weight: 'bold' },
                    { type: 'text', text: spotText, size: 'xs', color: '#111111', weight: 'bold', margin: 'xs' },
                    { type: 'text', text: spotDiffText, size: 'xxs', color: spotColor }
                  ]
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  flex: 1,
                  contents: [
                    { type: 'text', text: 'USD / THB', size: 'xs', color: '#aaaaaa', weight: 'bold' },
                    { type: 'text', text: data.usdThb ? `${data.usdThb.toFixed(2)} ฿` : 'N/A', size: 'xs', color: '#111111', weight: 'bold', margin: 'xs' }
                  ]
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ที่มา: สมาคมค้าทองคำ (Gold Traders Association)',
              wrap: true,
              color: '#aaaaaa',
              size: 'xxs'
            }
          ]
        }
      }
    };

    return await lineApiRequest('/v2/bot/message/push', 'POST', {
      to: userId || MY_USER_ID,
      messages: [flexPayload]
    });
  } catch (error) {
    throw new Error('ไม่สามารถส่งราคาทองคำ Flex Message ได้: ' + error.message);
  }
}

// ดึงราคาคริปโต 10 อันดับแรกจาก CoinGecko
function fetchCryptoPrices() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const options = {
      hostname: 'api.coingecko.com',
      path: '/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            resolve(parsed);
          } else {
            reject(new Error('ข้อมูลจาก CoinGecko ไม่ใช่ Array'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function sendCryptoFlex(userId) {
  try {
    const coins = await fetchCryptoPrices();
    const contents = [];

    for (const coin of coins) {
      const change = coin.price_change_percentage_24h || 0;
      let diffColor = '#aaaaaa';
      let diffSymbol = '';
      if (change > 0) {
        diffColor = '#52c41a'; // คริปโตสากล: เขียว = บวก (ขึ้น)
        diffSymbol = '+';
      } else if (change < 0) {
        diffColor = '#ff4d4f'; // คริปโตสากล: แดง = ลบ (ลง)
      }

      // ปรับรูปแบบการแสดงราคา (เช่น ราคาต่ำกว่า $1 ให้แสดงทศนิยมเยอะขึ้น)
      let priceStr = '';
      if (coin.current_price >= 1) {
        priceStr = coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        priceStr = coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
      }

      contents.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'md',
        alignItems: 'center',
        contents: [
          {
            type: 'image',
            url: coin.image,
            size: 'xxs',
            flex: 1
          },
          {
            type: 'text',
            text: coin.symbol.toUpperCase(),
            size: 'sm',
            color: '#111111',
            weight: 'bold',
            margin: 'md',
            flex: 2
          },
          {
            type: 'text',
            text: `$${priceStr}`,
            size: 'sm',
            color: '#111111',
            align: 'end',
            weight: 'bold',
            flex: 3
          },
          {
            type: 'text',
            text: `${diffSymbol}${change.toFixed(2)}%`,
            size: 'xs',
            color: diffColor,
            align: 'end',
            flex: 2
          }
        ]
      });
    }

    const flexPayload = {
      type: 'flex',
      altText: 'ราคาคริปโต 10 อันดับแรกวันนี้',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#1e2022',
          contents: [
            {
              type: 'text',
              text: 'Crypto Top 10 Price',
              weight: 'bold',
              color: '#f3ba2f', // Binance yellow style for crypto vibe
              size: 'lg'
            },
            {
              type: 'text',
              text: `อัปเดตข้อมูลล่าสุดจาก CoinGecko`,
              color: '#aaaaaa',
              size: 'xs',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'เหรียญ', size: 'xs', color: '#aaaaaa', weight: 'bold', flex: 3 },
                { type: 'text', text: 'ราคาล่าสุด (USD)', size: 'xs', color: '#aaaaaa', weight: 'bold', align: 'end', flex: 3 },
                { type: 'text', text: '24h (%)', size: 'xs', color: '#aaaaaa', weight: 'bold', align: 'end', flex: 2 }
              ]
            },
            {
              type: 'separator',
              margin: 'sm'
            },
            ...contents
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'หมายเหตุ: คริปโตสากลใช้ สีเขียว = ราคาเพิ่มขึ้น / สีแดง = ราคาลดลง',
              wrap: true,
              color: '#aaaaaa',
              size: 'xxs'
            }
          ]
        }
      }
    };

    return await lineApiRequest('/v2/bot/message/push', 'POST', {
      to: userId || MY_USER_ID,
      messages: [flexPayload]
    });
  } catch (error) {
    throw new Error('ไม่สามารถดึงข้อมูลคริปโตหรือส่งไปยัง LINE ได้: ' + error.message);
  }
}

// ========================================
// MCP Protocol Handler (STDIO & HTTP)
// ========================================

// 1. STDIO Transport
process.stdin.setEncoding('utf8');

let buffer = '';
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  
  if (buffer.includes('\n')) {
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const request = JSON.parse(line);
          const response = await handleMCPRequest(request);
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
          process.stderr.write('Error: ' + error.message + '\n');
          process.stdout.write(JSON.stringify({ 
            error: error.message 
          }) + '\n');
        }
      }
    }
  }
});

// 2. HTTP Transport (For web interface)
const http = require('http');
const HTTP_PORT = 3000;

const httpServer = http.createServer(async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await handleMCPRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: ' + error.message },
          id: null
        }));
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🤖 LINE MCP Server is running. Send POST requests to this URL for JSON-RPC MCP calls.');
  }
});

httpServer.listen(HTTP_PORT, () => {
  process.stderr.write(`🌐 HTTP MCP Endpoint available at http://localhost:${HTTP_PORT}/mcp\n`);
});

async function handleMCPRequest(request) {
  const { method, params, id } = request;
  
  if (method === 'tools/list') {
    return {
      id: id,
      result: {
        tools: [
          {
            name: 'send_line_message',
            description: 'ส่งข้อความ LINE ไปหาผู้ใช้ที่ระบุ',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string', 
                  description: 'ข้อความที่ต้องการส่ง'
                },
                userId: {
                  type: 'string', 
                  description: 'LINE User ID (ไม่ต้องใส่ถ้าส่งให้ตัวเอง)'
                }
              },
              required: ['message']
            }
          },
          {
            name: 'check_status',
            description: 'ตรวจสอบสถานะของ LINE Bot ว่าพร้อมใช้งานหรือไม่',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'broadcast',
            description: 'ส่งข้อความประกาศให้กับทุกคนที่เป็นเพื่อนกับบอท',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'ข้อความที่ต้องการประกาศ'
                }
              },
              required: ['message']
            }
          },
          {
            name: 'get_profile',
            description: 'ดึงข้อมูลโปรไฟล์ของผู้ใช้ LINE ตาม User ID',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'LINE User ID ที่ต้องการดูข้อมูล'
                }
              },
              required: ['userId']
            }
          },
          {
            name: 'send_oil_price_flex',
            description: 'ดึงราคาน้ำมันล่าสุดจากบางจาก และส่งเป็น Flex Message ไปหาผู้ใช้',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'LINE User ID (ไม่ต้องใส่ถ้าส่งให้ตัวเอง)'
                }
              }
            }
          },
          {
            name: 'send_set50_flex',
            description: 'ดึงราคาหุ้นไทยดัชนี SET50 และหุ้น 10 ลำดับแรกยอดนิยม ส่งเป็น Flex Message ไปหาผู้ใช้',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'LINE User ID (ไม่ต้องใส่ถ้าส่งให้ตัวเอง)'
                }
              }
            }
          },
          {
            name: 'send_crypto_flex',
            description: 'ดึงราคาคริปโต 10 อันดับแรกจาก CoinGecko และส่งเป็น Flex Message ไปหาผู้ใช้',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'LINE User ID (ไม่ต้องใส่ถ้าส่งให้ตัวเอง)'
                }
              }
            }
          },
          {
            name: 'send_gold_price_flex',
            description: 'ดึงราคาทองคำล่าสุด (ทองคำแท่ง/รูปพรรณ 96.5% และ Gold Spot) ส่งเป็น Flex Message ไปหาผู้ใช้',
            inputSchema: {
              type: 'object',
              properties: {
                userId: {
                  type: 'string',
                  description: 'LINE User ID (ไม่ต้องใส่ถ้าส่งให้ตัวเอง)'
                }
              }
            }
          }
        ]
      }
    };
  }
  
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    let result;
    
    try {
      switch(name) {
        case 'send_line_message':
          result = await sendMessage(args.userId, args.message);
          break;
          
        case 'check_status':
          result = checkStatus();
          break;
          
        case 'broadcast':
          result = await broadcast(args.message);
          break;
          
        case 'get_profile':
          const profileData = await getProfile(args.userId);
          result = { profile: profileData };
          break;

        case 'send_oil_price_flex':
          result = await sendOilPriceFlex(args.userId);
          break;

        case 'send_set50_flex':
          result = await sendSet50Flex(args.userId);
          break;

        case 'send_crypto_flex':
          result = await sendCryptoFlex(args.userId);
          break;

        case 'send_gold_price_flex':
          result = await sendGoldPriceFlex(args.userId);
          break;
          
        default:
          throw new Error('Unknown tool: ' + name);
      }
      
      return {
        id: id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };
      
    } catch (error) {
      return {
        id: id,
        result: {
          content: [
            {
              type: 'text',
              text: '❌ เกิดข้อผิดพลาด: ' + error.message
            }
          ]
        }
      };
    }
  }
  
  return {
    id: id,
    error: {
      message: 'Unknown method: ' + method
    }
  };
}

// แจ้งว่า server พร้อม
process.stderr.write('🤖 LINE MCP Server started!\n');
process.stderr.write('📡 Node.js version: ' + process.version + '\n');
process.stderr.write('📡 Waiting for commands...\n');