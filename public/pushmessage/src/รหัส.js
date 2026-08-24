/**
 * ============================================================
 *  ลงทะเบียนสมาชิก + ยืนยันตัวตนผ่านแชท (Reply API)
 *  + ผูกบัญชี LINE อย่างเป็นทางการ (Account Link: linkToken + nonce)
 * ============================================================
 *
 * ตั้งค่า: แก้ค่าคงที่ด้านล่าง (SHEET_ID / OA_BASIC_ID / CHANNEL_ACCESS_TOKEN)
 * ไม่ต้องไปตั้ง Script Properties ใน Editor แล้ว
 *
 * 1) Google Sheet ชื่อ "Registrations" หัวคอลัมน์แถวแรกต้องมี 8 คอลัมน์:
 *      token | phone | birthday | createdAt | status | lineUserId | nonce | nonceIssuedAt
 *
 *    ถ้าเดิมมีแค่ 6 คอลัมน์ (token..lineUserId) ให้เพิ่มคอลัมน์ G และ H
 *    เป็น "nonce" กับ "nonceIssuedAt" ต่อท้ายได้เลย
 *
 * 2) สถานะ (status) ของสมาชิกจะไล่ตามลำดับนี้:
 *      pending   -> ลงทะเบียนแล้ว ยังไม่เคยแชทกับ OA
 *      confirmed -> แชทกับ OA แล้ว รู้จัก lineUserId แล้ว (ยังไม่ใช่ Account Link จริง)
 *      linked    -> ผูกบัญชีแบบเป็นทางการผ่านหน้าจอ accountLink ของ LINE สำเร็จแล้ว
 *
 * 3) Deploy เป็น Web App (Execute as: Me, Who has access: Anyone)
 *    - ไม่มี doGet แล้ว: หน้าเว็บไม่ได้ serve จาก GAS (โฮสต์ฟอร์มที่อื่น)
 *    - URL เดียวกันใช้เป็น Webhook ของ LINE + API (POST เท่านั้น)
 *      ฟอร์มภายนอกส่ง POST { action: 'register' | 'requestLink', ... } มา endpoint นี้
 */

// ===================== ตั้งค่า =====================
// 👇 เปลี่ยนเป็นค่าจริงของคุณ          // ID ของ Google Sheet ที่มีชีต "Registrations"
const OA_BASIC_ID = '@042shrup';          // Basic ID ของ LINE OA เช่น @cmfrozen
const CHANNEL_ACCESS_TOKEN = 'oVCQJNRQYKH6Dfe75lmrygNDkVVnaqDoUyu4crkUPfMpc88Vhm59VXbOEz5lQmO2y4rYvYf326/Gno9djAJlYDAydHocMRpsfs/9lka8PZQyPJCdJi3ohXU3qYxIHD5tJdaAPh1FxkyrcXCoaE0ptwdB04t89/1O/w1cDnyilFU='; // Channel access token ของ LINE OA
// ===================================================

const SHEET_NAME = 'Registrations';

// คอลัมน์ในชีต (1-indexed)
const COL = {
  TOKEN: 1,
  PHONE: 2,
  BIRTHDAY: 3,
  CREATED_AT: 4,
  STATUS: 5,
  LINE_USER_ID: 6,
  NONCE: 7,
  NONCE_ISSUED_AT: 8
};

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

/**
 * doPost รับได้ 3 แบบ:
 *   1) LINE webhook (body JSON มี field "events")
 *   2) ฟอร์มลงทะเบียนจากภายนอก (JSON หรือ FormData, action=register)
 *   3) ขอผูกบัญชี LINE อย่างเป็นทางการ (action=requestLink)
 *
 * รองรับทั้ง body แบบ JSON (fetch + JSON.stringify, webhook ของ LINE)
 * และแบบ FormData/multipart (form.submit / fetch + FormData จากเว็บภายนอก
 * เพราะ GAS ไม่คืน CORS header การ POST แบบ simple request จะไม่โดน preflight)
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    // ฟอร์มภายนอกส่งแบบ FormData (multipart) -> อ่านจาก e.parameter
    body = {
      action: e.parameter.action,
      phone: e.parameter.phone,
      birthday: e.parameter.birthday,
      token: e.parameter.token
    };
  }

  if (body.events) {
    return handleLineWebhook_(body);
  }
  if (body.action === 'register') {
    return handleExternalRegistration_(body);
  }
  if (body.action === 'requestLink') {
    return handleRequestLink_(body);
  }

  return jsonOutput_({ status: 'ignored' });
}

/* ---------------------------------------------------------- *
 *  1) ลงทะเบียนจากฟอร์มภายนอก
 * ---------------------------------------------------------- */
