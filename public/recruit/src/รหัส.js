// ============================================================
// Recruitment Tracker by Department + Position (พร้อมใช้งาน)
// สร้างจากโครงสร้างเดิม และเพิ่ม "ตำแหน่งงาน" + "จำนวนที่ขาด"
// ============================================================

const RECORD_SHEET = 'RecruitmentRecords'; // เก็บเป้าหมาย/ใบคำขอ (รวมข้อมูลเก่าเดิม)
const HIRE_SHEET = 'RecruitmentHires';       // เก็บรายการรับแล้วแยกจากเป้าหมาย
const MASTER_SHEET = 'MasterPositions';
const USER_SHEET = 'User';                   // เก็บ Username/Password สำหรับ Login
const SESSION_PROP_KEY = 'USER_SESSIONS';     // เก็บโทเค็นเซสชัน login (จำหน้าเว็บไว้จนกว่าจะ logout)
const SESSION_MAX_PER_USER = 5;               // เก็บได้สูงสุด 5 เครื่องต่อ 1 ผู้ใช้
const DATA_VERSION_KEY = 'RECRUITMENT_DATA_VERSION';

const HIRE_HEADERS = [
  'ID', 'Request ID', 'แผนก', 'ตำแหน่งงาน',
  'รับแล้วรวม', 'รับแล้วชาย', 'รับแล้วหญิง',
  'กำหนดเข้างาน', 'เข้างานจริง', 'วันที่ได้รับคำขอ',
  'ระยะเวลาสรรหา (วัน)', 'หมายเหตุ', 'สร้างเมื่อ', 'แก้ไขล่าสุด'
];

const RECORD_HEADERS = [
  'ID', 'แผนก', 'ตำแหน่งงาน',
  'เป้าหมายรวม', 'เป้าหมายชาย', 'เป้าหมายหญิง',
  'รับแล้วรวม', 'รับแล้วชาย', 'รับแล้วหญิง',
  'วันที่บันทึก', 'หมายเหตุ',
  'วันที่เขียนคำขอ', 'วันที่ได้รับคำขอ', 'ระยะเวลาสรรหา (วัน)',
  'กำหนดเข้างาน', 'เข้างานจริง', 'หมายเหตุใบคำขอ',
  'สร้างเมื่อ', 'แก้ไขล่าสุด'
];



function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('สรุปการรับพนักงานตามตำแหน่ง')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// LOGIN — ตรวจสอบ username/password จาก Sheet "User"
// คอลัมน์ A2:A = Username, B2:B = Password
// ============================================================
function validateLogin(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USER_SHEET);
    if (!sheet) return { success: false, message: 'ไม่พบ Sheet User กรุณาสร้าง Sheet ชื่อ "User" ใน Google Sheet' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'ไม่มีข้อมูลผู้ใช้ในระบบ' };

    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const u = String(username || '').trim();
    const p = String(password || '').trim();

    if (!u || !p) return { success: false, message: 'กรุณากรอก Username และ Password' };

    for (let i = 0; i < values.length; i++) {
      const sheetUser = String(values[i][0] || '').trim();
      const sheetPass = String(values[i][1] || '').trim();
      if (sheetUser === u && sheetPass === p) {
        // ออกโทเค็นเซสชันให้หน้าเว็บจำการเข้าสู่ระบบไว้จนกว่าจะ logout
        const token = createSession_(u);
        return { success: true, username: u, token: token };
      }
    }
    return { success: false, message: 'Username หรือ Password ไม่ถูกต้อง' };
  } catch (error) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

