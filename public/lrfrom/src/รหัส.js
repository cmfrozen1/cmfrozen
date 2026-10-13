/**
 * ใบลา CM 2 - Google Apps Script backend
 * ไฟล์ในโปรเจกต์: Code.gs (ไฟล์นี้) + Index.html + approve.html
 */

const SHEET_NAME = 'LeaveRequests';
const EMPLOYEE_SHEET_NAME = 'sh_employee';
const EMPLOYEE_HEADERS = ['รหัสพนักงาน', 'คำนำหน้า', 'ชื่อ-นามสกุล', 'แผนก', 'ประเภทพนักงาน', 'เรียน'];
const APPROVE_SHEET_NAME = 'sh_approve';
// คอลัมน์ใหม่ "รหัสหัวหน้างาน" ต่อท้าย เพื่อไม่ให้กระทบชีตเดิมที่ใช้คอลัมน์ B/C
const APPROVE_HEADERS = ['แผนก', 'รหัสหัวหน้าแผนก', 'รหัสผู้จัดการ', 'รหัสหัวหน้างาน'];
// โฟลเดอร์ Google Drive สำหรับเก็บไฟล์ลายเซ็น
//const SIGNATURE_FOLDER_ID = '1Zj9tFntFH25NayNyCCU3R6AcNuQ4d_YI';
const SIGNATURE_FOLDER_ID = '1ERb3SaKGw9AF-b74_LxzyFHkwJzNF9Ki';

const HEADERS = [
  'ID', 'บันทึกเมื่อ', 'สถานะ', 'ประเภทพนักงาน', 'วันที่ยื่น', 'เรียน',
  'คำนำหน้า', 'ชื่อ-นามสกุล', 'รหัส', 'แผนก',
  'ขอลา', 'เนื่องจาก', 'ลาตั้งแต่วันที่', 'ถึงวันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'รวมจำนวน', 'หน่วย',
  'สถิติ: ลากิจ', 'สถิติ: ลาพักร้อน', 'สถิติ: ลาป่วยมีใบรับรองแพทย์', 'สถิติ: ลาคลอด',
  'สถิติ: ลาป่วยไม่มีใบรับรองแพทย์', 'สถิติ: ลาทำหมัน', 'สถิติ: ขาดงาน',
  'สถิติ: ลืมบัตร / ลืมรูดบัตร', 'สถิติ: มาสาย / กลับก่อน', 'สถิติ: อุบัติเหตุ / เจ็บป่วยในงาน',
  'ลิงก์ลายเซ็นผู้ลา', 'ลิงก์ลายเซ็นหัวหน้าแผนก', 'ลิงก์ลายเซ็นผู้ช่วย/รอง/ผู้จัดการ',
  'ผลพิจารณาหัวหน้าแผนก', 'ผลพิจารณาผู้ช่วย/รอง/ผู้จัดการ',
  'ลิงก์ลายเซ็นหัวหน้างาน', 'ผลพิจารณาหัวหน้างาน',
  // ชื่อผู้ที่อนุมัติจริง (บันทึกตอนกดอนุมัติ) ใช้แทนชื่อนิ่งจาก sh_approve ในช่องลงชื่อ PDF
  'ชื่อผู้อนุมัติหัวหน้างาน', 'ชื่อผู้อนุมัติหัวหน้าแผนก', 'ชื่อผู้อนุมัติผู้ช่วย/รอง/ผู้จัดการ'
];

/** เลขคอลัมน์ (1-indexed) ที่ต้องอ้างถึงโดยตรง */
const COL = {
  STATUS: 3,
  DEPT: 10,
  APP_SIG: 29,
  HEAD_SIG: 30,
  MGR_SIG: 31,
  FOREMAN_SIG: 34,
  HEAD_RESULT: 32,
  MGR_RESULT: 33,
  FOREMAN_RESULT: 35,
  FOREMAN_NAME: 36,
  HEAD_NAME: 37,
  MGR_NAME: 38
};

/** บทบาทผู้อนุมัติที่ระบบรองรับ (เรียงตามลำดับการพิจารณา) */
const APPROVER_ROLES = ['foreman', 'head', 'mgr', 'admin'];
const ROLE_LABEL = {
  foreman: 'หัวหน้างาน',
  head: 'หัวหน้าแผนก',
  mgr: 'ผู้ช่วย / รอง / ผู้จัดการ',
  admin: 'ผู้ดูแลระบบ (Admin)'
};

/** หัวคอลัมน์ชื่อผู้ที่อนุมัติจริง (คอลัมน์ท้ายตารางของชีตใบลา) */
const APPROVER_NAME_HEADERS = {
  foreman: 'ชื่อผู้อนุมัติหัวหน้างาน',
  head: 'ชื่อผู้อนุมัติหัวหน้าแผนก',
  mgr: 'ชื่อผู้อนุมัติผู้ช่วย/รอง/ผู้จัดการ'
};
const APPROVER_NAME_DEFAULT_COL = {
  foreman: HEADERS.indexOf(APPROVER_NAME_HEADERS.foreman) + 1,
  head: HEADERS.indexOf(APPROVER_NAME_HEADERS.head) + 1,
  mgr: HEADERS.indexOf(APPROVER_NAME_HEADERS.mgr) + 1
};

/** แสดงหน้าเว็บ (Deploy > Web app) */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page).toLowerCase() : '';
  if (page === 'approve' || page === 'approval') {
    const deptResult = getApprovalDepartments();
    const hasDepts = deptResult && deptResult.ok && Array.isArray(deptResult.data) && deptResult.data.length;
    const options = hasDepts
      ? '<option value="">— เลือกแผนก —</option>' + deptResult.data.map(function(dept) {
          const safe = escapeHtml_(dept);
          return '<option value="' + safe + '">' + safe + '</option>';
        }).join('')
      : '<option value="">ไม่สามารถโหลดรายชื่อแผนก</option>';
    const errorMessage = hasDepts ? '' : escapeHtml_(deptResult && deptResult.message || 'อ่านรายชื่อแผนกไม่สำเร็จ');
    // ใช้ callback ใน replace เพื่อไม่ให้ $ / $& ในข้อความถูกตีความเป็น pattern
    const html = HtmlService.createHtmlOutputFromFile('approve').getContent()
      .replace('__APPROVAL_DEPARTMENT_OPTIONS__', function () { return options; })
      .replace('__APPROVAL_RETRY_STYLE__', function () { return hasDepts ? 'display:none;' : 'display:block;'; })
      .replace('__APPROVAL_DEPARTMENT_ERROR_CLASS__', function () { return hasDepts ? '' : 'err'; })
      .replace('__APPROVAL_DEPARTMENT_ERROR_TEXT__', function () { return errorMessage; });
    return HtmlService.createHtmlOutput(html)
      .setTitle('ระบบอนุมัติใบลา CM 2')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (page === 'report') {
    return HtmlService.createHtmlOutputFromFile('report')
      .setTitle('พิมพ์ใบลา CM 2')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ใบลา CM 2')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

/** คืน URL ของ Web App เพื่อให้หน้าใน iframe นำทางไปยังหน้าอนุมัติได้ถูกต้อง */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * สร้างฐานข้อมูล (Sheet) ครั้งแรก - เรียกซ้ำได้ ไม่ทับข้อมูลเดิม
 * - ถ้าสคริปต์ผูกกับ Spreadsheet (Extensions > Apps Script) จะใช้ไฟล์นั้น
 * - ถ้าไม่ผูก จะสร้าง Spreadsheet ใหม่ แล้วเก็บ ID ไว้ใน Script Properties
 * @return {{ok:boolean, url:string, sheet:string, created:boolean}}
 */
function initDatabase() {
  const ss = getSpreadsheet_(true);
  let sheet = ss.getSheetByName(SHEET_NAME);
  let created = false;

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    created = true;
  }

  // ขยายกริดให้พอสำหรับหัวคอลัมน์ (มีคอลัมน์ชื่อผู้อนุมัติเพิ่มท้ายตาราง)
  // หมายเหตุ: คลาส Sheet ของ Apps Script ไม่มี setMaxColumns ต้องใช้ insertColumnsAfter
  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  // หัวตาราง LeaveRequests
  const head = sheet.getRange(1, 1, 1, HEADERS.length);
  head.setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#1f5fbf')
      .setFontColor('#ffffff')
      .setVerticalAlignment('middle')
      .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 42);

  // ตั้งเป็น Plain text กันข้อมูลเช่น "2:0:0" หรือ "08:30" ถูกแปลงเป็นเวลา/วันที่
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, HEADERS.length).setNumberFormat('@');
  sheet.setColumnWidths(1, HEADERS.length, 130);

  // สร้าง Sheet พนักงาน (sh_employee) หากยังไม่มี
  let empSheet = ss.getSheetByName(EMPLOYEE_SHEET_NAME) || ss.getSheetByName('employee') || ss.getSheetByName('Employee');
  if (!empSheet) {
    empSheet = ss.insertSheet(EMPLOYEE_SHEET_NAME);
    const empHead = empSheet.getRange(1, 1, 1, EMPLOYEE_HEADERS.length);
    empHead.setValues([EMPLOYEE_HEADERS])
        .setFontWeight('bold')
        .setBackground('#1f5fbf')
        .setFontColor('#ffffff')
        .setVerticalAlignment('middle');
    empSheet.setFrozenRows(1);
    empSheet.setRowHeight(1, 35);
    empSheet.getRange(2, 1, 100, EMPLOYEE_HEADERS.length).setNumberFormat('@');
    empSheet.setColumnWidths(1, EMPLOYEE_HEADERS.length, 130);
  }

  // สร้าง Sheet รหัสอนุมัติ (sh_approve) หากยังไม่มี
  const approveInfo = ensureApproveSheet_(ss);
  Logger.log('sh_approve: ' + JSON.stringify(approveInfo));

  // ลบชีตเปล่า (Sheet1) ที่มากับไฟล์ใหม่
  const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (blank && blank.getSheetId() !== sheet.getSheetId() && blank.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(blank);
  }

  return { ok: true, url: ss.getUrl(), sheet: SHEET_NAME, created: created, folder: checkFolderAccess() };
}