function handleExternalRegistration_(body) {
  const phone = body.phone;
  const birthday = body.birthday;

  const sheet = getSheet_();
  const token = Utilities.getUuid().slice(0, 8);
  // token, phone, birthday, createdAt, status, lineUserId, nonce, nonceIssuedAt
  sheet.appendRow([token, phone, birthday, new Date(), 'pending', '', '', '']);

  const rawMessage = 'ยืนยันสมาชิก ' + token;
  const oaLink = 'https://line.me/R/oaMessage/' + OA_BASIC_ID + '/?' + encodeURIComponent(rawMessage);

  return jsonOutput_({ status: 'ok', token: token, oaLink: oaLink, message: rawMessage });
}

/* ---------------------------------------------------------- *
 *  2) ขอผูกบัญชี LINE อย่างเป็นทางการ (ปุ่ม "ยืนยันผูกบัญชีสมาชิก LINE")
 * ---------------------------------------------------------- */
function handleRequestLink_(body) {
  const regToken = body.token;
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[COL.TOKEN - 1] !== regToken) continue;

    const rowNumber = i + 1;
    const status = row[COL.STATUS - 1];
    const lineUserId = row[COL.LINE_USER_ID - 1];

    // ยังไม่เคยแชทกับ OA มาก่อน -> ยังไม่รู้จัก userId ผูกบัญชีจริงไม่ได้
    // ต้องพาไปแชทให้ webhook รู้จัก userId ก่อน (สเต็ปเดิม)
    if (!lineUserId || status === 'pending') {
      const rawMessage = 'ยืนยันสมาชิก ' + regToken;
      const oaLink = 'https://line.me/R/oaMessage/' + OA_BASIC_ID + '/?' + encodeURIComponent(rawMessage);
      return jsonOutput_({ status: 'needChat', oaLink: oaLink, message: rawMessage });
    }

    // มี userId แล้ว -> ขอ linkToken จริงจาก LINE + สร้าง nonce ของเราเอง
    const linkToken = issueLinkToken_(lineUserId);
    if (!linkToken) {
      return jsonOutput_({ status: 'error', error: 'ออก linkToken ไม่สำเร็จ กรุณาลองใหม่อีกครั้งครับ' });
    }

    const nonce = Utilities.getUuid();
    sheet.getRange(rowNumber, COL.NONCE).setValue(nonce);
    sheet.getRange(rowNumber, COL.NONCE_ISSUED_AT).setValue(new Date());

    const accountLinkUrl =
      'https://access.line.me/dialog/bot/accountLink?linkToken=' + encodeURIComponent(linkToken) +
      '&nonce=' + encodeURIComponent(nonce);

    return jsonOutput_({ status: 'ok', accountLinkUrl: accountLinkUrl });
  }

  return jsonOutput_({ status: 'notfound' });
}

/**
 * ขอ linkToken จาก LINE Messaging API (ใช้ได้ครั้งเดียว หมดอายุใน 10 นาที)
 * ต้องมี userId ของคนที่เคยคุยกับ OA มาก่อนแล้วเท่านั้น
 */
function issueLinkToken_(userId) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/user/' + userId + '/linkToken', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    console.error('issueLinkToken_ failed: ' + res.getContentText());
    return null;
  }

  return JSON.parse(res.getContentText()).linkToken;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------- *
 *  3) Webhook จาก LINE
 * ---------------------------------------------------------- */
function handleLineWebhook_(body) {
  try {
    const events = body.events || [];

    events.forEach(function (event) {
      // เคสที่ 1: ผู้ใช้ยืนยันการผูกบัญชีจากหน้าจอ accountLink ของ LINE
      if (event.type === 'accountLink') {
        handleAccountLink_(event);
        return;
      }

      // เคสที่ 2: ข้อความ "ยืนยันสมาชิก TOKEN" (สเต็ปแรกที่ทำให้รู้จัก userId)
      if (event.type !== 'message' || event.message.type !== 'text') return;

      const replyToken = event.replyToken;
      const text = event.message.text.trim();
      const lineUserId = event.source.userId;

      const match = text.match(/ยืนยันสมาชิก\s+([A-Za-z0-9]+)/);
      if (!match) return;

      const token = match[1];
      const record = findPendingByToken_(token);
      if (!record) {
        replyMessage_(replyToken, [textMessage_('ไม่พบข้อมูลการลงทะเบียน กรุณาลงทะเบียนใหม่อีกครั้งครับ')]);
        return;
      }

      markConfirmed_(record.row, lineUserId);

      const flex = buildMemberCardFlex_(record.phone, record.birthday);
      replyMessage_(replyToken, [flex]);
    });

    return jsonOutput_({ status: 'ok' });
  } catch (err) {
    console.error(err);
    return jsonOutput_({ status: 'error' });
  }
}