// ============================================================
// LOGIN SESSION — จำการเข้าสู่ระบบไว้ ตราบใดที่ยังไม่ logout
// เก็บโทเค็นใน DocumentProperties ฝั่งเซิร์ฟเวอร์ (หน้าเว็บเก็บสำเนาไว้ใน localStorage)
// ============================================================
function readSessions_() {
  try {
    const raw = PropertiesService.getDocumentProperties().getProperty(SESSION_PROP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeSessions_(sessions) {
  PropertiesService.getDocumentProperties().setProperty(SESSION_PROP_KEY, JSON.stringify(sessions));
}

// ล็อกการแก้ไขเซสชันพร้อมกันจากหลายเครื่อง (อ่าน-แก้ไข-เขียนทั้งก้อน)
function withSessionLock_(fn) {
  let lock = null;
  let locked = false;
  try {
    lock = LockService.getDocumentLock();
    if (lock) locked = lock.tryLock(3000);
  } catch (error) {
    locked = false;
  }
  try {
    return fn();
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (error) {}
    }
  }
}

function createSession_(username) {
  const token = Utilities.getUuid();
  const user = normalizeText_(username);
  withSessionLock_(function() {
    const sessions = readSessions_();
    const list = Array.isArray(sessions[user]) ? sessions[user] : [];
    list.push({ token: token, created_at: new Date().toISOString() });
    while (list.length > SESSION_MAX_PER_USER) list.shift();
    sessions[user] = list;
    writeSessions_(sessions);
  });
  return token;
}

// หน้าเว็บเรียกตอนเปิดหน้า เพื่อเข้าใช้งานต่อโดยไม่ต้องกรอก password ใหม่
function restoreSession(username, token) {
  try {
    const user = normalizeText_(username);
    const tk = normalizeText_(token);
    if (!user || !tk) return { success: false, message: 'ไม่พบข้อมูลเซสชัน' };

    const sessions = readSessions_();
    const list = Array.isArray(sessions[user]) ? sessions[user] : [];
    const found = list.some(function(s) { return s && String(s.token) === tk; });
    if (!found) return { success: false, message: 'เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่' };

    // ยังมี username นี้ใน Sheet User อยู่หรือไม่
    if (!userExists_(user)) return { success: false, message: 'ไม่พบผู้ใช้นี้ในระบบ' };
    return { success: true, username: user };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// เรียกตอนกด "ออกจากระบบ" — เครื่องอื่นที่ยัง login อยู่จะถูกเด้งออกเมื่อเปิดหน้าใหม่
function clearSession(username, token) {
  try {
    const user = normalizeText_(username);
    const tk = normalizeText_(token);
    if (!user || !tk) return { success: true };
    withSessionLock_(function() {
      const sessions = readSessions_();
      const list = Array.isArray(sessions[user]) ? sessions[user] : [];
      const remain = list.filter(function(s) { return !(s && String(s.token) === tk); });
      if (remain.length) sessions[user] = remain;
      else delete sessions[user];
      writeSessions_(sessions);
    });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function userExists_(username) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USER_SHEET);
    if (!sheet) return false;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    const target = normalizeText_(username);
    for (let i = 0; i < values.length; i++) {
      if (normalizeText_(values[i][0]) === target) return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}


function toNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function hasOwn_(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function textOr_(obj, key, currentValue) {
  return hasOwn_(obj, key) ? (obj[key] == null ? '' : String(obj[key])) : currentValue;
}

function numberOr_(obj, key, currentValue) {
  return hasOwn_(obj, key) ? toNumber(obj[key]) : toNumber(currentValue);
}

function normalizeText_(value) {
  return String(value || '').trim();
}


// ============================================================
// DATE HELPERS — จัดเก็บเป็น Date ใน Sheet และแสดง dd/MM/yyyy
// ============================================================
function parseDateValue_(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  if (!text) return null;
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (m) return makeValidDate_(Number(m[1]), Number(m[2]), Number(m[3]));

  m = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return makeValidDate_(Number(m[3]), Number(m[2]), Number(m[1]));

  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function makeValidDate_(year, month, day) {
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function dateForSheet_(value) {
  return parseDateValue_(value) || '';
}

function formatDateForClient_(value) {
  const d = parseDateValue_(value);
  if (!d) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
}

function normalizeRecordDateColumns_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  [10, 12, 13, 15, 16].forEach(function(col) {
    const range = sheet.getRange(2, col, lastRow - 1, 1);
    const values = range.getValues();
    let changed = false;
    values.forEach(function(row) {
      if (row[0] === '' || row[0] == null) return;
      const d = parseDateValue_(row[0]);
      if (d && Object.prototype.toString.call(row[0]) !== '[object Date]') {
        row[0] = d;
        changed = true;
      }
    });
    if (changed) range.setValues(values);
    range.setNumberFormat('dd/MM/yyyy');
  });
}

function makeKey_(dept, position) {
  return normalizeText_(dept).toLowerCase() + '||' + normalizeText_(position).toLowerCase();
}

function getDeptCode_(dept) {
  // ดึง code จาก Sheet MasterPositions (เช็คซ้ำ ใช้แค่ 1 ชื่อต่อแผนก)
  const text = normalizeText_(dept);
  if (!text) return '';
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(MASTER_SHEET);
    if (sheet && sheet.getLastRow() > 1) {
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
      for (var i = 0; i < rows.length; i++) {
        if (normalizeText_(rows[i][1]) === text && normalizeText_(rows[i][0])) {
          return normalizeText_(rows[i][0]);
        }
      }
    }
  } catch (e) {
    // fallback ถ้าดึง sheet ไม่ได้
  }
  // fallback: parse จากชื่อแผนก
  if (text.indexOf('R & D') === 0) return 'R&D';
  return text.split('-')[0].trim();
}

// ============================================================
// SETUP / MIGRATION
// ============================================================

function setupDatabase() {
  try {
    const recordSheet = ensureRecordSheet_();
    normalizeRecordDateColumns_(recordSheet);
    recalculateRecruitmentDays_(recordSheet); // รองรับข้อมูลเก่าแบบรวมในแถวเดียว
    const hireSheet = ensureHireSheet_();
    recalculateHireDays_(hireSheet);
    const masterSheet = initMasterSheet_(null, true); // full init: style + migrate RE→RM
    touchDataVersion_();
    return {
      success: true,
      message: 'พร้อมใช้งานแล้ว: แยกคีย์เป้าหมาย/ใบคำขอ และรับแล้ว/วันเข้างานเรียบร้อย',
      requestRows: Math.max(recordSheet.getLastRow() - 1, 0),
      hireRows: Math.max(hireSheet.getLastRow() - 1, 0),
      positionCount: Math.max(masterSheet.getLastRow() - 1, 0)
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function ensureRecordSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RECORD_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(RECORD_SHEET);
    sheet.getRange(1, 1, 1, RECORD_HEADERS.length).setValues([RECORD_HEADERS]);
  } else {
    // รองรับข้อมูลเก่า 18 คอลัมน์: ถ้ายังไม่มี "ตำแหน่งงาน" ให้แทรกคอลัมน์ C
    const lastCol = sheet.getLastColumn();
    let headers = [];
    if (lastCol > 0) {
      headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    }
    if (headers.indexOf('ตำแหน่งงาน') === -1) {
      if (lastCol >= 2) {
        sheet.insertColumnAfter(2);
      }
    }
    // ตั้งหัวตารางใหม่โดยไม่ลบข้อมูลเดิม
    sheet.getRange(1, 1, 1, RECORD_HEADERS.length).setValues([RECORD_HEADERS]);
  }

  // แก้ข้อมูลเดิมของ Receiving จาก RE เป็น RM อัตโนมัติ
  const recordLastRow = sheet.getLastRow();
  if (recordLastRow > 1) {
    const deptRange = sheet.getRange(2, 2, recordLastRow - 1, 1);
    const deptValues = deptRange.getValues();
    let changed = false;
    deptValues.forEach(function(row) {
      if (normalizeText_(row[0]) === 'RE-RECEIVING DEPT.') {
        row[0] = 'RM-RECEIVING DEPT.';
        changed = true;
      }
    });
    if (changed) deptRange.setValues(deptValues);
  }

  styleRecordSheet_(sheet);
  return sheet;
}

function styleRecordSheet_(sheet) {
  sheet.getRange(1, 1, 1, RECORD_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  const widths = [150, 210, 300, 95, 95, 95, 95, 95, 95, 110, 180, 110, 110, 145, 110, 110, 220, 155, 155];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // วันที่ทั้งหมดใน Google Sheet แสดงเป็น dd/MM/yyyy
  [10, 12, 13, 15, 16].forEach(function(col) {
    sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('dd/MM/yyyy');
  });
  // คอลัมน์ระยะเวลาสรรหาแสดงเป็นจำนวนวัน
  sheet.getRange(2, 14, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('0 "วัน"');
}


function ensureHireSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(HIRE_SHEET);
  if (!sheet) sheet = ss.insertSheet(HIRE_SHEET);

  sheet.getRange(1, 1, 1, HIRE_HEADERS.length).setValues([HIRE_HEADERS]);
  sheet.getRange(1, 1, 1, HIRE_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#2E7D32')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  const widths = [150,150,210,300,95,95,95,110,110,110,145,220,155,155];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
  [8,9,10].forEach(function(col) {
    sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('dd/MM/yyyy');
  });
  sheet.getRange(2, 11, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('0 "วัน"');
  return sheet;
}

function rowToHire_(row) {
  return {
    id: String(row[0] || ''),
    request_id: String(row[1] || ''),
    dept: row[2] || '',
    position: row[3] || '',
    hired: toNumber(row[4]),
    hired_male: toNumber(row[5]),
    hired_female: toNumber(row[6]),
    scheduled_start: formatDateForClient_(row[7]),
    actual_start: formatDateForClient_(row[8]),
    received_request_date: formatDateForClient_(row[9]),
    days_to_hire: calculateRecruitmentDaysSafe_(row[9], row[8]),
    note: row[11] || '',
    created_at: row[12] instanceof Date ? row[12].toISOString() : String(row[12] || ''),
    updated_at: row[13] instanceof Date ? row[13].toISOString() : String(row[13] || '')
  };
}

function getHireData() {
  try {
    const sheet = ensureHireSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    return sheet.getRange(2, 1, lastRow - 1, HIRE_HEADERS.length).getValues()
      .filter(function(row) { return normalizeText_(row[0]); })
      .map(rowToHire_);
  } catch (error) {
    console.error('Get hire data error:', error);
    return [];
  }
}

// ============================================================
// ดึงข้อมูลเดิมจากชีตโดยตรง 1 รายการ (สำหรับส่วนแก้ไข)
// ============================================================
function getTargetRecordById(id) {
  try {
    const target = normalizeText_(id);
    if (!target) return null;
    const sheet = ensureRecordSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    const values = sheet.getRange(2, 1, lastRow - 1, RECORD_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      if (normalizeText_(values[i][0]) === target) return rowToRecord_(values[i]);
    }
    return null;
  } catch (error) {
    console.error('Get target record error:', error);
    return null;
  }
}

function getHireRecordById(id) {
  try {
    const target = normalizeText_(id);
    if (!target) return null;
    const sheet = ensureHireSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    const values = sheet.getRange(2, 1, lastRow - 1, HIRE_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      if (normalizeText_(values[i][0]) === target) return rowToHire_(values[i]);
    }
    return null;
  } catch (error) {
    console.error('Get hire record error:', error);
    return null;
  }
}

function recalculateHireDays_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const rows = sheet.getRange(2, 1, lastRow - 1, HIRE_HEADERS.length).getValues();
  const values = rows.map(function(row) {
    try { return [calculateRecruitmentDays_(row[9], row[8])]; }
    catch (e) { return ['']; }
  });
  sheet.getRange(2, 11, values.length, 1).setValues(values).setNumberFormat('0 "วัน"');
}

function ensureMasterSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MASTER_SHEET);

  // ถ้า sheet ยังไม่มี → สร้างใหม่พร้อม init เต็ม
  if (!sheet) {
    sheet = ss.insertSheet(MASTER_SHEET);
    return initMasterSheet_(sheet, true);
  }

  // sheet มีอยู่แล้ว → คืนค่าทันที ไม่ set style/header ซ้ำ
  return sheet;
}

// initMasterSheet_: เรียกเฉพาะ setupDatabase() หรือสร้าง sheet ใหม่ครั้งแรก
// forceDefaultSync=true จะ migrate RE→RM เท่านั้น (ข้อมูลตำแหน่งดึงจาก Sheet โดยตรง)
function initMasterSheet_(sheet, forceDefaultSync) {
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheetByName(MASTER_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(MASTER_SHEET);
      forceDefaultSync = true;
    }
  }

  // ตั้ง header + style (เฉพาะตอน init)
  const headerRow = sheet.getLastRow() < 1 ? 0 : sheet.getRange(1, 1, 1, 3).getDisplayValues()[0];
  const needsHeader = Array.isArray(headerRow) ? normalizeText_(headerRow[0]) !== 'รหัสแผนก' : true;
  if (needsHeader || sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 3).setValues([['รหัสแผนก', 'แผนก', 'ตำแหน่งงาน']]);
    sheet.getRange(1, 1, 1, 3)
      .setFontWeight('bold')
      .setBackground('#1F4E78')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 260);
    sheet.setColumnWidth(3, 360);
  }

  if (!forceDefaultSync) return sheet;

  // แก้ MasterPositions เดิม: RE-RECEIVING DEPT. -> RM-RECEIVING DEPT.
  const masterLastRow = sheet.getLastRow();
  if (masterLastRow > 1) {
    const masterRange = sheet.getRange(2, 1, masterLastRow - 1, 3);
    const masterValues = masterRange.getValues();
    let masterChanged = false;
    masterValues.forEach(function(row) {
      if (normalizeText_(row[1]) === 'RE-RECEIVING DEPT.') {
        row[0] = 'RM';
        row[1] = 'RM-RECEIVING DEPT.';
        masterChanged = true;
      } else if (normalizeText_(row[0]) === 'RE' && normalizeText_(row[1]) === 'RM-RECEIVING DEPT.') {
        row[0] = 'RM';
        masterChanged = true;
      }
    });
    if (masterChanged) masterRange.setValues(masterValues);
  }

  return sheet;
}


// ============================================================
// MASTER POSITION FUNCTIONS
// ============================================================

function getMasterPositions() {
  try {
    const sheet = ensureMasterSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    return sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues()
      .filter(function(row) { return normalizeText_(row[1]) && normalizeText_(row[2]); })
      .map(function(row) {
        return { code: row[0], dept: row[1], position: row[2] };
      });
  } catch (error) {
    console.error(error);
    return [];
  }
}

function getDepartments() {
  const master = getMasterPositions();
  const map = {};
  master.forEach(function(x) {
    if (!map[x.dept]) map[x.dept] = { code: x.code, dept: x.dept };
  });
  return Object.keys(map).map(function(k) { return map[k]; })
    .sort(function(a, b) { return a.code.localeCompare(b.code); });
}

function getPositionsByDepartment(dept) {
  return getMasterPositions()
    .filter(function(x) { return x.dept === dept; })
    .map(function(x) { return x.position; })
    .sort(function(a, b) { return a.localeCompare(b); });
}

function addPosition(dept, position) {
  try {
    dept = normalizeText_(dept);
    position = normalizeText_(position);
    if (!dept) throw new Error('กรุณาเลือกแผนก');
    if (!position) throw new Error('กรุณาระบุตำแหน่งงาน');

    const sheet = ensureMasterSheet_();
    const master = getMasterPositions();
    const duplicate = master.some(function(x) {
      return makeKey_(x.dept, x.position) === makeKey_(dept, position);
    });
    if (duplicate) {
      return { success: true, message: 'มีตำแหน่งนี้อยู่แล้ว', position: position };
    }

    sheet.appendRow([getDeptCode_(dept), dept, position]);
    touchDataVersion_();
    return { success: true, message: 'เพิ่มตำแหน่งงานเรียบร้อย', position: position };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================================
// RECORD CRUD
// ============================================================

function getData() {
  try {
    const sheet = ensureRecordSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, RECORD_HEADERS.length).getValues();
    return data
      .filter(function(row) { return normalizeText_(row[0]); })
      .map(rowToRecord_);
  } catch (error) {
    console.error('Get data error:', error);
    return [];
  }
}

function rowToRecord_(row) {
  const target = toNumber(row[3]);
  const hired = toNumber(row[6]);
  const vacancy = Math.max(target - hired, 0);
  return {
    id: String(row[0] || ''),
    dept: row[1] || '',
    position: row[2] || '',
    target: target,
    target_male: toNumber(row[4]),
    target_female: toNumber(row[5]),
    hired: hired,
    hired_male: toNumber(row[7]),
    hired_female: toNumber(row[8]),
    vacancy: vacancy,
    status: target <= 0 ? 'ยังไม่กำหนด' : (vacancy > 0 ? 'ขาด ' + vacancy + ' คน' : 'ครบ'),
    date: formatDateForClient_(row[9]),
    note: row[10] || '',
    request_date: formatDateForClient_(row[11]),
    hire_date: formatDateForClient_(row[12]),
    days_to_hire: calculateRecruitmentDaysSafe_(row[12], row[15]),
    scheduled_start: formatDateForClient_(row[14]),
    actual_start: formatDateForClient_(row[15]),
    request_note: row[16] || '',
    created_at: row[17] instanceof Date ? row[17].toISOString() : String(row[17] || ''),
    updated_at: row[18] instanceof Date ? row[18].toISOString() : String(row[18] || '')
  };
}


// ============================================================
// แยกฟังก์ชันคีย์ 2 ส่วน
// 1) เป้าหมาย + วันที่เขียนคำขอ + วันที่ได้รับคำขอ
// 2) รับแล้ว + กำหนดเข้างาน + เข้างานจริง (อ้างอิง Request ID)
// ============================================================
function saveTargetData(record) {
  try {
    const sheet = ensureRecordSheet_();
    const dept = normalizeText_(record.dept);
    const position = normalizeText_(record.position);
    if (!dept) throw new Error('กรุณาเลือกแผนก');
    if (!position) throw new Error('กรุณาเลือก/ระบุตำแหน่งงาน');

    const targetMale = toNumber(record.target_male);
    const targetFemale = toNumber(record.target_female);
    let target = targetMale + targetFemale;
    if (record.target_unspecified) {
      target = toNumber(record.target_total);
    }
    if (target <= 0) throw new Error('กรุณากรอกเป้าหมายอย่างน้อย 1 คน');

    const requestId = 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const now = new Date().toISOString();
    const dateNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');

    const rowData = [
      requestId, dept, position,
      target, targetMale, targetFemale,
      0, 0, 0, // รับแล้วแยกไป RecruitmentHires
      dateForSheet_(record.date || dateNow),
      record.note || '',
      dateForSheet_(record.request_date),
      dateForSheet_(record.hire_date),
      '', // ระยะเวลาจะเกิดเมื่อมีรายการรับแล้ว
      '', '', // กำหนดเข้างาน / เข้างานจริง แยกไป RecruitmentHires
      record.request_note || '',
      now, now
    ];

    sheet.appendRow(rowData);
    touchDataVersion_();
    return {
      success: true,
      message: 'บันทึกเป้าหมายสำเร็จ — ' + position + ' เป้าหมาย ' + target + ' คน',
      id: requestId
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// รองรับโค้ดเก่าที่อาจยังเรียก saveData
function saveData(record) {
  return saveTargetData(record);
}

function getOpenRequests() {
  const requests = getData();
  const hires = getHireData();
  const hiredByRequest = {};
  hires.forEach(function(h) {
    if (!h.request_id) return;
    if (!hiredByRequest[h.request_id]) hiredByRequest[h.request_id] = { total:0, male:0, female:0 };
    hiredByRequest[h.request_id].total += toNumber(h.hired);
    hiredByRequest[h.request_id].male += toNumber(h.hired_male);
    hiredByRequest[h.request_id].female += toNumber(h.hired_female);
  });

  return requests.map(function(r) {
    const linked = hiredByRequest[r.id] || { total:0, male:0, female:0 };
    // r.hired รองรับข้อมูลเก่าที่เคยกรอกรวมอยู่ใน RecruitmentRecords
    const hired = toNumber(r.hired) + linked.total;
    const hiredMale = toNumber(r.hired_male) + linked.male;
    const hiredFemale = toNumber(r.hired_female) + linked.female;
    return {
      id: r.id,
      code: getDeptCode_(r.dept),
      dept: r.dept,
      position: r.position,
      target: toNumber(r.target),
      target_male: toNumber(r.target_male),
      target_female: toNumber(r.target_female),
      hired: hired,
      hired_male: hiredMale,
      hired_female: hiredFemale,
      remaining: Math.max(toNumber(r.target) - hired, 0),
      request_date: r.request_date || '',
      received_request_date: r.hire_date || '',
      note: r.note || ''
    };
  }).filter(function(r) { return r.target > 0 && r.remaining > 0; })
    .sort(function(a, b) {
      const da = a.received_request_date || a.request_date || '';
      const db = b.received_request_date || b.request_date || '';
      return da.localeCompare(db);
    });
}

function saveHireData(record) {
  try {
    const requestId = normalizeText_(record.request_id);
    if (!requestId) throw new Error('กรุณาเลือกรอบคำขอ/วันที่ได้รับคำขอ');

    const requests = getData();
    const req = requests.find(function(r) { return String(r.id) === requestId; });
    if (!req) throw new Error('ไม่พบใบคำขอที่เลือก กรุณาโหลดข้อมูลใหม่');

    const hiredMale = toNumber(record.hired_male);
    const hiredFemale = toNumber(record.hired_female);
    let hired = hiredMale + hiredFemale;
    if (record.hired_unspecified) {
      hired = toNumber(record.hired_total);
    }
    if (hired <= 0) throw new Error('กรุณากรอกจำนวนรับแล้วอย่างน้อย 1 คน');

    const linkedHires = getHireData().filter(function(h) { return String(h.request_id) === requestId; });
    const alreadyHired = toNumber(req.hired) + linkedHires.reduce(function(sum, h) { return sum + toNumber(h.hired); }, 0);
    const remaining = Math.max(toNumber(req.target) - alreadyHired, 0);
    if (remaining <= 0) throw new Error('ใบคำขอนี้รับครบเป้าหมายแล้ว');
    if (hired > remaining) throw new Error('จำนวนรับเข้าครั้งนี้ (' + hired + ') เกินอัตราคงเหลือ (' + remaining + ')');

    const actualStart = dateForSheet_(record.actual_start);
    const scheduledStart = dateForSheet_(record.scheduled_start);
    const receivedDate = dateForSheet_(req.hire_date);
    const days = calculateRecruitmentDays_(receivedDate, actualStart);

    const sheet = ensureHireSheet_();
    const id = 'HIRE_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const now = new Date().toISOString();
    const rowData = [
      id, requestId, req.dept, req.position,
      hired, hiredMale, hiredFemale,
      scheduledStart, actualStart, receivedDate,
      days,
      record.note || '',
      now, now
    ];
    sheet.appendRow(rowData);
    touchDataVersion_();

    return {
      success: true,
      message: 'บันทึกรับแล้วสำเร็จ — ' + req.position + ' ' + hired + ' คน' + (days === '' ? '' : ' | ใช้เวลา ' + days + ' วัน'),
      id: id,
      days_to_hire: days
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}


function updateData(id, updatedData) {
  try {
    const sheet = ensureRecordSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error('ยังไม่มีข้อมูล');

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    let rowToUpdate = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        rowToUpdate = i + 2;
        break;
      }
    }
    if (rowToUpdate === -1) throw new Error('Record not found');

    const current = sheet.getRange(rowToUpdate, 1, 1, RECORD_HEADERS.length).getValues()[0];
    const now = new Date().toISOString();

    const dept = textOr_(updatedData, 'dept', current[1]);
    const position = textOr_(updatedData, 'position', current[2]);
    if (!normalizeText_(dept) || !normalizeText_(position)) throw new Error('แผนกและตำแหน่งงานห้ามว่าง');

    const requestDate = hasOwn_(updatedData, 'request_date') ? dateForSheet_(updatedData.request_date) : current[11];
    const hireDate = hasOwn_(updatedData, 'hire_date') ? dateForSheet_(updatedData.hire_date) : current[12];
    const actualStart = hasOwn_(updatedData, 'actual_start') ? dateForSheet_(updatedData.actual_start) : current[15];
    const recruitmentDays = calculateRecruitmentDays_(hireDate, actualStart);

    const updatedTargetMale = numberOr_(updatedData, 'target_male', current[4]);
    const updatedTargetFemale = numberOr_(updatedData, 'target_female', current[5]);
    const updatedTarget = toNumber(updatedTargetMale) + toNumber(updatedTargetFemale);

    const updatedHiredMale = numberOr_(updatedData, 'hired_male', current[7]);
    const updatedHiredFemale = numberOr_(updatedData, 'hired_female', current[8]);
    const updatedHired = toNumber(updatedHiredMale) + toNumber(updatedHiredFemale);

    const updatedRow = [
      id,
      dept,
      position,
      updatedTarget,
      updatedTargetMale,
      updatedTargetFemale,
      updatedHired,
      updatedHiredMale,
      updatedHiredFemale,
      hasOwn_(updatedData, 'date') ? dateForSheet_(updatedData.date) : current[9],
      textOr_(updatedData, 'note', current[10]),
      requestDate,
      hireDate,
      recruitmentDays,
      hasOwn_(updatedData, 'scheduled_start') ? dateForSheet_(updatedData.scheduled_start) : current[14],
      actualStart,
      textOr_(updatedData, 'request_note', current[16]),
      current[17] || now,
      now
    ];

    sheet.getRange(rowToUpdate, 1, 1, RECORD_HEADERS.length).setValues([updatedRow]);

    touchDataVersion_();

    const vacancy = Math.max(toNumber(updatedRow[3]) - toNumber(updatedRow[6]), 0);
    return { success: true, message: 'อัปเดตสำเร็จ — ' + position + ' ขาด ' + vacancy + ' คน' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteData(id) {
  try {
    const sheet = ensureRecordSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error('ยังไม่มีข้อมูล');

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        sheet.deleteRow(i + 2);
        touchDataVersion_();
        return { success: true, message: 'ลบข้อมูลสำเร็จ' };
      }
    }
    throw new Error('Record not found');
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteHireData(id) {
  try {
    const sheet = ensureHireSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error('ยังไม่มีข้อมูลรายการรับแล้ว');

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        sheet.deleteRow(i + 2);
        touchDataVersion_();
        return { success: true, message: 'ลบรายการรับแล้วสำเร็จ' };
      }
    }
    throw new Error('ไม่พบรายการรับแล้วที่ต้องการลบ');
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================================
// แก้ไขข้อมูลที่กดผิด — ฝั่งคีย์เป้าหมาย/ใบคำขอ
// ============================================================
function updateTargetData(record) {
  try {
    const id = normalizeText_(record && record.id);
    if (!id) throw new Error('ไม่พบข้อมูลที่จะแก้ไข');

    const dept = normalizeText_(record.dept);
    const position = normalizeText_(record.position);
    if (!dept || !position) throw new Error('กรุณาเลือกแผนกและตำแหน่งงาน');

    const targetMale = toNumber(record.target_male);
    const targetFemale = toNumber(record.target_female);
    let target = targetMale + targetFemale;
    if (record.target_unspecified) {
      target = toNumber(record.target_total);
    }
    if (target <= 0) throw new Error('กรุณากรอกเป้าหมายอย่างน้อย 1 คน');

    const sheet = ensureRecordSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error('ยังไม่มีข้อมูล');

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let rowToUpdate = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) { rowToUpdate = i + 2; break; }
    }
    // ถ้า id เป็นแค่ id ชั่วคราวที่ไม่ได้เขียนจริงในชีต → บันทึกเป็นรายการใหม่
    if (rowToUpdate === -1) {
      const fresh = {
        dept: dept,
        position: position,
        target_male: targetMale,
        target_female: targetFemale,
        date: record.date,
        note: record.note,
        request_date: record.request_date,
        hire_date: record.hire_date,
        request_note: record.request_note
      };
      return saveTargetData(fresh);
    }

    const current = sheet.getRange(rowToUpdate, 1, 1, RECORD_HEADERS.length).getValues()[0];
    const now = new Date().toISOString();

    const updatedRow = [
      id, dept, position,
      target, targetMale, targetFemale,
      current[6], current[7], current[8], // จำนวนรับแล้วคงค่าเดิม
      hasOwn_(record, 'date') ? dateForSheet_(record.date) : current[9],
      textOr_(record, 'note', current[10]),
      hasOwn_(record, 'request_date') ? dateForSheet_(record.request_date) : current[11],
      hasOwn_(record, 'hire_date') ? dateForSheet_(record.hire_date) : current[12],
      current[13], current[14], current[15],
      textOr_(record, 'request_note', current[16]),
      current[17] || now,
      now
    ];

    sheet.getRange(rowToUpdate, 1, 1, RECORD_HEADERS.length).setValues([updatedRow]);
    touchDataVersion_();

    const vacancy = Math.max(toNumber(updatedRow[3]) - toNumber(updatedRow[6]), 0);
    return {
      success: true,
      message: 'อัปเดตเป้าหมายสำเร็จ — ' + position + ' เป้าหมาย ' + target + ' คน' + (vacancy > 0 ? ' | ยังขาด ' + vacancy + ' คน' : ''),
      id: id
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================================
// แก้ไขข้อมูลที่กดผิด — ฝั่งรับแล้ว/วันเข้างาน
// ============================================================
function updateHireData(record) {
  try {
    const id = normalizeText_(record && record.id);
    if (!id) throw new Error('ไม่พบข้อมูลที่จะแก้ไข');

    const requestId = normalizeText_(record.request_id);
    if (!requestId) throw new Error('กรุณาเลือกรอบคำขอ/วันที่ได้รับคำขอ');

    const requests = getData();
    const req = requests.find(function(r) { return String(r.id) === requestId; });
    if (!req) throw new Error('ไม่พบใบคำขอที่เลือก กรุณาโหลดข้อมูลใหม่');

    const hiredMale = toNumber(record.hired_male);
    const hiredFemale = toNumber(record.hired_female);
    let hired = hiredMale + hiredFemale;
    if (record.hired_unspecified) {
      hired = toNumber(record.hired_total);
    }
    if (hired <= 0) throw new Error('กรุณากรอกจำนวนรับแล้วอย่างน้อย 1 คน');

    const sheet = ensureHireSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error('ยังไม่มีข้อมูลรายการรับแล้ว');

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let rowToUpdate = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) { rowToUpdate = i + 2; break; }
    }
    // ถ้า id เป็นแค่ id ชั่วคราวที่ไม่ได้เขียนจริงในชีต → บันทึกเป็นรายการใหม่
    if (rowToUpdate === -1) {
      const fresh = {
        request_id: record.request_id,
        hired_male: hiredMale,
        hired_female: hiredFemale,
        scheduled_start: record.scheduled_start,
        actual_start: record.actual_start,
        note: record.note
      };
      return saveHireData(fresh);
    }
    const current = sheet.getRange(rowToUpdate, 1, 1, HIRE_HEADERS.length).getValues()[0];

    // ยอดรับแล้วในคำขอนี้ โดยไม่นับรายการตัวเองที่กำลังแก้ไข
    const linkedHires = getHireData().filter(function(h) {
      return String(h.request_id) === requestId && String(h.id) !== id;
    });
    const alreadyHired = toNumber(req.hired) + linkedHires.reduce(function(sum, h) { return sum + toNumber(h.hired); }, 0);
    const remaining = Math.max(toNumber(req.target) - alreadyHired, 0);
    if (hired > remaining) {
      throw new Error('จำนวนรับเข้าครั้งนี้ (' + hired + ') เกินอัตราคงเหลือ (' + remaining + ')');
    }

    const actualStart = dateForSheet_(record.actual_start);
    const scheduledStart = dateForSheet_(record.scheduled_start);
    const receivedDate = dateForSheet_(req.hire_date);
    const days = calculateRecruitmentDays_(receivedDate, actualStart);

    // ใช้ dept/position จาก record (ถ้าระบุมา) หรือจาก req เดิม
    const finalDept = normalizeText_(record.dept) || req.dept;
    const finalPosition = normalizeText_(record.position) || req.position;

    const now = new Date().toISOString();
    const updatedRow = [
      id, requestId, finalDept, finalPosition,
      hired, hiredMale, hiredFemale,
      scheduledStart, actualStart, receivedDate,
      days,
      textOr_(record, 'note', current[11]),
      current[12] || now,
      now
    ];

    sheet.getRange(rowToUpdate, 1, 1, HIRE_HEADERS.length).setValues([updatedRow]);
    touchDataVersion_();

    return {
      success: true,
      message: 'อัปเดตรับแล้วสำเร็จ — ' + finalPosition + ' ' + hired + ' คน' + (days === '' ? '' : ' | ใช้เวลา ' + days + ' วัน'),
      id: id,
      days_to_hire: days
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function calculateRecruitmentDays_(receivedRequestDate, actualStartDate) {
  const received = parseDateValue_(receivedRequestDate);
  const actual = parseDateValue_(actualStartDate);
  if (!received || !actual) return '';

  // ใช้ UTC เพื่อให้จำนวนวันไม่คลาดเคลื่อนจาก timezone / daylight saving
  const receivedUtc = Date.UTC(received.getFullYear(), received.getMonth(), received.getDate());
  const actualUtc = Date.UTC(actual.getFullYear(), actual.getMonth(), actual.getDate());
  const diff = Math.round((actualUtc - receivedUtc) / 86400000);

  if (diff < 0) {
    throw new Error('วันเข้างานจริงต้องไม่น้อยกว่าวันที่ได้รับคำขอ');
  }
  return diff;
}

function calculateRecruitmentDaysSafe_(receivedRequestDate, actualStartDate) {
  try {
    return calculateRecruitmentDays_(receivedRequestDate, actualStartDate);
  } catch (e) {
    return '';
  }
}

// อัปเดตข้อมูลเดิมใน Google Sheet ให้คอลัมน์ระยะเวลาสรรหา
// = วันที่ได้รับคำขอ (คอลัมน์ M) ถึง เข้างานจริง (คอลัมน์ P)
function recalculateRecruitmentDays_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const rows = sheet.getRange(2, 1, lastRow - 1, RECORD_HEADERS.length).getValues();
  const dayValues = rows.map(function(row) {
    try {
      return [calculateRecruitmentDays_(row[12], row[15])];
    } catch (e) {
      // ถ้าข้อมูลเดิมวันกลับด้าน ให้เว้นว่างเพื่อให้ผู้ใช้แก้วันที่ก่อน
      return [''];
    }
  });
  sheet.getRange(2, 14, dayValues.length, 1).setValues(dayValues).setNumberFormat('0 "วัน"');
}

// ============================================================
// VACANCY / SUMMARY
// ============================================================

function getVacancySummary(deptFilter) {
  const master = getMasterPositions();
  const requests = getData();
  const hires = getHireData();
  const map = {};
  const requestMap = {};

  requests.forEach(function(r) { requestMap[String(r.id)] = r; });

  master.forEach(function(x) {
    if (deptFilter && x.dept !== deptFilter) return;
    const key = makeKey_(x.dept, x.position);
    map[key] = {
      code: x.code, dept: x.dept, position: x.position,
      target: 0, hired: 0,
      target_male: 0, target_female: 0,
      hired_male: 0, hired_female: 0,
      vacancy: 0,
      recruitment_days_sum: 0, recruitment_cycles: 0,
      avg_recruitment_days: null,
      latest_recruitment_days: null,
      latest_received_date: '', latest_actual_start: '',
      status: 'ยังไม่กำหนด'
    };
  });

  // เป้าหมาย + รองรับข้อมูลเก่า (รับแล้วที่อยู่ใน RecruitmentRecords)
  requests.forEach(function(r) {
    if (deptFilter && r.dept !== deptFilter) return;
    const key = makeKey_(r.dept, r.position);
    if (!map[key]) {
      map[key] = {
        code:getDeptCode_(r.dept), dept:r.dept, position:r.position,
        target:0,hired:0,target_male:0,target_female:0,hired_male:0,hired_female:0,
        vacancy:0,recruitment_days_sum:0,recruitment_cycles:0,avg_recruitment_days:null,
        latest_recruitment_days:null,latest_received_date:'',latest_actual_start:'',status:'ยังไม่กำหนด'
      };
    }
    const x = map[key];
    x.target += toNumber(r.target);
    x.target_male += toNumber(r.target_male);
    x.target_female += toNumber(r.target_female);
    x.hired += toNumber(r.hired);
    x.hired_male += toNumber(r.hired_male);
    x.hired_female += toNumber(r.hired_female);

    // ข้อมูลเก่าแบบแถวเดียว ยังนับระยะเวลาได้ตามเดิม
    if (r.hire_date && r.actual_start && r.days_to_hire !== '' && r.days_to_hire !== null) {
      x.recruitment_days_sum += toNumber(r.days_to_hire);
      x.recruitment_cycles += 1;
      x.latest_recruitment_days = toNumber(r.days_to_hire);
      x.latest_received_date = r.hire_date;
      x.latest_actual_start = r.actual_start;
    }
  });

  // รับแล้วใหม่จาก RecruitmentHires + คำนวณวันจากใบคำขอที่อ้างอิง
  hires.forEach(function(h) {
    if (deptFilter && h.dept !== deptFilter) return;
    const key = makeKey_(h.dept, h.position);
    if (!map[key]) {
      map[key] = {
        code:getDeptCode_(h.dept), dept:h.dept, position:h.position,
        target:0,hired:0,target_male:0,target_female:0,hired_male:0,hired_female:0,
        vacancy:0,recruitment_days_sum:0,recruitment_cycles:0,avg_recruitment_days:null,
        latest_recruitment_days:null,latest_received_date:'',latest_actual_start:'',status:'ยังไม่กำหนด'
      };
    }
    const x = map[key];
    x.hired += toNumber(h.hired);
    x.hired_male += toNumber(h.hired_male);
    x.hired_female += toNumber(h.hired_female);

    const req = requestMap[String(h.request_id)];
    const received = req && req.hire_date ? req.hire_date : h.received_request_date;
    const days = calculateRecruitmentDaysSafe_(received, h.actual_start);
    if (received && h.actual_start && days !== '' && days !== null) {
      x.recruitment_days_sum += toNumber(days);
      x.recruitment_cycles += 1;
      x.latest_recruitment_days = toNumber(days);
      x.latest_received_date = received;
      x.latest_actual_start = h.actual_start;
    }
  });

  const result = Object.keys(map).map(function(k) {
    const x = map[k];
    x.vacancy = Math.max(x.target - x.hired, 0);
    x.avg_recruitment_days = x.recruitment_cycles > 0
      ? Math.round(x.recruitment_days_sum / x.recruitment_cycles)
      : null;
    x.status = x.target <= 0 ? 'ยังไม่กำหนด' : (x.vacancy > 0 ? 'ขาด ' + x.vacancy + ' คน' : 'ครบ');
    return x;
  });

  result.sort(function(a, b) {
    if (b.vacancy !== a.vacancy) return b.vacancy - a.vacancy;
    const d = a.code.localeCompare(b.code);
    return d !== 0 ? d : a.position.localeCompare(b.position);
  });
  return result;
}

function getSummaryStatistics() {
  const vacancies = getVacancySummary();
  const summary = {
    totalRecords: 0,
    totalTarget: 0, totalHired: 0, totalVacancy: 0,
    totalTargetMale: 0, totalTargetFemale: 0,
    totalHiredMale: 0, totalHiredFemale: 0,
    positionsWithVacancy: 0,
    byDepartment: {}
  };

  vacancies.forEach(function(v) {
    summary.totalTarget += toNumber(v.target);
    summary.totalHired += toNumber(v.hired);
    summary.totalTargetMale += toNumber(v.target_male);
    summary.totalTargetFemale += toNumber(v.target_female);
    summary.totalHiredMale += toNumber(v.hired_male);
    summary.totalHiredFemale += toNumber(v.hired_female);
    summary.totalVacancy += toNumber(v.vacancy);
    if (v.vacancy > 0) summary.positionsWithVacancy++;

    if (!summary.byDepartment[v.dept]) {
      summary.byDepartment[v.dept] = {
        code: v.code, target:0, hired:0, vacancy:0, positionsWithVacancy:0
      };
    }
    summary.byDepartment[v.dept].target += toNumber(v.target);
    summary.byDepartment[v.dept].hired += toNumber(v.hired);
    summary.byDepartment[v.dept].vacancy += toNumber(v.vacancy);
    if (v.vacancy > 0) summary.byDepartment[v.dept].positionsWithVacancy++;
  });
  summary.totalRecords = getData().length + getHireData().length;
  return summary;
}


// ============================================================
// REAL-TIME / FAST DASHBOARD
// ============================================================

// อัปเดตเลขเวอร์ชันข้อมูลทุกครั้งที่มีการบันทึกจาก Web App
// หรือมีการแก้ไข RecruitmentRecords / RecruitmentHires / MasterPositions ใน Google Sheet โดยตรง
function touchDataVersion_() {
  try {
    PropertiesService.getDocumentProperties().setProperty(DATA_VERSION_KEY, String(Date.now()));
  } catch (error) {
    console.error('touchDataVersion_:', error);
  }
}

// Simple trigger: ทำงานอัตโนมัติเมื่อผู้ใช้แก้ Google Sheet ด้วยมือ
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheetName = e.range.getSheet().getName();
    if ([RECORD_SHEET, HIRE_SHEET, MASTER_SHEET].indexOf(sheetName) !== -1) {
      touchDataVersion_();
    }
  } catch (error) {
    console.error('onEdit:', error);
  }
}

// หน้าเว็บเรียกฟังก์ชันนี้ทุก 10 วินาทีแทนการโหลดรายงานทั้งหมด
// จึงเบากว่าการ refresh ทั้งหน้า และจะโหลดข้อมูลใหม่เฉพาะเมื่อ version เปลี่ยน
function getDataVersion() {
  try {
    const props = PropertiesService.getDocumentProperties();
    let version = props.getProperty(DATA_VERSION_KEY);
    if (!version) {
      version = String(Date.now());
      props.setProperty(DATA_VERSION_KEY, version);
    }
    return { success: true, version: version };
  } catch (error) {
    return { success: false, version: '', message: error.toString() };
  }
}

// อ่านข้อมูลสำหรับ Dashboard โดยตรง โดยไม่เรียก ensure/style ซ้ำทุกครั้ง
// ช่วยลดเวลาโหลดอย่างมากเมื่อมีข้อมูลหลายแถว
function readDashboardSourcesFast_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let masterSheet = ss.getSheetByName(MASTER_SHEET);
  if (!masterSheet) masterSheet = ensureMasterSheet_();
  let recordSheet = ss.getSheetByName(RECORD_SHEET);
  if (!recordSheet) recordSheet = ensureRecordSheet_();
  let hireSheet = ss.getSheetByName(HIRE_SHEET);
  if (!hireSheet) hireSheet = ensureHireSheet_();

  let master = [];
  const masterLastRow = masterSheet.getLastRow();
  if (masterLastRow > 1) {
    master = masterSheet.getRange(2, 1, masterLastRow - 1, 3).getDisplayValues()
      .filter(function(row) { return normalizeText_(row[1]) && normalizeText_(row[2]); })
      .map(function(row) { return { code: row[0], dept: row[1], position: row[2] }; });
  }

  let requests = [];
  const recordLastRow = recordSheet.getLastRow();
  if (recordLastRow > 1) {
    requests = recordSheet.getRange(2, 1, recordLastRow - 1, RECORD_HEADERS.length).getValues()
      .map(function(row, idx) {
        var hasData = false;
        for (var c = 0; c < Math.min(row.length, 8); c++) {
          if (normalizeText_(row[c])) { hasData = true; break; }
        }
        if (!hasData) return null;
        if (!normalizeText_(row[0])) row[0] = 'REQ_AUTO_' + (new Date().getTime()) + '_' + (idx + 2);
        return rowToRecord_(row);
      })
      .filter(function(x) { return !!x; });
  }

  let hires = [];
  const hireLastRow = hireSheet.getLastRow();
  if (hireLastRow > 1) {
    hires = hireSheet.getRange(2, 1, hireLastRow - 1, HIRE_HEADERS.length).getValues()
      .map(function(row, idx) {
        var hasData = false;
        for (var c = 0; c < Math.min(row.length, 8); c++) {
          if (normalizeText_(row[c])) { hasData = true; break; }
        }
        if (!hasData) return null;
        if (!normalizeText_(row[0])) row[0] = 'HIRE_AUTO_' + (new Date().getTime()) + '_' + (idx + 2);
        return rowToHire_(row);
      })
      .filter(function(x) { return !!x; });
  }

  return { master: master, requests: requests, hires: hires };
}

function buildDepartmentsFast_(master) {
  const map = {};
  master.forEach(function(x) {
    if (!map[x.dept]) map[x.dept] = { code: x.code, dept: x.dept };
  });
  return Object.keys(map).map(function(k) { return map[k]; })
    .sort(function(a, b) { return a.code.localeCompare(b.code); });
}

function buildOpenRequestsFast_(requests, hires) {
  const hiredByRequest = {};
  hires.forEach(function(h) {
    if (!h.request_id) return;
    if (!hiredByRequest[h.request_id]) hiredByRequest[h.request_id] = { total:0, male:0, female:0 };
    hiredByRequest[h.request_id].total += toNumber(h.hired);
    hiredByRequest[h.request_id].male += toNumber(h.hired_male);
    hiredByRequest[h.request_id].female += toNumber(h.hired_female);
  });

  return requests.map(function(r) {
    const linked = hiredByRequest[r.id] || { total:0, male:0, female:0 };
    const hired = toNumber(r.hired) + linked.total;
    const hiredMale = toNumber(r.hired_male) + linked.male;
    const hiredFemale = toNumber(r.hired_female) + linked.female;
    return {
      id: r.id,
      code: getDeptCode_(r.dept),
      dept: r.dept,
      position: r.position,
      target: toNumber(r.target),
      target_male: toNumber(r.target_male),
      target_female: toNumber(r.target_female),
      hired: hired,
      hired_male: hiredMale,
      hired_female: hiredFemale,
      remaining: Math.max(toNumber(r.target) - hired, 0),
      request_date: r.request_date || '',
      received_request_date: r.hire_date || '',
      note: r.note || ''
    };
  }).filter(function(r) { return r.target > 0 && r.remaining > 0; })
    .sort(function(a, b) {
      const da = a.received_request_date || a.request_date || '';
      const db = b.received_request_date || b.request_date || '';
      return da.localeCompare(db);
    });
}

function buildVacancySummaryFast_(master, requests, hires, deptFilter) {
  const map = {};
  const requestMap = {};
  requests.forEach(function(r) { requestMap[String(r.id)] = r; });

  function ensureItem_(code, dept, position) {
    const key = makeKey_(dept, position);
    if (!map[key]) {
      map[key] = {
        code: code || getDeptCode_(dept), dept: dept, position: position,
        target:0, hired:0, target_male:0, target_female:0, hired_male:0, hired_female:0,
        vacancy:0, recruitment_days_sum:0, recruitment_cycles:0, avg_recruitment_days:null,
        latest_recruitment_days:null, latest_received_date:'', latest_actual_start:'', status:'ยังไม่กำหนด'
      };
    }
    return map[key];
  }

  master.forEach(function(x) {
    if (deptFilter && x.dept !== deptFilter) return;
    ensureItem_(x.code, x.dept, x.position);
  });

  requests.forEach(function(r) {
    if (deptFilter && r.dept !== deptFilter) return;
    const x = ensureItem_(getDeptCode_(r.dept), r.dept, r.position);
    x.target += toNumber(r.target);
    x.target_male += toNumber(r.target_male);
    x.target_female += toNumber(r.target_female);
    x.hired += toNumber(r.hired);
    x.hired_male += toNumber(r.hired_male);
    x.hired_female += toNumber(r.hired_female);

    if (r.hire_date && r.actual_start && r.days_to_hire !== '' && r.days_to_hire !== null) {
      x.recruitment_days_sum += toNumber(r.days_to_hire);
      x.recruitment_cycles += 1;
      x.latest_recruitment_days = toNumber(r.days_to_hire);
      x.latest_received_date = r.hire_date;
      x.latest_actual_start = r.actual_start;
    }
  });

  hires.forEach(function(h) {
    if (deptFilter && h.dept !== deptFilter) return;
    const x = ensureItem_(getDeptCode_(h.dept), h.dept, h.position);
    x.hired += toNumber(h.hired);
    x.hired_male += toNumber(h.hired_male);
    x.hired_female += toNumber(h.hired_female);

    const req = requestMap[String(h.request_id)];
    const received = req && req.hire_date ? req.hire_date : h.received_request_date;
    const days = calculateRecruitmentDaysSafe_(received, h.actual_start);
    if (received && h.actual_start && days !== '' && days !== null) {
      x.recruitment_days_sum += toNumber(days);
      x.recruitment_cycles += 1;
      x.latest_recruitment_days = toNumber(days);
      x.latest_received_date = received;
      x.latest_actual_start = h.actual_start;
    }
  });

  const result = Object.keys(map).map(function(k) {
    const x = map[k];
    x.vacancy = Math.max(x.target - x.hired, 0);
    x.avg_recruitment_days = x.recruitment_cycles > 0
      ? Math.round(x.recruitment_days_sum / x.recruitment_cycles)
      : null;
    x.status = x.target <= 0 ? 'ยังไม่กำหนด' : (x.vacancy > 0 ? 'ขาด ' + x.vacancy + ' คน' : 'ครบ');
    return x;
  });

  result.sort(function(a, b) {
    if (b.vacancy !== a.vacancy) return b.vacancy - a.vacancy;
    const d = a.code.localeCompare(b.code);
    return d !== 0 ? d : a.position.localeCompare(b.position);
  });
  return result;
}

function buildLastModifiedFast_(requests, hires) {
  let latest = 0;
  requests.concat(hires).forEach(function(r) {
    const raw = r.updated_at || r.created_at || '';
    const d = new Date(raw);
    if (!isNaN(d.getTime()) && d.getTime() > latest) latest = d.getTime();
  });
  return {
    timestamp: latest ? new Date(latest).toISOString() : new Date().toISOString(),
    recordCount: requests.length + hires.length
  };
}

function buildSummaryFast_(vacancies, totalRecords) {
  const summary = {
    totalRecords: totalRecords || 0,
    totalTarget:0, totalHired:0, totalVacancy:0,
    totalTargetMale:0, totalTargetFemale:0,
    totalHiredMale:0, totalHiredFemale:0,
    positionsWithVacancy:0,
    byDepartment:{}
  };

  vacancies.forEach(function(v) {
    summary.totalTarget += toNumber(v.target);
    summary.totalHired += toNumber(v.hired);
    summary.totalTargetMale += toNumber(v.target_male);
    summary.totalTargetFemale += toNumber(v.target_female);
    summary.totalHiredMale += toNumber(v.hired_male);
    summary.totalHiredFemale += toNumber(v.hired_female);
    summary.totalVacancy += toNumber(v.vacancy);
    if (v.vacancy > 0) summary.positionsWithVacancy++;

    if (!summary.byDepartment[v.dept]) {
      summary.byDepartment[v.dept] = { code:v.code, target:0, hired:0, vacancy:0, positionsWithVacancy:0 };
    }
    summary.byDepartment[v.dept].target += toNumber(v.target);
    summary.byDepartment[v.dept].hired += toNumber(v.hired);
    summary.byDepartment[v.dept].vacancy += toNumber(v.vacancy);
    if (v.vacancy > 0) summary.byDepartment[v.dept].positionsWithVacancy++;
  });
  return summary;
}

function getDashboardData() {
  try {
    const src = readDashboardSourcesFast_();
    const vacancies = buildVacancySummaryFast_(src.master, src.requests, src.hires);
    const versionInfo = getDataVersion();
    const debug = (function(){
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const rows = function(name){
          const s = ss.getSheetByName(name);
          return s ? s.getLastRow() - 1 : -1;
        };
        const sample = function(name, cols){
          const s = ss.getSheetByName(name);
          if (!s || s.getLastRow() < 2) return null;
          return s.getRange(2, 1, 1, cols).getDisplayValues()[0];
        };
        return {
          spreadsheet: ss.getName(),
          sheets: ss.getSheets().map(function(s){ return s.getName(); }).join(','),
          recordsRows: rows(RECORD_SHEET),
          hiresRows: rows(HIRE_SHEET),
          masterRows: rows(MASTER_SHEET),
          requestsParsed: src.requests.length,
          hiresParsed: src.hires.length,
          recordSample: sample(RECORD_SHEET, 5),
          hireSample: sample(HIRE_SHEET, 5)
        };
      } catch (e) {
        return { error: String(e) };
      }
    })();
    return {
      master: src.master,
      departments: buildDepartmentsFast_(src.master),
      openRequests: buildOpenRequestsFast_(src.requests, src.hires),
      vacancies: vacancies,
      summary: buildSummaryFast_(vacancies, src.requests.length + src.hires.length),
      allRequests: src.requests.map(function(r){
        return {
          id: r.id, dept: r.dept, position: r.position,
          target: r.target, target_male: r.target_male, target_female: r.target_female,
          // ข้อมูลเก่าแบบแถวเดียว: รับแล้ว/วันรับเข้า อยู่ในใบคำขอ — ส่งให้ฝั่งหน้าเว็บไว้กรอง KPI ตามเดือนที่รับเข้า
          hired: r.hired, hired_male: r.hired_male, hired_female: r.hired_female,
          scheduled_start: r.scheduled_start, actual_start: r.actual_start,
          date: r.date, note: r.note,
          request_date: r.request_date, hire_date: r.hire_date, request_note: r.request_note
        };
      }),
      allHires: src.hires,
      debug: debug,
      dataVersion: versionInfo.version || String(Date.now()),
      lastModified: buildLastModifiedFast_(src.requests, src.hires)
    };
  } catch (error) {
    console.error('getDashboardData:', error);
    throw error;
  }
}

function getLastModifiedTime() {
  try {
    let latest = 0;
    let count = 0;
    const recordSheet = ensureRecordSheet_();
    const hireSheet = ensureHireSheet_();

    if (recordSheet.getLastRow() > 1) {
      const vals = recordSheet.getRange(2, 19, recordSheet.getLastRow()-1, 1).getValues();
      count += vals.length;
      vals.forEach(function(row){
        const d = new Date(row[0]);
        if (!isNaN(d.getTime()) && d.getTime() > latest) latest = d.getTime();
      });
    }
    if (hireSheet.getLastRow() > 1) {
      const vals = hireSheet.getRange(2, 14, hireSheet.getLastRow()-1, 1).getValues();
      count += vals.length;
      vals.forEach(function(row){
        const d = new Date(row[0]);
        if (!isNaN(d.getTime()) && d.getTime() > latest) latest = d.getTime();
      });
    }
    return {
      timestamp: latest ? new Date(latest).toISOString() : new Date().toISOString(),
      recordCount: count
    };
  } catch (error) {
    return { timestamp:new Date().toISOString(), recordCount:0 };
  }
}