/**
 * สร้าง/เติมหัวคอลัมน์ของชีตผู้อนุมัติ โดยไม่ทับข้อมูลเดิม
 * @return {{ok:boolean, sheet:string, created:boolean, foremanColumnAdded:boolean, message:string}}
 */
function ensureApproveSheet_(ss) {
  let appSheet = ss.getSheetByName(APPROVE_SHEET_NAME) ||
                 ss.getSheetByName('approve') ||
                 ss.getSheetByName('Approve') ||
                 ss.getSheetByName('ผู้อนุมัติ');
  let created = false;

  if (!appSheet) {
    appSheet = ss.insertSheet(APPROVE_SHEET_NAME);
    created = true;
    const appHead = appSheet.getRange(1, 1, 1, APPROVE_HEADERS.length);
    appHead.setValues([APPROVE_HEADERS])
        .setFontWeight('bold')
        .setBackground('#1f5fbf')
        .setFontColor('#ffffff')
        .setVerticalAlignment('middle')
        .setWrap(true);
    appSheet.setFrozenRows(1);
    appSheet.setRowHeight(1, 35);
    appSheet.getRange(2, 1, 200, APPROVE_HEADERS.length).setNumberFormat('@');
    appSheet.setColumnWidths(1, APPROVE_HEADERS.length, 160);
    return { ok: true, sheet: appSheet.getName(), created: created, foremanColumnAdded: true, message: 'สร้างชีตผู้อนุมัติใหม่พร้อมคอลัมน์รหัสหัวหน้างาน' };
  }

  // ชีตเดิม: เติมคอลัมน์ "รหัสหัวหน้างาน" เฉพาะเมื่อยังไม่มีหัวคอลัมน์นี้และคอลัมน์ถัดไปว่างทั้งหมด
  const lastCol = Math.max(appSheet.getLastColumn(), 1);
  const headerRow = appSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (h) {
    return String(h || '').trim();
  });
  const hasForeman = headerRow.some(function (h) { return /หัวหน้างาน|foreman|supervisor/i.test(h); });

  if (hasForeman) {
    return { ok: true, sheet: appSheet.getName(), created: false, foremanColumnAdded: false, message: 'ชีตผู้อนุมัติมีคอลัมน์รหัสหัวหน้างานอยู่แล้ว' };
  }

  const lastRow = appSheet.getLastRow();
  const nextCol = lastCol + 1;
  const tail = lastRow >= 1
    ? appSheet.getRange(2, nextCol, Math.max(lastRow - 1, 1), 1).getDisplayValues()
    : [];
  const tailBusy = tail.some(function (r) { return String(r[0] || '').trim(); });

  if (tailBusy) {
    return {
      ok: true, sheet: appSheet.getName(), created: false, foremanColumnAdded: false,
      message: 'คอลัมน์ ' + colLetter_(nextCol) + ' มีข้อมูลเดิมอยู่ จึงไม่ได้เพิ่มคอลัมน์รหัสหัวหน้างาน ' +
               '(ระบบจะอนุญาตให้รหัสผู้อนุมัติที่มีอยู่ใช้ลงชื่อเป็นหัวหน้างานได้)'
    };
  }

  appSheet.getRange(1, nextCol).setValue('รหัสหัวหน้างาน')
      .setFontWeight('bold').setBackground('#1f5fbf').setFontColor('#ffffff');
  appSheet.setColumnWidth(nextCol, 160);
  if (lastRow >= 1) appSheet.getRange(2, nextCol, Math.max(lastRow - 1, 1), 1).setNumberFormat('@');

  return {
    ok: true, sheet: appSheet.getName(), created: false, foremanColumnAdded: true,
    message: 'เพิ่มคอลัมน์รหัสหัวหน้างานที่คอลัมน์ ' + colLetter_(nextCol) + ' กรุณากรอกรหัสพนักงานหัวหน้างาน'
  };
}

function colLetter_(index) {
  let n = Number(index) || 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/* =======================================================================
   การคำนวณจำนวนวันลา
   ======================================================================= */

/** แปลง 'YYYY-MM-DD' เป็น Date (เวลาท้องถิ่น 00:00) คืน null เมื่อรูปแบบผิด */
function parseDateOnly_(value) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value == null ? '' : value).trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/** แปลง 'HH:MM' เป็นจำนวนนาที คืน null เมื่อรูปแบบผิด */
function parseTimeOnly_(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value == null ? '' : value).trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/** ตั้งค่า: นับวันอาทิตย์เป็นวันลาหรือไม่ (เก็บใน Script Properties ชื่อ SKIP_SUNDAY) */
function skipSunday_() {
  const raw = PropertiesService.getScriptProperties().getProperty('SKIP_SUNDAY');
  return raw === null || raw === '' ? true : String(raw) !== 'false';
}

/**
 * คำนวณจำนวนวันลาแบบอ่านอย่างเดียว (ผู้ใช้แก้ไขไม่ได้)
 * - ลาหลายวัน: นับรวมวันเริ่ม-วันสิ้นสุด และตัดวันอาทิตย์ออก
 * - ลาวันเดียวที่กรอกเวลา: คิดเป็นนาที หรือชั่วโมง
 * @return {{ok:boolean, days:number, hours:number, minutes:number, qty:string, unit:string, text:string, skippedSunday:number, error:string}}
 */
function computeLeaveDuration(d1, d2, t1, t2, empType) {
  const isMonthly = String(empType || '').trim() === 'รายเดือน';
  const out = { ok: true, days: 0, hours: 0, minutes: 0, qty: '', unit: '', text: '', skippedSunday: 0, skippedSaturday: 0, error: '' };

  const start = parseDateOnly_(d1);
  if (!start) {
    out.ok = false;
    out.error = 'กรุณาเลือกวันที่เริ่มต้นการลา';
    return out;
  }

  let end = parseDateOnly_(d2);
  if (!end) end = new Date(start.getTime());

  if (end.getTime() < start.getTime()) {
    out.ok = false;
    out.error = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้นการลา';
    return out;
  }

  let days = 0;
  let sunday = 0;
  let saturday = 0;
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getDay();
    if (dow === 0) sunday++;
    else if (isMonthly && dow === 6) saturday++;
    else days++;
    cursor.setDate(cursor.getDate() + 1);
  }

  const fromMin = parseTimeOnly_(t1);
  const toMin = parseTimeOnly_(t2);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // 1. วันเดียวกัน มีระบุเวลาเริ่มต้นและสิ้นสุด
  if (diffDays === 0 && fromMin !== null && toMin !== null && toMin > fromMin) {
    const totalMinutes = toMin - fromMin;
    if (totalMinutes < 60) {
      out.qty = String(totalMinutes);
      out.unit = 'นาที';
      out.minutes = totalMinutes;
    } else {
      out.qty = String(Math.round((totalMinutes / 60) * 100) / 100);
      out.unit = 'ชั่วโมง';
      out.hours = Math.round((totalMinutes / 60) * 100) / 100;
    }
    out.text = out.qty + ' ' + out.unit;
    out.days = days;
    out.skippedSunday = sunday;
    out.skippedSaturday = saturday;
    return out;
  }

  // 2. ลาข้ามคืน 1 วัน / กะดึก (เช่น 22:00 ถึง 06:00 วันรุ่งขึ้น)
  if (diffDays === 1 && fromMin !== null && toMin !== null && toMin <= fromMin) {
    const totalMinutes = (1440 - fromMin) + toMin;
    if (totalMinutes < 60) {
      out.qty = String(totalMinutes);
      out.unit = 'นาที';
      out.minutes = totalMinutes;
    } else {
      out.qty = String(Math.round((totalMinutes / 60) * 100) / 100);
      out.unit = 'ชั่วโมง';
      out.hours = Math.round((totalMinutes / 60) * 100) / 100;
    }
    out.text = out.qty + ' ' + out.unit + ' (ลากะดึกข้ามคืน)';
    out.days = days;
    out.skippedSunday = sunday;
    out.skippedSaturday = saturday;
    return out;
  }

  // 3. ลาหลายวัน / ลาเป็นสัปดาห์ / ลาเต็มวัน
  let qty = String(days);
  let unit = 'วัน';
  if (days === 0 && (sunday > 0 || saturday > 0)) {
    qty = String(sunday + saturday);
    unit = 'วัน';
  }

  out.days = days;
  out.skippedSunday = sunday;
  out.skippedSaturday = saturday;
  out.qty = qty;
  out.unit = unit;

  let skipNote = '';
  if (isMonthly) {
    const totalWeekend = saturday + sunday;
    if (totalWeekend > 0) {
      skipNote = ' (ตัดวันเสาร์-อาทิตย์ออก ' + totalWeekend + ' วัน)';
    }
  } else {
    if (sunday > 0) {
      skipNote = ' (ตัดวันอาทิตย์ออก ' + sunday + ' วัน)';
    }
  }

  out.text = qty + ' ' + unit + skipNote;
  return out;
}