/**
 * ประมวลผล event ชนิด accountLink ที่ LINE ส่งกลับมาหลังผู้ใช้กดยืนยัน/ปฏิเสธ
 * ในหน้าจอ https://access.line.me/dialog/bot/accountLink
 */
function handleAccountLink_(event) {
  const link = event.link || {};
  const nonce = link.nonce;
  const result = link.result; // 'ok' หรือ 'failed'
  if (!nonce) return;

  const record = findRowByNonce_(nonce);
  if (!record) {
    // nonce ไม่ตรงกับที่เราออกไว้ หรือหมดอายุ/ถูกใช้ไปแล้ว
    return;
  }

  if (result === 'ok') {
    markLinked_(record.row);
    const flex = buildLinkedFlex_(record.phone);
    replyMessage_(event.replyToken, [flex]);
  } else {
    replyMessage_(event.replyToken, [textMessage_('การผูกบัญชีไม่สำเร็จ กรุณาลองกดปุ่ม "ยืนยันผูกบัญชีสมาชิก LINE" อีกครั้งครับ')]);
  }
}

function findPendingByToken_(token) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[COL.TOKEN - 1] === token && row[COL.STATUS - 1] === 'pending') {
      return { row: i + 1, token: row[COL.TOKEN - 1], phone: row[COL.PHONE - 1], birthday: row[COL.BIRTHDAY - 1] };
    }
  }
  return null;
}

function findRowByNonce_(nonce) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[COL.NONCE - 1] === nonce) {
      return { row: i + 1, phone: row[COL.PHONE - 1], birthday: row[COL.BIRTHDAY - 1] };
    }
  }
  return null;
}

function markConfirmed_(rowNumber, lineUserId) {
  const sheet = getSheet_();
  sheet.getRange(rowNumber, COL.STATUS).setValue('confirmed');
  sheet.getRange(rowNumber, COL.LINE_USER_ID).setValue(lineUserId);
}

function markLinked_(rowNumber) {
  const sheet = getSheet_();
  sheet.getRange(rowNumber, COL.STATUS).setValue('linked');
  sheet.getRange(rowNumber, COL.NONCE).setValue(''); // nonce ใช้ครั้งเดียว เคลียร์ทิ้ง
}

/**
 * ส่งข้อความกลับด้วย Reply API (ฟรี ไม่จำกัดโควต้า)
 */
function replyMessage_(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    }),
    muteHttpExceptions: true
  });
}

function textMessage_(text) {
  return { type: 'text', text: text };
}

function buildMemberCardFlex_(phone, birthday) {
  return {
    type: 'flex',
    altText: 'สมัครสมาชิกสำเร็จ',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '🎉 สมัครสมาชิกสำเร็จ', weight: 'bold', size: 'lg', color: '#1DB446' },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'md',
            contents: [
              rowKV_('เบอร์โทร', phone),
              rowKV_('วันเกิด', birthday),
              rowKV_('ระดับ', 'Bronze Tier')
            ]
          }
        ]
      }
    }
  };
}

function buildLinkedFlex_(phone) {
  return {
    type: 'flex',
    altText: 'ผูกบัญชีสำเร็จ',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '✅ ผูกบัญชีสมาชิกสำเร็จ', weight: 'bold', size: 'lg', color: '#06C755' },
          { type: 'separator' },
          {
            type: 'text',
            text: 'บัญชี LINE ของคุณถูกผูกกับหมายเลขสมาชิก ' + phone + ' เรียบร้อยแล้ว',
            size: 'sm',
            color: '#111111',
            wrap: true,
            margin: 'md'
          }
        ]
      }
    }
  };
}

function rowKV_(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#999999', flex: 2 },
      { type: 'text', text: String(value), size: 'sm', color: '#111111', flex: 4, wrap: true }
    ]
  };
}