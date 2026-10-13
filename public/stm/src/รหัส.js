function myFunction() {
  
}

/**
 * Web App entry point: แสดงแบบฟอร์มประเมินความเครียด
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('แบบประเมินและวิเคราะห์ความเครียดด้วยตนเอง')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ====== Database (Google Spreadsheet) ======

var DB_PROPERTY_KEY = 'DB_SPREADSHEET_ID';
var DB_SHEET_NAME = 'ผลการประเมิน';
var DB_HEADERS = [
  'วันที่บันทึก', 'ชื่อ', 'นามสกุล', 'วันที่ประเมิน'
].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(function (n) {
  return 'ข้อ ' + n;
})).concat(['คะแนนรวม', 'ผลการประเมิน']);

/**
 * สร้างฐานข้อมูล (Google Spreadsheet) ครั้งแรก และบันทึก ID ลง Script Properties
 * รันได้หลายครั้ง — ถ้ามีอยู่แล้วจะแค่ตรวจสอบและคืนค่าเดิม
 */
function initDatabase() {
  var db = ensureDatabase_();
  return {
    status: 'success',
    spreadsheetId: db.ss.getId(),
    url: db.ss.getUrl(),
    message: 'ฐานข้อมูลพร้อมใช้งานแล้ว'
  };
}

/**
 * คืนชีตผลการประเมิน (สร้างใหม่เองถ้ายังไม่มี)
 */
function getDbSheet_() {
  return ensureDatabase_().sheet;
}

/**
 * คืน Spreadsheet ที่ผูกกับสคริปต์ (container-bound) หรือ null ถ้าเป็นสคริปต์อิสระ
 * หมายเหตุ: getActiveSpreadsheet() คืนค่าเฉพาะสคริปต์ที่สร้างจาก Extensions > Apps Script
 * ภายใน Google Sheet เท่านั้น สคริปต์ standalone (clasp) จะได้ null
 */
function getActiveSpreadsheetOrNull_() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || null;
  } catch (err) {
    return null;
  }
}

/**
 * เชื่อมต่อกับ Spreadsheet ปัจจุบันที่สคริปต์ผูกอยู่ (แบบ getActiveSpreadsheet)
 * รันจาก Apps Script editor ของสคริปต์ที่ผูกกับ Sheet เท่านั้น
 */
function connectActiveSpreadsheet() {
  var active = getActiveSpreadsheetOrNull_();
  if (!active) {
    return {
      status: 'error',
      message: 'ไม่พบ Spreadsheet ที่ผูกกับสคริปต์ — วิธีนี้ใช้ได้กับสคริปต์ที่เปิดจาก ' +
        'Extensions > Apps Script ภายใน Google Sheet เท่านั้น (สคริปต์ standalone จะได้ null)'
    };
  }
  PropertiesService.getScriptProperties().setProperty(DB_PROPERTY_KEY, active.getId());
  var db = ensureDatabase_();
  return {
    status: 'success',
    spreadsheetId: db.ss.getId(),
    url: db.ss.getUrl(),
    message: 'เชื่อมต่อ Spreadsheet ปัจจุบันเรียบร้อยแล้ว'
  };
}

function ensureDatabase_() {
  var props = PropertiesService.getScriptProperties();

  // 1) ถ้าสคริปต์ผูกกับ Sheet → ใช้ active spreadsheet ทันที (แบบ getActiveSpreadsheet)
  var active = getActiveSpreadsheetOrNull_();
  if (active) {
    var activeSheet = active.getSheetByName(DB_SHEET_NAME) || active.insertSheet(DB_SHEET_NAME);
    ensureHeaders_(activeSheet);
    if (props.getProperty(DB_PROPERTY_KEY) !== active.getId()) {
      props.setProperty(DB_PROPERTY_KEY, active.getId());
    }
    return { ss: active, sheet: activeSheet };
  }

  // 2) ไม่ใช่สคริปต์ผูก Sheet → ใช้ ID เดิมที่เคยบันทึกไว้
  var id = props.getProperty(DB_PROPERTY_KEY);

  if (id) {
    try {
      var existing = SpreadsheetApp.openById(id);
      var existingSheet = existing.getSheetByName(DB_SHEET_NAME) || existing.insertSheet(DB_SHEET_NAME);
      ensureHeaders_(existingSheet);
      return { ss: existing, sheet: existingSheet };
    } catch (err) {
      // ID ใช้ไม่ได้ (ถูกลบ/ไม่มีสิทธิ์) → สร้างใหม่ด้านล่าง
    }
  }

  var ss = SpreadsheetApp.create('ฐานข้อมูลแบบประเมินและวิเคราะห์ความเครียด');
  var sheet = ss.getSheets()[0];
  sheet.setName(DB_SHEET_NAME);
  ensureHeaders_(sheet);
  props.setProperty(DB_PROPERTY_KEY, ss.getId());
  return { ss: ss, sheet: sheet };
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DB_HEADERS.length)
      .setValues([DB_HEADERS])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

// ====== บันทึกผลการประเมิน (เรียกจาก index.html ผ่าน google.script.run) ======

/**
 * รับข้อมูลจากแบบฟอร์มแล้วบันทึกลง Spreadsheet
 * คืนค่า { status, name, score, result } ตามที่ index.html คาดหวัง
 */
function saveFormResponse(formData) {
  try {
    if (!formData) {
      return { status: 'error', message: 'ไม่ได้รับข้อมูลจากแบบฟอร์ม' };
    }

    var firstName = String(formData.firstName || '').trim();
    var lastName = String(formData.lastName || '').trim();
    if (!firstName || !lastName) {
      return { status: 'error', message: 'กรุณากรอกชื่อและนามสกุล' };
    }

    var score = computeScore_(formData);
    var result = getAssessmentLevel_(score);
    var sheet = getDbSheet_();

    var row = [
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      firstName,
      lastName,
      String(formData.assessmentDate || '')
    ];
    for (var i = 1; i <= 20; i++) {
      var v = Number(formData['q' + i]);
      row.push(isNaN(v) ? 0 : v);
    }
    row.push(score, result);

    sheet.appendRow(row);

    return {
      status: 'success',
      name: firstName + ' ' + lastName,
      score: score,
      result: result
    };
  } catch (err) {
    return { status: 'error', message: 'บันทึกข้อมูลไม่สำเร็จ: ' + err.message };
  }
}

/** รวมคะแนน q1..q20 (fallback ไปที่ totalScore ถ้าไม่มีคำตอบรายข้อ) */
function computeScore_(formData) {
  var total = 0;
  var hasAnswers = false;
  for (var i = 1; i <= 20; i++) {
    var key = 'q' + i;
    if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '') {
      hasAnswers = true;
      var v = Number(formData[key]);
      if (!isNaN(v)) total += v;
    }
  }
  if (!hasAnswers) {
    var fallback = Number(formData.totalScore);
    return isNaN(fallback) ? 0 : fallback;
  }
  return total;
}

/** เกณฑ์แปลผลเดียวกับ getAssessmentLevel() ใน index.html */
function getAssessmentLevel_(score) {
  if (score <= 5) return 'ตอบไม่ตรงความจริง';
  if (score <= 17) return 'ปกติ';
  if (score <= 25) return 'เครียดสูงกว่าปกติเล็กน้อย';
  if (score <= 29) return 'เครียดปานกลาง';
  return 'เครียดมาก';
}