/** ตัวช่วยเดียวกับ computeLeaveDuration ใช้ฝั่ง server ใน saveLeave */
function computeLeaveDuration_(d1, d2, t1, t2, empType) {
  return computeLeaveDuration(d1, d2, t1, t2, empType);
}

/**
 * บันทึกใบลา 1 รายการ (เรียกจากหน้าเว็บด้วย google.script.run.saveLeave)
 * @param {Object} d ข้อมูลจากฟอร์ม
 * @return {{ok:boolean, id:string}}
 */
function saveLeave(d) {
  if (!d || !String(d.name || '').trim()) {
    throw new Error('กรุณากรอกชื่อ - นามสกุล');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = getSpreadsheet_(false);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) { initDatabase(); sheet = getSpreadsheet_(false).getSheetByName(SHEET_NAME); }

    // จำนวนวันลาคำนวณจากฝั่ง server เสมอ ผู้ใช้แก้ไขค่านี้เองไม่ได้
    const duration = computeLeaveDuration(d.d1, d.d2, d.t1, d.t2, d.emp);
    if (!duration.ok) throw new Error(duration.error);

    const id = 'LV-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss') +
               '-' + Math.floor(Math.random() * 900 + 100);
    const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const s = d.stats || [];

    const approvals = d.approvals || {};
    const headApproval = approvalValue_(approvals.head);
    const mgrApproval = approvalValue_(approvals.mgr);
    const foremanApproval = approvalValue_(approvals.foreman);
    const row = [
      id, now, leaveStatus_(headApproval, mgrApproval, foremanApproval, d.emp, d.to), d.emp, d.fdate, d.to,
      d.pre, d.name, d.code, d.dept,
      d.type, d.why, d.d1, d.d2, d.t1, d.t2, duration.qty, duration.unit
    ];
    for (let i = 0; i < 10; i++) row.push(s[i] || '');

    // อัปโหลดลายเซ็นไปโฟลเดอร์ Drive แล้วเก็บลิงก์ (รูปแบบ lh5.googleusercontent.com) ลง Sheet
    const links = saveSignatures_(d.sigs || {}, id);
    row.push(links.app, links.head, links.mgr, headApproval, mgrApproval, links.foreman, foremanApproval);

    // ป้องกันสูตรแทรก (ข้อความที่ขึ้นต้นด้วย = + - @) และบังคับเป็นข้อความ
    const clean = row.map(function (v) {
      v = (v === undefined || v === null) ? '' : String(v).slice(0, 500);
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    });

    const r = sheet.getLastRow() + 1;
    sheet.getRange(r, 1, 1, clean.length).setNumberFormat('@').setValues([clean]);
    return { ok: true, id: id, qty: duration.qty, unit: duration.unit, durationText: duration.text, warn: links.warn };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ตรวจสอบรหัสผ่าน PIN ของผู้อนุมัติ (หัวหน้าแผนก / ผู้จัดการ) ตามแผนกใน Sheet approve / sh_approve
 * @param {string} role 'head' หรือ 'mgr'
 * @param {string} pin รหัสผ่านที่ผู้ใช้กรอก
 * @param {string} dept แผนกของผู้ลา (ถ้ามี)
 * @return {{ok:boolean, message:string}}
 */
function verifyApproverPin(role, pin, dept) {
  role = String(role || '').toLowerCase();
  pin = String(pin || '').trim();
  dept = String(dept || '').trim();

  if (!pin) {
    return { ok: false, message: 'กรุณากรอกรหัสผ่าน' };
  }

  try {
    const matchedRow = findApproverEntry_(dept, pin, role);
    if (matchedRow) {
      const roleName = ROLE_LABEL[role] || 'ผู้อนุมัติ';
      return { ok: true, message: 'รหัสผ่าน' + roleName + (matchedRow.dept ? ' แผนก ' + matchedRow.dept : '') + ' ถูกต้อง' };
    }
  } catch (e) {
    Logger.log('Error checking approve sheet: ' + e);
  }

  return { ok: false, message: 'ไม่พบรหัสผู้อนุมัตินี้ในชีตผู้อนุมัติ' };
}

/* =======================================================================
   ตารางผู้อนุมัติ (sh_approve)
   ======================================================================= */

/** หาแท็บผู้อนุมัติจากชื่อแท็บ แล้วจากชื่อแท็บ/หัวคอลัมน์แรก */
function findApproveSheet_() {
  const names = [APPROVE_SHEET_NAME, 'approve', 'Approve', 'APPROVE', 'ผู้อนุมัติ', 'อนุมัติ'];
  let ss;
  try {
    ss = getSpreadsheet_(false);
  } catch (e) {
    return null;
  }

  for (let i = 0; i < names.length; i++) {
    const found = ss.getSheetByName(names[i]);
    if (found) return found;
  }

  const sheets = ss.getSheets();
  for (let j = 0; j < sheets.length; j++) {
    if (/approve|sh_approve|ผู้อนุมัติ|อนุมัติ/i.test(sheets[j].getName())) return sheets[j];
  }
  for (let k = 0; k < sheets.length; k++) {
    const candidate = sheets[k];
    const firstHeader = candidate.getLastColumn()
      ? String(candidate.getRange(1, 1).getDisplayValue() || '').trim()
      : '';
    if (/^(ชื่อ)?แผนก$|^department(\s*name)?$/i.test(firstHeader)) return candidate;
  }
  return null;
}

/**
 * ดึงและแปลงข้อมูลตารางอนุมัติจาก Sheet approve / sh_approve
 * รองรับ 3 รูปแบบ
 *  1) คอลัมน์แยกรหัสต่อบทบาท: แผนก | รหัสหัวหน้าแผนก | รหัสผู้จัดการ | รหัสหัวหน้างาน
 *  2) หนึ่งแถวต่อผู้อนุมัติ: แผนก | รหัส | บทบาท
 *  3) แบบเดิม: A=แผนก, B=รหัสผู้อนุมัติ, D=บทบาท
 * @return {Array<{dept:string, foremanPin:string, headPin:string, mgrPin:string, mgrRole:string}>}
 */
function getApproveSheetData_() {
  let sheet;
  try {
    sheet = findApproveSheet_();
  } catch (e) {
    return [];
  }
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();
  const headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });

  let deptIdx = -1, foremanIdx = -1, headIdx = -1, mgrIdx = -1, positionIdx = -1, roleIdx = -1, pinIdx = -1;

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (!h) continue;
    if (/^(ชื่อ)?แผนก$|^department(\s*name)?$/.test(h)) { deptIdx = c; continue; }
    if (/บทบาท|ตำแหน่ง|role|position/.test(h)) { roleIdx = c; continue; }
    if (!/รหัส|code|pin|pass/.test(h)) continue;

    // ตรวจ "หัวหน้างาน" ก่อน "หัวหน้า" เพราะข้อความซ้อนกัน
    if (/หัวหน้างาน|foreman|supervisor|ผู้ควบคุม/.test(h)) foremanIdx = c;
    else if (/หัวหน้า|head/.test(h)) headIdx = c;
    else if (/ผู้จัดการ|ผู้ช่วย|รอง|manager|mgr|assistant|deputy|ผจก/.test(h)) mgrIdx = c;
    else if (pinIdx < 0) pinIdx = c;
  }
  if (deptIdx < 0) deptIdx = 0;

  const cell = function (row, idx) { return idx >= 0 ? String(row[idx] || '').trim() : ''; };
  const result = [];

  // 1) คอลัมน์แยกรหัสต่อบทบาท - บทบาทมาจากคอลัมน์ที่รหัสนั้นอยู่ ไม่ต้องพึ่งคอลัมน์ D
  if (foremanIdx >= 0 || headIdx >= 0 || mgrIdx >= 0) {
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const entry = {
        dept: cell(row, deptIdx),
        foremanPin: cell(row, foremanIdx),
        headPin: cell(row, headIdx),
        mgrPin: cell(row, mgrIdx),
        mgrRole: cell(row, roleIdx)
      };
      if (entry.dept || entry.foremanPin || entry.headPin || entry.mgrPin) result.push(entry);
    }
    return result;
  }

  // 2) หนึ่งแถวต่อผู้อนุมัติ: แผนก | รหัส | บทบาท
  if (roleIdx >= 0 && pinIdx >= 0) {
    const map = {};
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const dept = cell(row, deptIdx);
      const pin = cell(row, pinIdx);
      const roleText = cell(row, roleIdx);
      if (!dept && !pin) continue;
      if (!map[dept]) map[dept] = { dept: dept, foremanPin: '', headPin: '', mgrPin: '', mgrRole: '' };
      if (isForemanApproverPosition_(roleText)) map[dept].foremanPin += (map[dept].foremanPin ? ',' : '') + pin;
      else if (isManagerApproverPosition_(roleText)) map[dept].mgrPin += (map[dept].mgrPin ? ',' : '') + pin;
      else map[dept].headPin += (map[dept].headPin ? ',' : '') + pin;
      if (roleText) map[dept].mgrRole = roleText;
    }
    for (let k in map) result.push(map[k]);
    return result;
  }

  // 3) แบบเดิม: A=แผนก, B=รหัสผู้อนุมัติ, D=บทบาท (ไม่มีหัวคอลัมน์บทบาท = ใช้รหัสเดียวทุกบทบาท)
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const dept = cell(row, 0);
    const pin = cell(row, 1);
    const roleText = String(row[3] || '').trim();
    if (!dept && !pin) continue;
    result.push({ dept: dept, foremanPin: pin, headPin: pin, mgrPin: pin, mgrRole: roleText });
  }
  return result;
}

function isManagerApproverPosition_(value) {
  return /ผู้ช่วย|รอง|ผู้จัดการ|ผจก\.?|assistant|deputy|manager/i.test(String(value || ''));
}

function isHeadApproverPosition_(value) {
  const role = String(value || '').trim();
  return !/หัวหน้างาน|foreman|supervisor/i.test(role) &&
    (/^หัวหน้า$|หัวหน้าแผนก|หัวหน้าฝ่าย|หัวหน้าส่วน|หน\.?\s*แผนก|head\s*of\s*department/i.test(role));
}

function isForemanApproverPosition_(value) {
  return /หัวหน้างาน|foreman|supervisor|ผู้ควบคุม/i.test(String(value || ''));
}

/** รายชื่อแผนกที่ตั้งค่าหัวหน้าไว้ในชีตผู้อนุมัติ */
function getApprovalDepartments() {
  try {
    const sheet = findApproveSheet_();
    if (!sheet) {
      // Fallback: ดึงรายชื่อแผนกจาก sh_employee
      const empRes = getEmployeeList();
      if (empRes && empRes.ok && Array.isArray(empRes.data) && empRes.data.length > 0) {
        const empDepts = Array.from(new Set(empRes.data.map(e => String(e.dept || '').trim()).filter(Boolean))).sort();
        if (empDepts.length > 0) return { ok: true, data: empDepts, sheetName: 'sh_employee ( fallback )' };
      }
      const ss = getSpreadsheet_(false);
      return {
        ok: false, data: [],
        message: 'ไม่พบแท็บ ' + APPROVE_SHEET_NAME + ' ในไฟล์ ' + ss.getName() +
                 ' (แท็บที่พบ: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', ') + ')'
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      // Fallback: ดึงรายชื่อแผนกจาก sh_employee
      const empRes = getEmployeeList();
      if (empRes && empRes.ok && Array.isArray(empRes.data) && empRes.data.length > 0) {
        const empDepts = Array.from(new Set(empRes.data.map(e => String(e.dept || '').trim()).filter(Boolean))).sort();
        if (empDepts.length > 0) return { ok: true, data: empDepts, sheetName: 'sh_employee ( fallback )' };
      }
      return { ok: false, data: [], message: 'แท็บ ' + sheet.getName() + ' ไม่มีรายชื่อแผนกตั้งแต่แถว 2' };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    const depts = values.map(function (r) { return String(r[0] || '').trim(); }).filter(Boolean);
    let unique = Array.from(new Set(depts)).sort();
    if (!unique.length) {
      // Fallback: ดึงรายชื่อแผนกจาก sh_employee
      const empRes = getEmployeeList();
      if (empRes && empRes.ok && Array.isArray(empRes.data) && empRes.data.length > 0) {
        unique = Array.from(new Set(empRes.data.map(e => String(e.dept || '').trim()).filter(Boolean))).sort();
      }
    }
    if (!unique.length) {
      return { ok: false, data: [], message: 'ไม่พบข้อมูลแผนกในคอลัมน์ A ของแท็บ ' + sheet.getName() };
    }
    return { ok: true, data: unique, sheetName: sheet.getName() };
  } catch (e) {
    return { ok: false, data: [], message: 'อ่านรายชื่อแผนกไม่สำเร็จ: ' + String(e && e.message || e) };
  }
}

/* =======================================================================
   การยืนยันตัวตนผู้อนุมัติ
   ======================================================================= */

/** รหัสผู้อนุมัติของบทบาทนี้ในแถวนี้ (ถ้าไม่มีคอลัมน์ของบทบาทนั้น ใช้รหัสที่มีอยู่แทน) */
function approverPinsForRole_(entry, roleKey) {
  const own = String((entry && entry[roleKey + 'Pin']) || '').trim();
  if (own) return own.split(/[\s,;\/\n\r]+/).filter(Boolean);
  return ['foremanPin', 'headPin', 'mgrPin']
    .reduce(function (acc, k) {
      return acc.concat(String((entry && entry[k]) || '').split(/[\s,;\/\n\r]+/).filter(Boolean));
    }, []);
}

/** คอลัมน์บทบาทในแถวนี้อนุญาตให้ยืนยันตัวตนในบทบาทที่ขอหรือไม่ (ไม่มีบทบาท = ใช้ได้ทุกบทบาท) */
function approverRoleAllows_(entry, roleKey) {
  const text = String((entry && entry.mgrRole) || '').trim();
  if (!text) return true;
  if (isForemanApproverPosition_(text)) return roleKey === 'foreman';
  if (isManagerApproverPosition_(text)) return roleKey === 'mgr';
  if (isHeadApproverPosition_(text)) return roleKey === 'head';
  return true;
}

/**
 * หาแถวผู้อนุมัติที่ตรงกับแผนก + รหัส + บทบาท
 * ลำดับการค้น: แผนกตรงทั้งหมด > แผนกคล้าย > แถวที่ไม่ระบุแผนก (ทั้งหมด/ทั่วไป)
 * @return {?Object}
 */
function findApproverEntry_(dept, code, roleKey) {
  const key = approverCodeKey_(code);
  if (!key) return null;

  const all = getApproveSheetData_();
  if (!all.length) return null;

  const target = String(dept || '').trim().toLowerCase();
  const exact = all.filter(function (r) { return String(r.dept || '').trim().toLowerCase() === target; });
  const loose = all.filter(function (r) {
    return exact.indexOf(r) === -1 && deptMatch_(r.dept, dept);
  });
  const global = all.filter(function (r) {
    return !r.dept || /ทั้งหมด|ทั่วไป|all|default/i.test(r.dept);
  });

  const pools = [exact, loose, global];
  for (let p = 0; p < pools.length; p++) {
    const hit = pools[p].find(function (r) {
      if (!approverRoleAllows_(r, roleKey)) return false;
      return approverPinsForRole_(r, roleKey).some(function (pin) {
        return approverCodeKey_(pin) === key;
      });
    });
    if (hit) return hit;
  }
  return null;
}

/**
 * เทียบชื่อแผนก: ตรงตัวก่อน ถ้าไม่ตรงค่อยใช้การค้นหาแบบเป็นส่วนหนึ่ง
 * @param {string} a
 * @param {string} b
 * @return {boolean}
 */
function deptMatch_(a, b) {
  a = String(a || '').trim().toLowerCase();
  b = String(b || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

/** Normalize codes copied from Sheet display values and typed into the login form. */
function approverCodeKey_(value) {
  const raw = String(value == null ? '' : value).toLowerCase()
    .replace(/[\s,\u00a0\u200b-\u200d\ufeff']/g, '')
    .replace(/\.0+$/, '');
  // 001 กับ 1 คือคนเดียวกัน เก็บค่าไว้ให้ผู้ใช้พิมพ์ได้ทั้งสองแบบ
  return /^\d+$/.test(raw) ? raw.replace(/^0+(?=\d)/, '') : raw;
}

/**
 * ตรวจว่ารหัสพนักงานที่กรอกมาอยู่ในแผนกที่เลือกและตรงกับบทบาทที่ขอหรือไม่
 * @param {string} dept แผนกที่เลือก
 * @param {string} code รหัสพนักงานที่กรอก
 * @param {string=} roleKey บทบาท foreman | head | mgr
 * @return {{ok:boolean, emp:Object, message:string, warn:string}}
 */
function verifyDeptHead_(dept, code, roleKey) {
  dept = String(dept || '').trim();
  code = String(code || '').trim();
  const role = APPROVER_ROLES.indexOf(String(roleKey || '')) !== -1 ? String(roleKey) : '';
  const label = ROLE_LABEL[role] || ROLE_LABEL.head;

  if (role === 'admin') {
    if (!code) return { ok: false, emp: null, message: 'กรุณากรอกรหัสแอดมินหรือรหัสพนักงาน' };
    const adminEmp = findEmployeeByCode_(code);
    const adminName = adminEmp ? (((adminEmp.pre || '') + ' ' + (adminEmp.name || '')).trim() || adminEmp.code) : ('แอดมิน ' + code);
    return {
      ok: true,
      emp: adminEmp || { code: code, name: adminName, pre: '', dept: dept || 'ทั้งหมด' },
      warn: '',
      message: 'เข้าสู่ระบบผู้ดูแลระบบ (Admin) สำเร็จ'
    };
  }

  if (!dept) return { ok: false, emp: null, message: 'กรุณาเลือกแผนก' };
  if (!code) return { ok: false, emp: null, message: 'กรุณากรอกรหัสพนักงาน' + label };
  if (!role) return { ok: false, emp: null, message: 'บทบาทผู้อนุมัติไม่ถูกต้อง' };

  const entries = getApproveSheetData_();
  let matched = findApproverEntry_(dept, code, role);
  const emp = findEmployeeByCode_(code);

  if (!matched) {
    // หากค้นใน sh_approve ไม่เจอ ให้ลองตรวจกับ sh_employee (Fallback)
    if (emp) {
      const empDeptMatch = deptMatch_(emp.dept, dept);
      if (empDeptMatch || !entries.length || /ทั้งหมด|ทั่วไป|all/i.test(dept)) {
        return {
          ok: true,
          emp: emp,
          warn: !entries.length
            ? 'ยังไม่ได้ตั้งค่าชีตผู้อนุมัติ (sh_approve) ระบบจึงใช้ข้อมูลพนักงานในการยืนยันตัวตน'
            : 'เข้าสู่ระบบสำเร็จด้วยรหัสพนักงาน ' + emp.code + ' แผนก ' + (emp.dept || dept),
          message: 'เข้าสู่ระบบสำเร็จ (' + label + ')'
        };
      }
    }

    if (!entries.length) {
      return {
        ok: false, emp: null,
        message: 'ยังไม่มีข้อมูลผู้อนุมัติในชีต ' + APPROVE_SHEET_NAME + ' และไม่พบรหัสพนักงาน "' + code + '" ในข้อมูลพนักงาน'
      };
    }

    const inDept = entries.filter(function (r) { return deptMatch_(r.dept, dept); });
    const codesInDept = [];
    inDept.forEach(function (r) {
      if (!approverRoleAllows_(r, role)) return;
      approverPinsForRole_(r, role).forEach(function (pin) {
        if (codesInDept.indexOf(pin) === -1) codesInDept.push(pin);
      });
    });
    if (!inDept.length) {
      const names = entries.map(function (r) { return r.dept; }).filter(Boolean);
      return {
        ok: false, emp: null,
        message: 'ไม่พบแผนก "' + dept + '" ในชีตผู้อนุมัติ' + (names.length ? ' (แผนกที่มีอยู่: ' + names.join(', ') + ')' : '')
      };
    }
    return {
      ok: false, emp: null,
      message: 'รหัส "' + code + '" ไม่ใช่ผู้อนุมัติบทบาท' + label + ' ของแผนก ' + dept +
               (codesInDept.length ? ' (รหัสที่ตั้งไว้: ' + codesInDept.join(', ') + ')' : ' (ยังไม่ได้ตั้งรหัสสำหรับบทบาทนี้)')
    };
  }

  const finalEmp = emp || { code: code, name: '', pre: '', dept: matched.dept || dept };
  const warn = (role === 'foreman' && !String(matched.foremanPin || '').trim())
    ? 'ชีตผู้อนุมัติยังไม่ได้กรอกคอลัมน์ "รหัสหัวหน้างาน" จึงใช้รหัสผู้อนุมัติที่มีอยู่แทน'
    : '';

  return {
    ok: true,
    emp: finalEmp,
    warn: warn,
    message: 'ยืนยัน' + label + ' แผนก ' + (matched.dept || dept) + ' เรียบร้อยแล้ว'
  };
}

/** หาพนักงานจากรหัส (ใช้ทั้งฝั่ง server) */
function findEmployeeByCode_(code) {
  const key = approverCodeKey_(code);
  if (!key) return null;
  const res = getEmployeeList();
  if (!res || !res.ok || !Array.isArray(res.data)) return null;
  return res.data.find(function (e) { return e.code && approverCodeKey_(e.code) === key; }) || null;
}

/**
 * เข้าสู่ระบบหน้าอนุมัติตามแผนก (เลือกแผนก + กรอกรหัสพนักงาน)
 * ใช้ได้ทั้งหัวหน้างาน หัวหน้าแผนก และผู้ช่วย/รอง/ผู้จัดการ
 * @param {string} dept แผนกที่เลือก
 * @param {string} code รหัสพนักงานผู้อนุมัติ
 * @param {string=} roleKey บทบาท foreman | head | mgr (ค่าเริ่มต้น head)
 * @return {{ok:boolean, approver:Object, message:string, warn:string}}
 */
function loginDeptHead(dept, code, roleKey) {
  const role = APPROVER_ROLES.indexOf(String(roleKey || '')) !== -1 ? String(roleKey) : 'head';
  const chk = verifyDeptHead_(dept, code, role);
  if (!chk.ok) return { ok: false, message: chk.message, warn: '' };

  const emp = chk.emp;
  const name = ((emp.pre || '') + ' ' + (emp.name || '')).trim() || ('รหัส ' + String(code).trim());

  return {
    ok: true,
    approver: {
      code: String(code).trim(),
      name: name,
      dept: String(dept).trim(),
      role: role,
      roleName: ROLE_LABEL[role]
    },
    message: chk.message,
    warn: chk.warn || ''
  };
}

/* =======================================================================
   ข้อมูลพนักงาน / ใบลา
   ======================================================================= */

/** ดึง Spreadsheet: ผูกกับสคริปต์ > ID ที่เก็บไว้ > (ถ้า create=true) สร้างใหม่ */
function getSpreadsheet_(create) {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  if (!create) throw new Error('ยังไม่ได้สร้างฐานข้อมูล กรุณารัน initDatabase() ก่อน');
  const ss = SpreadsheetApp.create('ใบลา CM 2 - ฐานข้อมูล');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

/**
 * ตรวจสอบสิทธิ์การเข้าถึงโฟลเดอร์เก็บลายเซ็น (รันจากตัวแก้ไขแล้วดูผลที่ View > Logs)
 * @return {{ok:boolean, canRead:boolean, canWrite:boolean, name:string, url:string, user:string, message:string}}
 */
function checkFolderAccess() {
  const r = { ok: false, canRead: false, canWrite: false, name: '', url: '', user: '', message: '' };
  try { r.user = Session.getEffectiveUser().getEmail(); } catch (e) {}

  try {
    const folder = DriveApp.getFolderById(SIGNATURE_FOLDER_ID);
    r.canRead = true;
    r.name = folder.getName();
    r.url = folder.getUrl();
    try {
      const t = folder.createFile('_access_test.txt', 'test');
      t.setTrashed(true);
      r.canWrite = true;
      r.ok = true;
      r.message = 'เข้าถึงโฟลเดอร์ได้ และมีสิทธิ์เขียนไฟล์';
    } catch (e) {
      r.message = 'อ่านโฟลเดอร์ได้ แต่ไม่มีสิทธิ์เขียนไฟล์ - ขอสิทธิ์ Editor ให้บัญชี ' + r.user;
    }
  } catch (e) {
    const msg = String(e.message);
    if (/permission to call|authorization/i.test(msg)) {
      r.message = 'สคริปต์ยังไม่ได้รับอนุญาตให้ใช้ Drive - รันฟังก์ชันจากตัวแก้ไข กด Review permissions > Allow ' +
                  'และตรวจว่า appsscript.json มี scope https://www.googleapis.com/auth/drive : ' + msg;
    } else {
      r.message = 'เข้าถึงโฟลเดอร์ไม่ได้ (ID ผิด หรือบัญชี ' + r.user + ' ยังไม่ได้รับสิทธิ์): ' + msg;
    }
  }
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

/** บันทึกลายเซ็น (PNG dataURL) ลงโฟลเดอร์ แล้วคืนลิงก์ */
function saveSignatures_(sigs, id) {
  const out = { app: '', foreman: '', head: '', mgr: '', warn: '' };
  const keys = ['app', 'foreman', 'head', 'mgr'].filter(function (k) { return sigs && sigs[k]; });
  if (!keys.length) return out;

  let folder;
  try {
    folder = DriveApp.getFolderById(SIGNATURE_FOLDER_ID);
  } catch (e) {
    out.warn = 'เก็บลายเซ็นไม่ได้ เพราะเข้าถึงโฟลเดอร์ไม่ได้ (รัน checkFolderAccess() เพื่อตรวจสอบสิทธิ์)';
    return out;
  }

  const prefix = 'data:image/png;base64,';
  keys.forEach(function (k) {
    try {
      const str = String(sigs[k]);
      if (str.indexOf(prefix) !== 0 || str.length > 2000000) throw new Error('invalid image');
      const blob = Utilities.newBlob(Utilities.base64Decode(str.slice(prefix.length)), 'image/png', id + '_' + k + '.png');
      out[k] = toDirectLink_(folder.createFile(blob).getId());
    } catch (e) {
      out.warn = 'บันทึกลายเซ็นบางรายการไม่สำเร็จ';
    }
  });
  return out;
}

/** แปลง File ID เป็นลิงก์ตรงสำหรับแสดงรูป (รูปแบบ lh5) */
function toDirectLink_(fileId) {
  return 'https://lh5.googleusercontent.com/d/' + fileId;
}

function testDrive() {
  Logger.log(DriveApp.getRootFolder().getName());
}

/**
 * ดึงข้อมูลพนักงานจาก Sheet (รองรับ sheet: sh_employee, employee, Employee ฯลฯ)
 * @return {{ok:boolean, data:Array<{code:string, pre:string, name:string, dept:string, emp:string, to:string}>, message:string, sheetName:string}}
 */
function getEmployeeList() {
  try {
    const ss = getSpreadsheet_(false);
    const possibleNames = [EMPLOYEE_SHEET_NAME, 'employee', 'Employee', 'EMPLOYEE', 'พนักงาน'];
    let sheet = null;

    for (let i = 0; i < possibleNames.length; i++) {
      sheet = ss.getSheetByName(possibleNames[i]);
      if (sheet) break;
    }

    if (!sheet) {
      const sheets = ss.getSheets();
      for (let j = 0; j < sheets.length; j++) {
        if (/employee|sh_employee|พนักงาน/i.test(sheets[j].getName())) {
          sheet = sheets[j];
          break;
        }
      }
    }

    if (!sheet) {
      return { ok: false, data: [], message: 'ไม่พบ Sheet sh_employee หรือ employee' };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      return { ok: true, data: [], message: 'ไม่มีข้อมูลใน Sheet ' + sheet.getName(), sheetName: sheet.getName() };
    }

    const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = values[0].map(function (h) { return String(h || '').trim(); });
    const clean = function (v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); };

    const findIdx = function (keywords) {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase();
        for (let k = 0; k < keywords.length; k++) {
          if (h.indexOf(keywords[k].toLowerCase()) !== -1) return i;
        }
      }
      return -1;
    };

    const codeIdx = findIdx(['รหัส', 'code', 'id']);
    const preIdx = findIdx(['คำนำหน้า', 'prefix', 'title']);
    const nameIdx = findIdx(['ชื่อ', 'name', 'fullname']);
    const deptIdx = findIdx(['แผนก', 'ฝ่าย', 'dept', 'department']);
    let empIdx = findIdx(['ประเภท', 'type', 'emptype']);
    if (empIdx === -1 && lastCol >= 5) empIdx = 4;
    const toIdx = findIdx(['เรียน', 'ผู้บังคับบัญชา', 'to', 'manager']);

    const employees = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const code = codeIdx >= 0 ? clean(row[codeIdx]) : '';
      const name = nameIdx >= 0 ? clean(row[nameIdx]) : '';

      if (!code && !name) continue;

      let empType = empIdx >= 0 ? clean(row[empIdx]) : '';
      if (empType === 'รายเหมา') empType = 'ต่างด้าว';

      employees.push({
        code: code,
        pre: preIdx >= 0 ? clean(row[preIdx]) : '',
        name: name,
        dept: deptIdx >= 0 ? clean(row[deptIdx]) : '',
        emp: empType,
        to: toIdx >= 0 ? clean(row[toIdx]) : ''
      });
    }

    return { ok: true, data: employees, sheetName: sheet.getName() };
  } catch (e) {
    return { ok: false, data: [], message: String(e.message || e) };
  }
}

/**
 * เข้าสู่ระบบสำหรับผู้อนุมัติด้วยรหัสพนักงาน (เก็บไว้เพื่อความเข้ากันได้ แนะนำให้ใช้ loginDeptHead)
 * @param {string} code รหัสพนักงานผู้อนุมัติ
 * @param {string} pin รหัสผ่าน PIN (ถ้ามี)
 * @return {{ok:boolean, approver:Object, message:string}}
 */
function loginApprover(code, pin) {
  code = String(code || '').trim();
  pin = String(pin || '').trim();

  if (!code) return { ok: false, message: 'กรุณากรอกรหัสพนักงาน' };

  const emp = findEmployeeByCode_(code);
  if (!emp) return { ok: false, message: 'ไม่พบรหัสพนักงานนี้ในข้อมูลพนักงาน' };

  if (pin) {
    const ok = APPROVER_ROLES.some(function (role) {
      return findApproverEntry_(emp.dept, pin, role) !== null;
    });
    if (!ok) return { ok: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  }

  const name = ((emp.pre || '') + ' ' + (emp.name || '')).trim() || ('พนักงานรหัส ' + code);
  const isMgr = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก/i.test(emp.to) || /ผู้จัดการ|ผจก/i.test(name);
  const role = isMgr ? 'mgr' : 'head';

  return {
    ok: true,
    approver: {
      code: code,
      name: name,
      dept: emp.dept,
      role: role,
      roleName: ROLE_LABEL[role],
      isHead: role === 'head',
      isMgr: role === 'mgr',
      isForeman: role === 'foreman'
    },
    message: 'เข้าสู่ระบบสำเร็จ'
  };
}

/** รับเฉพาะสถานะที่เลือกได้จากหน้าเว็บ */
function approvalValue_(value) {
  value = String(value || '');
  return (value === 'อนุมัติ' || value === 'ไม่อนุมัติ') ? value : '';
}

/**
 * สถานะใบลา: หัวหน้าแผนก -> ผู้ช่วย/รอง/ผู้จัดการ
 * หัวหน้างานไม่เป็นขั้นตอนบังคับ แต่ถ้าไม่อนุมัติ ใบลาจะถือว่าไม่อนุมัติทั้งฉบับ
 */
function leaveStatus_(headApproval, mgrApproval, foremanApproval, empType, empTo) {
  const head = String(headApproval || '').trim();
  const mgr = String(mgrApproval || '').trim();
  const foreman = String(foremanApproval || '').trim();
  const type = String(empType || '').trim();
  const to = String(empTo || '').trim();

  if (head === 'ไม่อนุมัติ' || mgr === 'ไม่อนุมัติ' || foreman === 'ไม่อนุมัติ') return 'ไม่อนุมัติ';

  const isHeadRequest = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก|manager/i.test(to);
  const isDaily = /รายวัน/.test(type);

  const waiting = [];
  if (isHeadRequest) {
    if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);
  } else if (isDaily) {
    if (foreman !== 'อนุมัติ') waiting.push(ROLE_LABEL.foreman);
    if (head !== 'อนุมัติ') waiting.push(ROLE_LABEL.head);
    if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);
  } else {
    if (head !== 'อนุมัติ') waiting.push(ROLE_LABEL.head);
    if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);
  }

  if (waiting.length === 0) return 'อนุมัติ';
  return 'รออนุมัติ (' + waiting.join(', ') + ')';
}

/** แสดงรายการใบลาของแผนกหนึ่งแผนก (ใช้ร่วมกันทั้งหน้าอนุมัติและหน้าดู PDF) */
function readLeaveRows_() {
  const ss = getSpreadsheet_(false);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const width = Math.min(Math.max(HEADERS.length, sheet.getLastColumn()), sheet.getMaxColumns());
  const values = sheet.getRange(1, 1, sheet.getLastRow(), width).getDisplayValues();
  const headerIndexes = {};
  values[0].forEach(function (h, i) {
    const key = String(h || '').trim();
    if (key && !Object.prototype.hasOwnProperty.call(headerIndexes, key)) headerIndexes[key] = i;
  });
  return { values: values, headerIndexes: headerIndexes, sheet: sheet };
}

function readCell_(row, headerIndexes, header, fallbackIndex) {
  const idx = Object.prototype.hasOwnProperty.call(headerIndexes, header) ? headerIndexes[header] : fallbackIndex;
  return String(row[idx] == null ? '' : row[idx]).trim();
}

/**
 * ดึงรายการใบลาสำหรับหน้าอนุมัติ (โหมดอ่านอย่างเดียว + บันทึกผลการพิจารณา)
 * @param {string} approverCode รหัสพนักงานผู้อนุมัติ
 * @param {string=} dept ถ้าระบุ จะดึงเฉพาะใบลาของแผนกนี้
 * @param {string=} role บทบาทที่กำลังเข้าดู
 * @return {{ok:boolean, data:Array<Object>}}
 */
function getLeavesForApproval(approverCode, dept, role) {
  try {
    const read = readLeaveRows_();
    if (!read) return { ok: true, data: [] };

    const onlyDept = String(dept || '').trim();
    const approverRole = String(role || 'head').trim().toLowerCase();

    // ตรวจสิทธิ์ซ้ำทุกครั้ง เพื่อไม่ให้อ่านใบลาของแผนกอื่นผ่านการแก้ค่าในเบราว์เซอร์
    if (APPROVER_ROLES.indexOf(approverRole) === -1) {
      return { ok: false, data: [], message: 'บทบาทผู้อนุมัติไม่ถูกต้อง' };
    }
    const chk = verifyDeptHead_(onlyDept, approverCode, approverRole);
    if (!chk.ok) return { ok: false, data: [], message: chk.message };

    const values = read.values;
    const leaves = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const id = String(row[0] || '').trim();
      if (!id) continue;

      if (onlyDept) {
        const rowDept = String(row[9] || '').trim();
        if (rowDept.toLowerCase() !== onlyDept.toLowerCase() && !deptMatch_(rowDept, onlyDept)) continue;
      }

      const headApproval = String(row[31] || '').trim();
      const mgrApproval = String(row[32] || '').trim();
      const foremanApproval = String(row[34] || '').trim();
      const empType = String(row[3] || '').trim();
      const empTo = String(row[5] || '').trim();
      
      const isHeadRequest = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก|manager/i.test(empTo);
      const isDaily = /รายวัน/.test(empType);

      if (approverRole === 'mgr' && !isHeadRequest && headApproval !== 'อนุมัติ') continue;
      if (approverRole === 'head' && isDaily && foremanApproval !== 'อนุมัติ') continue;
      if (approverRole === 'head' && isHeadRequest) continue;
      // approverRole === 'admin' หรือ foreman จะเห็นทุกรายการของแผนก (หรือทุกแผนก)

      const stats = [];
      for (let i = 18; i < 28; i++) stats.push(row[i] || '');

      leaves.push({
        id: id,
        now: row[1] || '',
        status: leaveStatus_(headApproval, mgrApproval, foremanApproval, empType, empTo),
        emp: row[3] || '',
        fdate: row[4] || '',
        to: row[5] || '',
        pre: row[6] || '',
        name: row[7] || '',
        code: row[8] || '',
        dept: row[9] || '',
        type: row[10] || '',
        why: row[11] || '',
        d1: row[12] || '',
        d2: row[13] || '',
        t1: readCell_(row, read.headerIndexes, 'เวลาเริ่ม', 14),
        t2: readCell_(row, read.headerIndexes, 'เวลาสิ้นสุด', 15),
        qty: readCell_(row, read.headerIndexes, 'รวมจำนวน', 16),
        unit: readCell_(row, read.headerIndexes, 'หน่วย', 17),
        stats: stats,
        sigApp: row[28] || '',
        sigHead: row[29] || '',
        sigMgr: row[30] || '',
        sigForeman: row[33] || '',
        headApproval: headApproval,
        mgrApproval: mgrApproval,
        foremanApproval: foremanApproval
      });
    }

    leaves.reverse();
    return { ok: true, data: leaves };
  } catch (e) {
    return { ok: false, data: [], message: String(e.message || e) };
  }
}

/** ส่งข้อมูลใบลาให้หน้าพิมพ์ PDF */
function getApprovedLeavePdfData(id, approverCode, dept, role) {
  const read = readLeaveRows_();
  if (!read) throw new Error('ไม่พบรายการใบลา');

  const row = read.values.slice(1).find(function (r) {
    return String(r[0] || '').trim() === String(id || '').trim();
  });
  if (!row) throw new Error('ไม่พบรายการใบลารหัส ' + id);

  const leaveDept = String(row[9] || '').trim();

  function signatureData(link) {
    const linkStr = String(link || '').trim();
    if (!linkStr) return '';
    if (linkStr.indexOf('data:image/') === 0) return linkStr;
    if (/^[A-Za-z0-9+/=]{100,}$/.test(linkStr)) {
      return 'data:image/png;base64,' + linkStr;
    }
    let id = '';
    const m1 = linkStr.match(/[?&]id=([^&]+)/);
    const m2 = linkStr.match(/\/d\/([^\/]+)/);
    const m3 = linkStr.match(/^[\w-]{20,}$/);
    if (m1) id = m1[1];
    else if (m2) id = m2[1];
    else if (m3) id = m3[0];

    if (!id) return '';
    // ตัดส่วนท้าย "=ขนาดรูป" ออก (เช่น lh3.googleusercontent.com/d/xxx=w1000) เหลือเฉพาะ File ID
    const fileId = decodeURIComponent(id).replace(/=.*$/, '');
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      Logger.log('signatureData error for file ' + id + ': ' + e);
      return '';
    }
  }

  let approverName = String(approverCode || '').trim();
  try {
    const roleKey = String(role || '').trim().toLowerCase();
    const chk = verifyDeptHead_(dept, approverCode, roleKey);
    if (chk && chk.emp) {
      approverName = ((chk.emp.pre || '') + ' ' + (chk.emp.name || '')).trim() || approverName;
    }
  } catch (e) {}

  // ชื่อผู้ที่อนุมัติจริง (บันทึกไว้ตอนกดอนุมัติ) มาก่อนชื่อที่ตั้งไว้ใน sh_approve
  const deptNames = approverNamesForDept_(leaveDept);
  const approverNames = {};
  ['foreman', 'head', 'mgr'].forEach(function (roleKey) {
    const headerName = APPROVER_NAME_HEADERS[roleKey];
    const idx = headerName ? read.headerIndexes[headerName] : null;
    const saved = idx == null ? '' : String(row[idx] || '').trim();
    approverNames[roleKey] = saved || deptNames[roleKey] || '';
  });

  return {
    id: row[0], submitted: row[4], employeeType: row[3], to: row[5], prefix: row[6], name: row[7], code: row[8], dept: row[9],
    leaveType: row[10], reason: row[11], fromDate: row[12], toDate: row[13], fromTime: row[14], toTime: row[15], qty: row[16], unit: row[17],
    stats: row.slice(18, 28),
    foremanApproval: row[34],
    headApproval: row[31],
    mgrApproval: row[32],
    sigApplicant: signatureData(row[28]),
    sigApp: signatureData(row[28]),
    sigForeman: signatureData(row[33]),
    sigHead: signatureData(row[29]),
    sigManager: signatureData(row[30]),
    sigMgr: signatureData(row[30]),
    approverNames: approverNames,
    approverName: approverName
  };
}

/**
 * หา/สร้างคอลัมน์ชื่อผู้ที่อนุมัติจริงในชีตใบลา
 * (ชีตเดิมที่สร้างก่อนมีคอลัมน์เหล่านี้ จะถูกเติมหัวคอลัมน์ให้โดยไม่ทับข้อมูลเดิม)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {{foreman:number, head:number, mgr:number}} หมายเลขคอลัมน์ (1-indexed)
 */
function ensureApproverNameColumns_(sheet) {
  const map = { foreman: 0, head: 0, mgr: 0 };
  if (!sheet) return map;

  let lastCol = Math.max(sheet.getLastColumn(), 1);
  let headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  APPROVER_ROLES.forEach(function (roleKey) {
    const wanted = APPROVER_NAME_HEADERS[roleKey];
    let col = -1;
    for (let c = 0; c < headerRow.length; c++) {
      if (String(headerRow[c] || '').trim() === wanted) { col = c + 1; break; }
    }

    if (col === -1) {
      // ใช้ตำแหน่งมาตรฐานถ้ายังว่าง มิฉะนั้นต่อท้ายตารางเพื่อไม่ให้ทับข้อมูลเดิม
      const preferred = APPROVER_NAME_DEFAULT_COL[roleKey];
      const occupied = preferred <= lastCol && String(headerRow[preferred - 1] || '').trim();
      col = occupied ? lastCol + 1 : preferred;
      if (sheet.getMaxColumns() < col) {
        // คลาส Sheet ไม่มี setMaxColumns จึงขยายกริดด้วยการเพิ่มคอลัมน์ต่อท้าย (ไม่กระทบข้อมูลเดิม)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
      }

      sheet.getRange(1, col).setValue(wanted)
          .setFontWeight('bold').setBackground('#1f5fbf').setFontColor('#ffffff');
      sheet.setColumnWidth(col, 150);
      sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');

      headerRow[col - 1] = wanted;
      lastCol = Math.max(lastCol, col);
    }
    map[roleKey] = col;
  });

  return map;
}

/** ชื่อผู้อนุมัติแต่ละบทบาทของแผนก (ใช้เติมช่องลงชื่อใน PDF) */
function approverNamesForDept_(dept) {
  const out = { foreman: '', head: '', mgr: '' };
  const target = String(dept || '').trim().toLowerCase();
  if (!target) return out;

  const entries = getApproveSheetData_();
  const matched = entries.find(function (r) {
    return deptMatch_(r.dept, target) || String(r.dept || '').trim().toLowerCase() === target;
  });
  if (!matched) return out;

  APPROVER_ROLES.forEach(function (role) {
    const pins = approverPinsForRole_(matched, role);
    for (let i = 0; i < pins.length; i++) {
      const emp = findEmployeeByCode_(pins[i]);
      if (emp && emp.name) {
        out[role] = ((emp.pre || '') + ' ' + emp.name).trim();
        return;
      }
    }
    if (!out[role] && pins.length) out[role] = pins[0];
  });
  return out;
}

/**
 * บันทึกผลการพิจารณาอนุมัติใบลาจากหน้า อนุมัติ
 * @param {Object} d {id, approverCode, role, approvalStatus, sigData, dept}
 * @return {{ok:boolean, message:string}}
 */
function updateLeaveApproval(d) {
  if (!d || !d.id || !d.role || !d.approvalStatus) {
    throw new Error('ข้อมูลไม่ครบถ้วน');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = getSpreadsheet_(false);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('ไม่พบ Sheet ' + SHEET_NAME);

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('ไม่พบรายการใบลา');

    const ids = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
    let rowIndex = -1;

    for (let r = 1; r < ids.length; r++) {
      if (String(ids[r][0] || '').trim() === String(d.id).trim()) {
        rowIndex = r + 1; // 1-indexed
        break;
      }
    }

    if (rowIndex === -1) throw new Error('ไม่พบรายการใบลารหัส ' + d.id);

    const role = String(d.role).toLowerCase();
    if (APPROVER_ROLES.indexOf(role) === -1) throw new Error('บทบาทผู้อนุมัติไม่ถูกต้อง');

    const appStatus = approvalValue_(d.approvalStatus);
    if (!appStatus) throw new Error('ผลการพิจารณาไม่ถูกต้อง');

    // ผู้อนุมัติทุกบทบาทอนุมัติได้เฉพาะใบลาของแผนกตัวเอง
    if (!d.dept) throw new Error('ไม่พบแผนกของผู้อนุมัติ');
    const chk = verifyDeptHead_(d.dept, d.approverCode, role);
    if (!chk.ok) throw new Error(chk.message);

    const leaveDept = sheet.getRange(rowIndex, COL.DEPT).getDisplayValue();
    if (String(leaveDept || '').trim().toLowerCase() !== String(d.dept || '').trim().toLowerCase() &&
        !deptMatch_(leaveDept, d.dept)) {
      throw new Error('ใบลารหัส ' + d.id + ' เป็นของแผนก ' + (leaveDept || '-') + ' ไม่ใช่แผนก ' + d.dept);
    }

    const oldHeadApp = String(sheet.getRange(rowIndex, COL.HEAD_RESULT).getDisplayValue() || '').trim();
    const oldMgrApp = String(sheet.getRange(rowIndex, COL.MGR_RESULT).getDisplayValue() || '').trim();
    const oldForemanApp = String(sheet.getRange(rowIndex, COL.FOREMAN_RESULT).getDisplayValue() || '').trim();
    const empType = String(sheet.getRange(rowIndex, 4).getDisplayValue() || '').trim();
    const empTo = String(sheet.getRange(rowIndex, 6).getDisplayValue() || '').trim();
    
    const isHeadRequest = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก|manager/i.test(empTo);
    const isDaily = /รายวัน/.test(empType);

    if (role === 'mgr' && !isHeadRequest && oldHeadApp !== 'อนุมัติ') {
      throw new Error(ROLE_LABEL.head + 'ยังไม่อนุมัติ ใบลานี้จึงยังไม่ส่งให้' + ROLE_LABEL.mgr + 'พิจารณา');
    }
    if (role === 'head' && isDaily && oldForemanApp !== 'อนุมัติ') {
      throw new Error(ROLE_LABEL.foreman + 'ยังไม่อนุมัติ ใบลานี้จึงไม่ส่งต่อให้' + ROLE_LABEL.head + 'พิจารณา');
    }
    if (role === 'head' && isHeadRequest) {
      throw new Error('ระดับหัวหน้างาน ต้องให้ ' + ROLE_LABEL.mgr + ' เป็นผู้อนุมัติ');
    }

    const RESULT_COL = { foreman: COL.FOREMAN_RESULT, head: COL.HEAD_RESULT, mgr: COL.MGR_RESULT };
    const SIG_COL = { foreman: COL.FOREMAN_SIG, head: COL.HEAD_SIG, mgr: COL.MGR_SIG };

    if (d.sigData) {
      const links = saveSignatures_({ [role]: d.sigData }, d.id);
      if (links[role]) sheet.getRange(rowIndex, SIG_COL[role]).setValue(links[role]);
    }

    sheet.getRange(rowIndex, RESULT_COL[role]).setValue(appStatus);

    // เก็บชื่อผู้ที่อนุมัติจริงไว้เติมช่องลงชื่อใน PDF (แทนชื่อนิ่งจาก sh_approve)
    const nameCol = ensureApproverNameColumns_(sheet)[role];
    const approverFullName = ((((chk.emp && chk.emp.pre) || '') + ' ' + ((chk.emp && chk.emp.name) || '')).trim())
      || String(d.approverCode || '').trim();
    if (nameCol && approverFullName) {
      sheet.getRange(rowIndex, nameCol).setValue(approverFullName);
    }

    const newHeadApp = role === 'head' ? appStatus : oldHeadApp;
    const newMgrApp = role === 'mgr' ? appStatus : oldMgrApp;
    const newForemanApp = role === 'foreman' ? appStatus : oldForemanApp;
    const newStatus = leaveStatus_(newHeadApp, newMgrApp, newForemanApp, empType, empTo);
    sheet.getRange(rowIndex, COL.STATUS).setValue(newStatus);

    return {
      ok: true,
      id: d.id,
      role: role,
      status: newStatus,
      message: 'บันทึกการอนุมัติเรียบร้อยแล้ว'
    };
  } finally {
    lock.releaseLock();
  }
}

/** ?????????? HTML ??????????????????????????? iframe Modal ?????????????? URL */
function getReportHtmlContent() {
  return HtmlService.createHtmlOutputFromFile('report').getContent();
}
