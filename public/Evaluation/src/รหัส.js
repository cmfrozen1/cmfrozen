/**
 * ============================================================
 *  API endpoint (POST เท่านั้น) — หน้าเว็บโฮสต์ที่อื่น (Vercel)
 *  ไม่มี doGet แล้ว: หน้าเว็บไม่ได้ serve จาก GAS
 * ============================================================
 *  ฟอร์มภายนอกส่ง POST { action: 'ชื่อฟังก์ชัน', arg0..argN }
 *  แบบ FormData (multipart) -> e.parameter
 *  ตัวเลข/อาร์เรย์/อ็อบเจกต์ ต้อง JSON.stringify มาก่อน
 *
 *  Deploy เป็น Web App (Execute as: Me, Who has access: Anyone)
 *  แล้วนำ URL ที่ได้ไปใส่ใน index.html ที่ตัวแปร WEB_APP_URL
 */
function doPost(e) {
  try {
    var action = e.parameter.action;
    var args = [];
    for (var i = 0; e.parameter['arg' + i] !== undefined; i++) {
      args.push(parseApiArg_(e.parameter['arg' + i]));
    }

    var result;
    switch (action) {
      case 'verifySupervisorLogin':
        result = verifySupervisorLogin(args[0], args[1]);
        break;
      case 'getTotalPendingCount':
        result = getTotalPendingCount(args[0]);
        break;
      case 'getPendingTasks':
        result = getPendingTasks();
        break;
      case 'getTaskById':
        result = getTaskById(args[0]);
        break;
      case 'saveTraineeData':
        result = saveTraineeData(args[0]);
        break;
      case 'saveSupervisorData':
        result = saveSupervisorData(args[0], args[1]);
        break;
      case 'deleteRecord':
        result = deleteRecord(args[0]);
        break;
      case 'getDepartments':
        result = getDepartments();
        break;
      case 'getReportSummaryHtml':
        result = getReportSummaryHtml(args[0], args[1], args[2]);
        break;
      default:
        return jsonOutput_({ __error: 'Unknown action: ' + action });
    }

    return jsonOutput_({ result: result });
  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonOutput_({ __error: err.toString() });
  }
}

/** แปลงค่าจาก FormData: ถ้าเป็น JSON (อาร์เรย์/อ็อบเจกต์/ตัวเลข) ให้ parse กลับ */
function parseApiArg_(raw) {
  var s = String(raw);
  if (s === '') return s;
  var c = s.charAt(0);
  if (c === '[' || c === '{' || c === '"' || c === 't' || c === 'f' || c === 'n') {
    try {
      return JSON.parse(s);
    } catch (e) { }
  }
  return s;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชัน Debug - รันตรงจาก GAS Editor เพื่อวินิจฉัยปัญหา
 * ไปที่ Editor > เลือกฟังก์ชัน debugSheetData > กดปุ่ม ▶ Run
 * ผล: จะขึ้น Alert popup แสดงข้อมูลของชีตโดยตรง
 */
function debugSheetData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();
  var sheetNames = allSheets.map(function (s) { return s.getName(); });

  var msg = '=== SHEETS: ' + sheetNames.join(', ') + '\n\n';

  var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
  msg += 'Using Sheet: "' + sheet.getName() + '"\n';
  msg += 'Last Row: ' + sheet.getLastRow() + '\n';
  msg += 'Last Col: ' + sheet.getLastColumn() + '\n\n';

  if (sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('NO DATA: ' + msg);
    return;
  }

  var lastCol = sheet.getLastColumn();
  // ดึงแค่แถวแรกของข้อมูล
  var row = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

  msg += 'ROW 2 has ' + row.length + ' columns\n';
  msg += 'LAST 6 COLUMNS:\n';
  for (var c = Math.max(0, row.length - 6); c < row.length; c++) {
    msg += '  col[' + c + '] = "' + String(row[c] || '') + '"\n';
  }

  // หา WAITING_SUPERVISOR
  var found = false;
  for (var c2 = 0; c2 < row.length; c2++) {
    if (String(row[c2]).indexOf('WAITING') !== -1 || String(row[c2]).indexOf('COMPLETED') !== -1) {
      msg += '\n>>> STATUS FOUND at col[' + c2 + '] = "' + row[c2] + '"';
      found = true;
    }
  }
  if (!found) {
    msg += '\n>>> STATUS (WAITING_SUPERVISOR) NOT FOUND in row!';
  }

  SpreadsheetApp.getUi().alert(msg);
}


function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('แบบประเมิน')
    .addItem('เริ่มฐานข้อมูล (สร้างหัวคอลัมน์)', 'initDatabase')
    .addItem('เปิดฟอร์ม', 'showForm')
    .addItem('🔑 อนุมัติสิทธิ์ & ตรวจสอบ Google Drive', 'checkFolderPermission')
    .addToUi();
}

/** ID ของ Google Drive Folder สำหรับเก็บบันทึกลายเซ็นและไฟล์ PDF */
//var DRIVE_FOLDER_ID = '1yLm9IlpmazPLSlTCbn6NuSrvTmC3KHTr';
var DRIVE_FOLDER_ID = '153j28b_yVmdo-uRxqZVFS0VuqmXXcYtI';

/**
 * ดึงโฟลเดอร์เป้าหมายตาม ID หรือใช้/สร้างโฟลเดอร์สำรองให้อัตโนมัติหากเข้าถึง ID นั้นไม่ได้
 */
function getTargetFolder(folderId) {
  if (folderId && folderId.trim() !== '') {
    try {
      var folder = DriveApp.getFolderById(folderId.trim());
      return folder;
    } catch (err) {
      Logger.log("ไม่สามารถใช้ Folder ID (" + folderId + ") ได้: " + err.toString());
      if (err.toString().indexOf('DriveApp') !== -1 || err.toString().indexOf('permission') !== -1) {
        throw err;
      }
    }
  }

  // สำรอง: ใช้/สร้างโฟลเดอร์ "Evaluation_Signatures" ในไดรฟ์
  try {
    var rootFolders = DriveApp.getRootFolder().getFoldersByName("Evaluation_Signatures");
    if (rootFolders.hasNext()) {
      return rootFolders.next();
    } else {
      return DriveApp.createFolder("Evaluation_Signatures");
    }
  } catch (fallbackErr) {
    Logger.log("Error creating fallback folder: " + fallbackErr.toString());
    throw fallbackErr;
  }
}

/**
 * ฟังก์ชันสำหรับตรวจสอบและขออนุมัติสิทธิ์การเข้าถึง Google Drive
 */
function checkFolderPermission() {
  var folderId = DRIVE_FOLDER_ID;
  try {
    var folder = DriveApp.getFolderById(folderId);
    var folderName = folder.getName();
    var msg = '✅ อนุมัติสิทธิ์เรียบร้อยแล้ว!\nสคริปต์มีสิทธิ์เข้าถึงโฟลเดอร์ Google Drive:\n"' + folderName + '" (ID: ' + folderId + ')';
    Logger.log(msg);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
    }
    return { success: true, message: msg, folderName: folderName, isFallback: false };
  } catch (err) {
    var errStr = err.toString();
    if (errStr.indexOf('DriveApp') !== -1 || errStr.indexOf('permission') !== -1) {
      var permMsg = '⚠️ ยังไม่ได้อนุมัติสิทธิ์ใช้งาน Google Drive!\n\nกรุณากด Run ฟังก์ชันนี้ใน Apps Script Editor เพื่อกด "Allow" อนุมัติสิทธิ์ 1 ครั้งก่อนครับ';
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
        try { SpreadsheetApp.getUi().alert(permMsg); } catch (e) { }
      }
      return { success: false, message: permMsg };
    }

    try {
      var fallbackFolder = getTargetFolder(folderId);
      var fallbackName = fallbackFolder.getName();
      var warnMsg = '⚠️ ไม่สามารถเข้าถึง Folder ID (' + folderId + ') โดยตรงได้ (ติดสิทธิ์แชร์)\n\n💡 ระบบสลับไปใช้โฟลเดอร์สำรองใน Google Drive ให้อัตโนมัติ: "' + fallbackName + '"';
      Logger.log(warnMsg);
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
        try { SpreadsheetApp.getUi().alert(warnMsg); } catch (e) { }
      }
      return { success: true, message: warnMsg, folderName: fallbackName, isFallback: true };
    } catch (e) {
      return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
    }
  }
}

/**
 * สร้างหัวคอลัมน์ลงในชีตที่ Active อยู่ (หรือชีต "data")
 */
function initDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data') || ss.getActiveSheet();

  var headers = [
    "Timestamp",
    "ชื่อหลักสูตร",
    "วันที่เริ่ม",
    "วันที่สิ้นสุด",
    "วิทยากร",
    "ชื่อ-นามสกุล",
    "รหัสพนักงาน",
    "แผนก",
    "1.1 ก่อนอบรมมีความรู้",
    "1.2 หลังอบรมมีความรู้เพิ่มขึ้น",
    "1.3 เนื้อหานำไปใช้ได้",
    "1.4 ระยะเวลาเหมาะสม",
    "1.5 เอกสารประกอบ",
    "2.1 การถ่ายทอดของวิทยากร",
    "2.2 การสร้างบรรยากาศ / การมีส่วนร่วม",
    "2.3 ภาษาและคำพูด",
    "2.4 การตรงต่อเวลา",
    "3.1 สถานที่และสภาพแวดล้อม",
    "3.2 อุปกรณ์โสตทัศนูปกรณ์",
    "3.3 อาหารและเครื่องดื่ม",
    "3.4 ความชัดเจนในการชี้แจง",
    "3.5 การให้บริการ / ช่วยเหลือ",
    "4. ประโยชน์ที่ได้รับ 1",
    "4. ประโยชน์ที่ได้รับ 2",
    "5. หัวข้อสัมมนาครั้งหน้า 1",
    "5. หัวข้อสัมมนาครั้งหน้า 2",
    "5. ข้อเสนอแนะอื่นๆ 1",
    "5. ข้อเสนอแนะอื่นๆ 2",
    "ลายเซ็นผู้เข้าอบรม (URL/lh5)",
    "ชื่อผู้เข้าอบรม (ในวงเล็บ)",
    "หัวหน้างาน 1: ทัศนคติเชิงบวก",
    "หัวหน้างาน 2: เพิ่มประสิทธิภาพ",
    "หัวหน้างาน 3: ประสานงาน",
    "หัวหน้างาน 4: นำความรู้ไปใช้",
    "หัวหน้างาน 5: สร้างสรรค์แนวคิดใหม่",
    "คะแนนรวม",
    "ติดตามผล-สอบถามสัมภาษณ์",
    "ติดตามผล-ทดสอบความรู้",
    "ติดตามผล-สังเกต",
    "ติดตามผล-อื่นๆ",
    "รายละเอียดติดตามผลอื่นๆ",
    "ความพึงพอใจหัวหน้างาน",
    "ข้อคิดเห็นหัวหน้างาน 1",
    "ข้อคิดเห็นหัวหน้างาน 2",
    "ลายเซ็นหัวหน้างาน (URL/lh5)",
    "ชื่อหัวหน้างาน (ในวงเล็บ)",
    "PDF Report (URL/lh5)",
    "Record_ID",
    "Status"
  ];

  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    SpreadsheetApp.getUi().alert('✅ สร้างหัวคอลัมน์เรียบร้อยแล้วในชีต: ' + sheet.getName());
  } else {
    SpreadsheetApp.getUi().alert('⚠️ ชีตนี้มีข้อมูลอยู่แล้ว ไม่ได้เพิ่มหัวคอลัมน์ซ้ำ');
  }
}

/**
 * เปิดฟอร์มเป็น Dialog ด้านข้าง
 */
function showForm() {
  var html = HtmlService.createHtmlOutputFromFile('index')
    .setWidth(800)
    .setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'แบบประเมินผลการฝึกอบรม');
}

/**
 * บันทึกรูปภาพ Base64 ลงใน Google Drive Folder และส่งคืนลิงก์แบบ lh3/lh5 (lh3.googleusercontent.com/d/FILE_ID)
 */
function saveBase64ToDrive(base64Data, fileName, folderId) {
  if (!base64Data || typeof base64Data !== 'string' || base64Data.indexOf('base64,') === -1) {
    return '';
  }
  try {
    var folder = getTargetFolder(folderId);
    var splitData = base64Data.split('base64,');
    var contentType = splitData[0].split(':')[1].split(';')[0];
    var decoded = Utilities.base64Decode(splitData[1]);
    var blob = Utilities.newBlob(decoded, contentType, fileName);
    var file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Notice: " + shareErr.toString());
    }

    var fileId = file.getId();
    var lhUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    return lhUrl;
  } catch (err) {
    Logger.log("Error saving signature to Drive: " + err.toString());
    throw err;
  }
}

/**
 * แปลง URL ลายเซ็น (lh3.googleusercontent.com/d/...) เป็น base64 data URI
 * เพื่อฝังใน PDF ตรง ๆ (URL ภายนอกโหลดไม่ขึ้นตอน GAS render เป็น PDF)
 */
function lhUrlToDataUri(url) {
  if (!url) return '';
  var s = String(url).trim();
  // ถ้าเป็น data URI อยู่แล้ว ใช้ตรง ๆ
  if (s.indexOf('base64,') !== -1) return s;
  // ดึง fileId จาก URL รูปแบบ https://lh3.googleusercontent.com/d/FILE_ID
  var m = s.match(/\/d\/([^\/?]+)/);
  if (!m) return '';
  try {
    var file = DriveApp.getFileById(m[1]);
    var blob = file.getBlob();
    var b64 = Utilities.base64Encode(blob.getBytes());
    var mime = blob.getContentType() || 'image/png';
    return 'data:' + mime + ';base64,' + b64;
  } catch (err) {
    Logger.log('lhUrlToDataUri error: ' + err.toString());
    return '';
  }
}

/**
 * สร้างไฟล์ PDF จาก HTML Template
 */
function createPdfFromHtml(d, timeStampClean, folderId) {
  try {
    var template = HtmlService.createTemplateFromFile('pdf_template');
    template.d = d;
    var htmlOutput = template.evaluate();

    var empId = d.emp_id || 'EMP';
    var pdfFileName = 'Evaluation_F-HR-004-03_' + empId + '_' + timeStampClean + '.pdf';
    var pdfBlob = htmlOutput.getAs('application/pdf').setName(pdfFileName);

    var folder = getTargetFolder(folderId);
    var pdfFile = folder.createFile(pdfBlob);

    try {
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) { }

    var fileId = pdfFile.getId();
    return 'https://drive.google.com/file/d/' + fileId + '/view';
  } catch (err) {
    Logger.log("Error creating PDF: " + err.toString());
    return '';
  }
}

// Helper: map raw total score to level based on defined ranges
function getScoreLevel(score) {
  if (score <= 5) return 1;
  if (score <= 10) return 2;
  if (score <= 15) return 3;
  if (score <= 20) return 4;
  if (score <= 25) return 5;
  return 5;
}

/**
 * บันทึกข้อมูลลงชีตที่ Active อยู่ (หรือชีต "data")
 */
function saveData(rowData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data') || ss.getActiveSheet();

    if (sheet.getLastRow() === 0) {
      initDatabase();
    }

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    var empId = (rowData && rowData[5]) ? rowData[5] : 'EMP';
    var timeStampClean = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyyMMdd_HHmmss');

    // เก็บ Base64 ดั้งเดิมของลายเซ็นไว้สำหรับนำไปแสดงบน PDF
    var sig1_base64 = (rowData && rowData[27]) ? rowData[27] : '';
    var sig2_base64 = (rowData && rowData[43]) ? rowData[43] : '';

    // Keep the supervisor total score passed from the form
    var totalScoreVal = rowData[34] || '';

    var d = {
      course_name: rowData[0] || '',
      start_date: rowData[1] || '',
      end_date: rowData[2] || '',
      speaker: rowData[3] || '',
      emp_name: rowData[4] || '',
      emp_id: rowData[5] || '',
      department: rowData[6] || '',
      p1_1: rowData[7] || '',
      p1_2: rowData[8] || '',
      p1_3: rowData[9] || '',
      p1_4: rowData[10] || '',
      p1_5: rowData[11] || '',
      p2_1: rowData[12] || '',
      p2_2: rowData[13] || '',
      p2_3: rowData[14] || '',
      p2_4: rowData[15] || '',
      p3_1: rowData[16] || '',
      p3_2: rowData[17] || '',
      p3_3: rowData[18] || '',
      p3_4: rowData[19] || '',
      p3_5: rowData[20] || '',
      benefit_1: rowData[21] || '',
      benefit_2: rowData[22] || '',
      next_topic_1: rowData[23] || '',
      next_topic_2: rowData[24] || '',
      comment_1: rowData[25] || '',
      comment_2: rowData[26] || '',
      sig1_raw: sig1_base64,
      attendee_name_bracket: rowData[28] || '',
      sup_1: rowData[29] || '',
      sup_2: rowData[30] || '',
      sup_3: rowData[31] || '',
      sup_4: rowData[32] || '',
      sup_5: rowData[33] || '',
      total_score: rowData[34] || '',
      follow_interview: rowData[35] || '',
      follow_test: rowData[36] || '',
      follow_observe: rowData[37] || '',
      follow_other_check: rowData[38] || '',
      follow_other_detail: rowData[39] || '',
      sat: rowData[40] || '',
      sup_comment_1: rowData[41] || '',
      sup_comment_2: rowData[42] || '',
      sig2_raw: sig2_base64,
      sup_name_bracket: rowData[44] || ''
    };

    // 1. สร้างไฟล์ PDF (ขนาด A4 1 หน้าพอดีเป๊ะ) พร้อมฝังภาพลายเซ็น
    var pdfUrl = createPdfFromHtml(d, timeStampClean, DRIVE_FOLDER_ID);

    // 2. บันทึกลายเซ็นผู้เข้าอบรม (ตำแหน่งดัชนี 27) ลง Google Drive -> แปลงเป็น lh5 URL
    if (rowData && rowData[27] && rowData[27].indexOf('base64,') !== -1) {
      var fileName1 = 'Sig_Attendee_' + empId + '_' + timeStampClean + '.png';
      rowData[27] = saveBase64ToDrive(rowData[27], fileName1, DRIVE_FOLDER_ID);
    }

    // 3. บันทึกลายเซ็นหัวหน้างาน (ตำแหน่งดัชนี 43) ลง Google Drive -> แปลงเป็น lh5 URL
    if (rowData && rowData[43] && rowData[43].indexOf('base64,') !== -1) {
      var fileName2 = 'Sig_Supervisor_' + empId + '_' + timeStampClean + '.png';
      rowData[43] = saveBase64ToDrive(rowData[43], fileName2, DRIVE_FOLDER_ID);
    }

    // 4. เพิ่ม PDF URL ต่อท้ายในคอลัมน์ที่ 47
    rowData.push(pdfUrl);

    var fullRow = [timestamp].concat(rowData || []);
    sheet.appendRow(fullRow);

    return {
      success: true,
      message: "บันทึกข้อมูล ลายเซ็น และสร้างไฟล์ PDF เรียบร้อยแล้ว",
      pdfUrl: pdfUrl
    };
  } catch (error) {
    var errStr = error.toString();
    Logger.log("Error in saveData: " + errStr);

    if (errStr.indexOf('DriveApp') !== -1 || errStr.indexOf('permission') !== -1 || errStr.indexOf('Required permissions') !== -1) {
      return {
        success: false,
        message: "🔒 สคริปต์ยังไม่ได้รับสิทธิ์เข้าถึง Google Drive!\n\nกรุณาทำตามขั้นตอน:\n1. เปิดหน้า Google Apps Script Editor\n2. เลือกฟังก์ชัน checkFolderPermission แล้วกดปุ่ม Run (เรียกใช้)\n3. กดปุ่ม 'Allow' (อนุญาต) สิทธิ์ Google Drive"
      };
    }

    return { success: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + errStr };
  }
}

/**
 * ดึงรายชื่อแผนกจาก Sheet ชื่อ "dept" (คอลัมน์แรก ตั้งแต่แถวที่ 2 เป็นต้นไป)
 */
function getDepartments() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // ค้นหาชีตชื่อ 'dept' หรือ 'แผนก' (ไม่เล็กใหญ่)
    var sheet = ss.getSheetByName('dept') || ss.getSheetByName('DEPT') || ss.getSheetByName('Dept') || ss.getSheetByName('แผนก');

    // ถ้าไม่มีชีตเหล่านี้เลย ให้ใช้แผนกตั้งต้นเพื่อประคับประคองระบบไม่ให้โหลดว่างเปล่า
    var fallbackDepts = ["HR", "IT", "Production", "QA", "QC", "Maintenance", "Store", "Logistics", "Purchasing", "Account", "Sales", "Marketing", "Safety", "Planning"];

    if (!sheet) {
      return fallbackDepts;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return fallbackDepts;

    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var depts = [];
    data.forEach(function (row) {
      var val = row[0] ? row[0].toString().trim() : '';
      // ไม่แสดงแผนก 'admin' ในหน้าเลือกแผนก (ใช้สำหรับ login เท่านั้น)
      if (val !== '' && val.toLowerCase() !== 'admin' && depts.indexOf(val) === -1) {
        depts.push(val);
      }
    });

    // กัน fallback มี admin หลุดเข้ามาด้วย
    fallbackDepts = fallbackDepts.filter(function (d) {
      return d.toLowerCase() !== 'admin';
    });

    return depts.length > 0 ? depts : fallbackDepts;
  } catch (err) {
    Logger.log("Error in getDepartments: " + err.toString());
    return ["HR", "IT", "Production", "QA", "QC", "Maintenance", "Store", "Logistics"];
  }
}
/**
 * บันทึกข้อมูลส่วนของผู้เข้าอบรม (Trainee)
 */
function saveTraineeData(rowData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data') || ss.getActiveSheet();

    if (sheet.getLastRow() === 0) {
      initDatabase();
    }

    var courseName = String(rowData[0] || '').trim();
    var empName = String(rowData[4] || '').trim();
    var empIdRaw = String(rowData[5] || '').trim();

    if (sheet.getLastRow() > 1 && courseName !== '') {
      var existingData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getDisplayValues();
      for (var i = 0; i < existingData.length; i++) {
        var existingCourse = String(existingData[i][1] || '').trim();
        var existingName = String(existingData[i][5] || '').trim();
        var existingId = String(existingData[i][6] || '').trim();

        if (existingCourse === courseName) {
          if ((empIdRaw !== '' && existingId === empIdRaw) || (empName !== '' && existingName === empName)) {
            return {
              success: false,
              message: "คุณได้ส่งแบบประเมินสำหรับหลักสูตรนี้ไปแล้ว (ตรวจพบชื่อหลักสูตรและชื่อ/รหัสพนักงานซ้ำในระบบ)"
            };
          }
        }
      }
    }

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    var empId = (rowData && rowData[5]) ? rowData[5] : 'EMP';
    var timeStampClean = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
    var recordId = empId + '_' + timeStampClean;

    // บันทึกลายเซ็นผู้เข้าอบรม (ตำแหน่งดัชนี 27) ลง Google Drive
    if (rowData && rowData[27] && rowData[27].indexOf('base64,') !== -1) {
      var fileName1 = 'Sig_Attendee_' + empId + '_' + timeStampClean + '.png';
      rowData[27] = saveBase64ToDrive(rowData[27], fileName1, DRIVE_FOLDER_ID);
    }

    // เติม Array ให้ครบ 45 ช่องก่อนเพื่อป้องกันความคลาดเคลื่อนของ Index คอลัมน์หัวหน้างาน
    while (rowData.length < 45) {
      rowData.push('');
    }
    // PDF URL ยังไม่มีในขั้นตอนนี้
    rowData.push(''); // Index 45: PDF Report
    rowData.push(recordId); // Index 46: Record_ID
    rowData.push('WAITING_SUPERVISOR'); // Index 47: Status

    var fullRow = [timestamp].concat(rowData || []);
    sheet.appendRow(fullRow);

    return {
      success: true,
      message: "บันทึกข้อมูลส่วนผู้เข้าอบรมเรียบร้อยแล้ว (รอหัวหน้างานประเมิน)"
    };
  } catch (error) {
    Logger.log("Error in saveTraineeData: " + error.toString());
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  }
}

/**
 * ดึงรายการที่รอหัวหน้างานประเมิน
 * วิธีการ: สแกนทุก cell ในแต่ละแถวเพื่อหา WAITING_SUPERVISOR โดยตรง
 * ทำให้ไม่ขึ้นกับ index คอลัมน์คงที่ ซึ่งอาจเปลี่ยนแปลงได้
 */
function getPendingTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var pendingTasks = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    // สแกนทุก cell หา WAITING_SUPERVISOR
    var statusColIdx = -1;
    for (var c = row.length - 1; c >= 0; c--) {
      var cellVal = String(row[c] || '').trim();
      if (cellVal === 'WAITING_SUPERVISOR' || cellVal === 'COMPLETED') {
        statusColIdx = c;
        break;
      }
    }

    Logger.log('Row ' + (i + 2) + ': statusColIdx=' + statusColIdx + ' val=' + (statusColIdx >= 0 ? row[statusColIdx] : 'not found'));

    if (statusColIdx >= 0 && (String(row[statusColIdx]).trim() === 'WAITING_SUPERVISOR' || String(row[statusColIdx]).trim() === 'COMPLETED')) {
      // Record_ID อยู่คอลัมน์ก่อน Status เสมอ
      var recordId = String(row[statusColIdx - 1] || '').trim();
      var pdfUrl = String(row[statusColIdx - 2] || '').trim();
      var status = String(row[statusColIdx]).trim();
      pendingTasks.push({
        recordId: recordId,
        timestamp: row[0],
        courseName: row[1],
        empName: row[5],
        empId: row[6],
        department: row[7],
        status: status,
        pdfUrl: pdfUrl
      });
    }
  }

  Logger.log('getPendingTasks result count: ' + pendingTasks.length);
  return pendingTasks;
}

/**
 * ดึงข้อมูลการประเมินตาม Record_ID (สำหรับแสดงให้หัวหน้าดู)
 */
function getTaskById(recordId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
  if (!sheet) return null;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var recordIdx = row.length - 2; // Record_ID อยู่ก่อน Status เสมอ
    if (String(row[recordIdx] || '').trim() === String(recordId || '').trim()) {
      return row;
    }
  }
  return null;
}

/**
 * บันทึกข้อมูลส่วนของหัวหน้างาน (Supervisor) และออก PDF
 */
function saveSupervisorData(recordId, supData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
    if (!sheet) throw new Error("ไม่พบชีตสำหรับเก็บข้อมูล");

    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 49).getDisplayValues();
    var targetRowIndex = -1;
    var rowData = null;

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][47] || '').trim() === String(recordId || '').trim()) {
        if (String(data[i][48]).trim() === 'COMPLETED') {
          return { success: false, message: "รายการนี้ถูกประเมินและเสร็จสมบูรณ์ไปแล้ว" };
        }
        targetRowIndex = i + 2;
        rowData = data[i];
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: "ไม่พบข้อมูล Record ID นี้" };
    }

    var empId = rowData[6] || 'EMP';
    var timeStampClean = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyyMMdd_HHmmss');

    // นำ supData (ข้อมูลหัวหน้าที่ส่งมา) ไปอัปเดตใส่ rowData ที่ตำแหน่งที่เกี่ยวข้อง (30-45)
    rowData[30] = supData[0]; // sup_1
    rowData[31] = supData[1];
    rowData[32] = supData[2];
    rowData[33] = supData[3];
    rowData[34] = supData[4];
    rowData[35] = supData[5]; // คะแนนรวม
    rowData[36] = supData[6]; // follow_interview
    rowData[37] = supData[7]; // follow_test
    rowData[38] = supData[8]; // follow_observe
    rowData[39] = supData[9]; // follow_other_check
    rowData[40] = supData[10]; // follow_other_detail
    rowData[41] = supData[11]; // sat
    rowData[42] = supData[12]; // sup_comment_1
    rowData[43] = supData[13]; // sup_comment_2

    // บันทึกลายเซ็นหัวหน้า (ตำแหน่ง 44)
    var sig2_base64 = supData[14];
    if (sig2_base64 && sig2_base64.indexOf('base64,') !== -1) {
      var fileName2 = 'Sig_Supervisor_' + empId + '_' + timeStampClean + '.png';
      rowData[44] = saveBase64ToDrive(sig2_base64, fileName2, DRIVE_FOLDER_ID);
    } else {
      rowData[44] = '';
    }

    rowData[45] = supData[15]; // sup_name_bracket

    // เตรียมตัวแปรสำหรับสร้าง PDF
    // ฝังลายเซ็นเป็น base64 data URI ตรง ๆ (URL ภายนอกโหลดไม่ขึ้นตอน GAS render เป็น PDF)
    var d = {
      course_name: rowData[1], start_date: rowData[2], end_date: rowData[3],
      speaker: rowData[4], emp_name: rowData[5], emp_id: rowData[6], department: rowData[7],
      p1_1: rowData[8], p1_2: rowData[9], p1_3: rowData[10], p1_4: rowData[11], p1_5: rowData[12],
      p2_1: rowData[13], p2_2: rowData[14], p2_3: rowData[15], p2_4: rowData[16],
      p3_1: rowData[17], p3_2: rowData[18], p3_3: rowData[19], p3_4: rowData[20], p3_5: rowData[21],
      benefit_1: rowData[22], benefit_2: rowData[23], next_topic_1: rowData[24], next_topic_2: rowData[25],
      comment_1: rowData[26], comment_2: rowData[27],
      sig1_raw: lhUrlToDataUri(rowData[28]), // ลายเซ็นผู้เข้าอบรม → base64
      attendee_name_bracket: rowData[29],
      sup_1: rowData[30], sup_2: rowData[31], sup_3: rowData[32], sup_4: rowData[33], sup_5: rowData[34],
      total_score: rowData[35], follow_interview: rowData[36], follow_test: rowData[37], follow_observe: rowData[38],
      follow_other_check: rowData[39], follow_other_detail: rowData[40], sat: rowData[41],
      sup_comment_1: rowData[42], sup_comment_2: rowData[43],
      sig2_raw: sig2_base64, // ลายเซ็นหัวหน้า (base64 ตรง ๆ จากฟอร์ม)
      sup_name_bracket: rowData[45]
    };

    // สร้าง PDF
    var pdfUrl = createPdfFromHtml(d, timeStampClean, DRIVE_FOLDER_ID);
    rowData[46] = pdfUrl;
    rowData[48] = 'COMPLETED';

    // อัปเดตข้อมูลกลับลงชีต
    sheet.getRange(targetRowIndex, 1, 1, rowData.length).setValues([rowData]);

    return {
      success: true,
      message: "บันทึกผลการประเมินจากหัวหน้างานและสร้าง PDF เรียบร้อยแล้ว",
      pdfUrl: pdfUrl
    };

  } catch (error) {
    Logger.log("Error in saveSupervisorData: " + error.toString());
    return { success: false, message: "เกิดข้อผิดพลาด: " + error.toString() };
  }
}

function verifySupervisorLogin(dept, pass) {
  try {
    if (String(dept).trim().toLowerCase() === 'admin' && String(pass).trim() === 'admin1234') {
      return { success: true, supName: 'Administrator' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Dep') || ss.getSheetByName('dept') || ss.getSheetByName('DEPT') || ss.getSheetByName('แผนก');
    if (!sheet) return { success: false, message: "ไม่พบชีตแผนก (Dep)" };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "ไม่มีข้อมูลแผนก" };

    var data = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
    var deptFound = false;

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === dept.trim()) {
        deptFound = true;
        var correctPass = String(data[i][1]).trim();
        var correctName = String(data[i][2]).trim();

        if (correctPass === '' || correctPass === pass.trim()) {
          return { success: true, supName: correctName };
        }
      }
    }

    if (deptFound) {
      return { success: false, message: "รหัสพนักงานไม่ถูกต้อง" };
    }
    return { success: false, message: "ไม่พบแผนกในระบบ" };
  } catch (e) {
    return { success: false, message: "เกิดข้อผิดพลาด: " + e.toString() };
  }
}

/**
 * ลบข้อมูล Record และไฟล์ลายเซ็น + PDF ออกจาก Google Drive
 * เรียกใช้เฉพาะ Admin เท่านั้น
 */
function deleteRecord(recordId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
    if (!sheet) return { success: false, message: 'ไม่พบชีตข้อมูล' };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'ไม่มีข้อมูลในชีต' };

    var lastCol = sheet.getLastColumn();
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    var targetRowIndex = -1;
    var rowData = null;

    for (var i = 0; i < data.length; i++) {
      // สแกนหา Record_ID (อยู่ก่อน Status)
      var statusColIdx = -1;
      for (var c = data[i].length - 1; c >= 0; c--) {
        var v = String(data[i][c] || '').trim();
        if (v === 'WAITING_SUPERVISOR' || v === 'COMPLETED') {
          statusColIdx = c;
          break;
        }
      }
      if (statusColIdx >= 0) {
        var rid = String(data[i][statusColIdx - 1] || '').trim();
        if (rid === String(recordId || '').trim()) {
          targetRowIndex = i + 2; // +2 เพราะ header แถวที่ 1 + offset 0-based
          rowData = data[i];
          break;
        }
      }
    }

    if (targetRowIndex === -1 || !rowData) {
      return { success: false, message: 'ไม่พบ Record ID นี้ในระบบ' };
    }

    // ดึง URL ของลายเซ็น + PDF แล้วลบจาก Drive
    var deletedFiles = [];
    var errorFiles = [];

    // helper: แปลง URL -> File ID
    function extractFileId(url) {
      if (!url) return null;
      // lh3.googleusercontent.com/d/<ID>
      var m1 = String(url).match(/\/d\/([a-zA-Z0-9_-]{10,})/);
      if (m1) return m1[1];
      // drive.google.com/file/d/<ID>/view
      var m2 = String(url).match(/file\/d\/([a-zA-Z0-9_-]{10,})/);
      if (m2) return m2[1];
      // drive.google.com/open?id=<ID>
      var m3 = String(url).match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
      if (m3) return m3[1];
      return null;
    }

    function tryDeleteFile(url, label) {
      var fid = extractFileId(url);
      if (!fid) return;
      try {
        var file = DriveApp.getFileById(fid);
        file.setTrashed(true);
        deletedFiles.push(label);
      } catch (e) {
        Logger.log('ลบ ' + label + ' (' + fid + ') ไม่สำเร็จ: ' + e.toString());
        errorFiles.push(label);
      }
    }

    // ลายเซ็นผู้เข้าอบรม (index 28 จาก raw data = col 29 ใน 1-based, +1 offset Timestamp)
    // rowData[28] = sig1 URL (lh3), rowData[44] = sig2 URL, rowData[46] = PDF URL
    tryDeleteFile(rowData[28], 'ลายเซ็นผู้เข้าอบรม');
    tryDeleteFile(rowData[44], 'ลายเซ็นหัวหน้างาน');
    tryDeleteFile(rowData[46], 'PDF Report');

    // ลบแถวออกจาก Sheet
    sheet.deleteRow(targetRowIndex);

    var msg = 'ลบข้อมูลเรียบร้อยแล้ว';
    if (deletedFiles.length > 0) msg += ' | ลบไฟล์ Drive: ' + deletedFiles.join(', ');
    if (errorFiles.length > 0) msg += ' | ลบไม่ได้: ' + errorFiles.join(', ');

    return { success: true, message: msg };

  } catch (error) {
    Logger.log('Error in deleteRecord: ' + error.toString());
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

function getTotalPendingCount(dept) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
    if (!sheet) return 0;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;

    var lastCol = sheet.getLastColumn();
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    var count = 0;

    var isAdmin = false;
    var targetDept = "";
    if (dept) {
      targetDept = String(dept).trim().toLowerCase();
      if (targetDept === 'admin') isAdmin = true;
    }

    // If no department is specified (not logged in), we don't show any pending count.
    if (!dept) return 0;

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      for (var c = row.length - 1; c >= 0; c--) {
        var cellVal = String(row[c] || '').trim();
        if (cellVal === 'WAITING_SUPERVISOR' || cellVal === 'COMPLETED') {
          if (cellVal === 'WAITING_SUPERVISOR') {
            var rowDept = String(row[7] || '').trim().toLowerCase();
            if (isAdmin || rowDept === targetDept) {
              count++;
            }
          }
          break;
        }
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

/* =====================================================================
 * รายงานสรุปการประเมินผลฝึกอบรม (เฉพาะ Admin)
 * ===================================================================== */

/**
 * สร้าง HTML ของรายงานสรุปจากข้อมูลจริงในชีต 'data'
 * เงื่อนไข: เปิดได้เฉพาะผู้ที่ login ด้วย admin เท่านั้น
 */
function getReportSummaryHtml(isAdmin, filters, preparedBy) {
  if (String(isAdmin || '').trim().toLowerCase() !== 'admin') {
    return '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>สิทธิ์ไม่เพียงพอ</title></head>' +
      '<body style="font-family: "TH Sarabun PSK", "Angsana New", "Cordia New", "Sarabun", sans-serif; padding: 40px; text-align: center;">' +
      '<h3 style="color: #b91c1c;">สิทธิ์ไม่เพียงพอ</h3>' +
      '<p>เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเปิดดูรายงานสรุปนี้ได้</p>' +
      '</body></html>';
  }

  var r = computeReportSummary(filters || {}, preparedBy);
  var t = HtmlService.createTemplateFromFile('reportsummary');
  t.r = r;
  return t.evaluate().getContent();
}

/**
 * คำนวณตัวเลขสรุปจากชีต 'data' (อ้างอิงข้อมูลจริงจาก Sheet)
 * - คะแนนเฉลี่ยของคำถามแต่ละข้อ, เฉลี่ยรายหมวด (1/2/3) และภาพรวม
 * - จำนวนผู้เข้าอบรม / ผู้ทำแบบประเมิน / จำนวนแผนก
 * - ข้อคิดเห็น (ประโยชน์ที่ได้รับ, หัวข้อครั้งหน้า, ข้อเสนอแนะ)
 */
function computeReportSummary(filters, preparedBy) {
  filters = filters || {};
  var filterCourse = String(filters.course || '').trim();
  var filterGender = String(filters.gender || '').trim();
  var filterDept = String(filters.dept || '').trim();
  var fromD = parseISODate(filters.from);
  var toD = parseISODate(filters.to);
  // จำนวนผู้เข้าอบรมจริง (กรอกเอง) — ถ้าไม่กรอกใช้จำนวนแถวในชีต
  var attendeesInput = parseInt(String(filters.attendees || '').replace(/[^0-9]/g, ''), 10);
  if (!attendeesInput || attendeesInput < 0) attendeesInput = 0;
  // ชั่วโมง / วัน (กรอกเอง) — รูปแบบ "วัน|ชม." เก็บเป็น 2 ฟิลด์แยก
  var hdParts = String(filters.hoursday || '').split('|');
  var hoursDays = String(hdParts[0] || '').trim();
  var hoursHrs = String(hdParts[1] || '').trim();
  var preparedByName = String(preparedBy || '').trim();

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');

  var empty = {
    courseName: '—', startDate: '—', endDate: '—', speaker: '—',
    totalAttendees: 0, totalEvaluated: 0, evalPercent: '—', notEvaluated: 0, notEvalPercent: '—',
    totalMale: '—', totalFemale: '—',
    deptText: '—', deptCount: 0, deptOptions: [], courseOptions: [],
    filterCourse: filterCourse, filterGender: filterGender, filterDept: filterDept,
    filterFrom: String(filters.from || ''), filterTo: String(filters.to || ''),
    filterAttendees: attendeesInput > 0 ? String(attendeesInput) : '',
    filterHoursDays: hoursDays,
    filterHoursHrs: hoursHrs,
    hoursDays: hoursDays || '—',
    hoursHrs: hoursHrs || '—',
    preparedBy: preparedByName || '—',
    q1_1: '—', q1_2: '—', q1_3: '—', q1_4: '—', q1_5: '—',
    q2_1: '—', q2_2: '—', q2_3: '—', q2_4: '—',
    q3_1: '—', q3_2: '—', q3_3: '—', q3_4: '—', q3_5: '—',
    sec1: '—', sec2: '—', sec3: '—', overall: '—',
    sup1: '—', sup2: '—', sup3: '—', sup4: '—', sup5: '—', sat: '—',
    chart1Svg: buildChart1Svg(['—', '—', '—', '—']),
    chart2Svg: buildChart2Svg(['—', '—', '—', '—', '—', '—']),
    feedbackRows: [], scoreRows: [], scoreCount: 0, scoreAvg: '—', scoreAvgTotal: '—',
    courseStats: [],
    generatedAt: now
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();
  if (!sheet || sheet.getLastRow() < 2) return empty;

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();

  // ตำแหน่งคอลัมน์ (0-based โดยคอลัมน์ 0 คือ Timestamp)
  var C = {
    course: 1, start: 2, end: 3, speaker: 4, name: 5, dept: 7,
    q1_1: 8, q1_2: 9, q1_3: 10, q1_4: 11, q1_5: 12,
    q2_1: 13, q2_2: 14, q2_3: 15, q2_4: 16,
    q3_1: 17, q3_2: 18, q3_3: 19, q3_4: 20, q3_5: 21,
    benefit_1: 22, benefit_2: 23, next_1: 24, next_2: 25,
    comment_1: 26, comment_2: 27,
    sup_1: 30, sup_2: 31, sup_3: 32, sup_4: 33, sup_5: 34,
    sat: 41
  };

  var qCols = [C.q1_1, C.q1_2, C.q1_3, C.q1_4, C.q1_5, C.q2_1, C.q2_2, C.q2_3, C.q2_4, C.q3_1, C.q3_2, C.q3_3, C.q3_4, C.q3_5];
  var supCols = [C.sup_1, C.sup_2, C.sup_3, C.sup_4, C.sup_5];

  // รายชื่อแผนกทั้งหมด (สำหรับ select กรอง) — เก็บจากทุกแถวโดยไม่กรอง
  var deptOptions = [];
  for (var d0 = 0; d0 < data.length; d0++) {
    var dv = String(data[d0][C.dept] || '').trim();
    if (dv !== '' && deptOptions.indexOf(dv) === -1) deptOptions.push(dv);
  }
  deptOptions.sort();

  // รายชื่อหลักสูตรทั้งหมด (สำหรับ select กรอง) — เก็บจากทุกแถวโดยไม่กรอง
  var courseOptions = [];
  for (var c0 = 0; c0 < data.length; c0++) {
    var cv = String(data[c0][C.course] || '').trim();
    if (cv !== '' && courseOptions.indexOf(cv) === -1) courseOptions.push(cv);
  }
  courseOptions.sort();

  var courseCounts = {};
  var startDates = [], endDates = [], speakers = [], deptCounts = {};
  var qTotals = {}, supTotals = {}, satTotal = { sum: 0, n: 0 };
  var evaluated = 0;
  var maleCount = 0, femaleCount = 0, classified = 0;
  var benefits = [], nextTopics = [], comments = [];
  var scoreRows = [], scoreSum = 0, scoreAvgSum = 0, scoreCount = 0;
  var courseStats = {};

  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    var course = String(row[C.course] || '').trim();

    // ---- กรองข้อมูลตามตัวเลือก (หลักสูตร / เพศ / วันที่ / แผนก) ----
    var gender = classifyGender(row[C.name]);
    if (filterCourse !== '' && course !== filterCourse) continue;
    if (filterGender !== '' && gender !== filterGender) continue;
    if (filterDept !== '' && String(row[C.dept] || '').trim() !== filterDept) continue;
    if (fromD || toD) {
      var fRowStart = parseDateStr(row[C.start]);
      if (!fRowStart) continue;
      if (fromD && fRowStart.getTime() < fromD.getTime()) continue;
      if (toD && fRowStart.getTime() > toD.getTime()) continue;
    }

    if (course !== '') courseCounts[course] = (courseCounts[course] || 0) + 1;

    var sd = parseDateStr(row[C.start]);
    if (sd) startDates.push(sd);
    var ed = parseDateStr(row[C.end]);
    if (ed) endDates.push(ed);

    var sp = String(row[C.speaker] || '').trim();
    if (sp !== '') speakers.push(sp);

    var dept = String(row[C.dept] || '').trim();
    if (dept !== '') deptCounts[dept] = (deptCounts[dept] || 0) + 1;

    if (gender === 'ชาย') { maleCount += 1; classified += 1; }
    else if (gender === 'หญิง') { femaleCount += 1; classified += 1; }

    var hasEval = false;
    var personSum = 0, personN = 0;
    for (var j = 0; j < qCols.length; j++) {
      var qn = parseFloat(row[qCols[j]]);
      if (!isNaN(qn)) {
        hasEval = true;
        personSum += qn;
        personN += 1;
        if (!qTotals[qCols[j]]) qTotals[qCols[j]] = { sum: 0, n: 0 };
        qTotals[qCols[j]].sum += qn;
        qTotals[qCols[j]].n += 1;
      }
    }
    if (hasEval) evaluated += 1;

    // คะแนนรายบุคคล: ผลรวมและค่าเฉลี่ยของคำถาม 1-3 ของแต่ละคน
    scoreRows.push({
      name: String(row[C.name] || '').trim() || '—',
      dept: String(row[C.dept] || '').trim() || '—',
      total: personN > 0 ? personSum : null,
      avg: personN > 0 ? (personSum / personN).toFixed(2) : '—'
    });
    if (personN > 0) {
      scoreSum += personSum;
      scoreAvgSum += personSum / personN;
      scoreCount += 1;
      // สะสมค่าเฉลี่ยแยกตามหลักสูตร
      if (course !== '') {
        if (!courseStats[course]) courseStats[course] = { sum: 0, avgSum: 0, n: 0 };
        courseStats[course].sum += personSum;
        courseStats[course].avgSum += personSum / personN;
        courseStats[course].n += 1;
      }
    }

    for (var k = 0; k < supCols.length; k++) {
      var sn = parseFloat(row[supCols[k]]);
      if (!isNaN(sn)) {
        if (!supTotals[supCols[k]]) supTotals[supCols[k]] = { sum: 0, n: 0 };
        supTotals[supCols[k]].sum += sn;
        supTotals[supCols[k]].n += 1;
      }
    }
    var satN = parseFloat(row[C.sat]);
    if (!isNaN(satN)) { satTotal.sum += satN; satTotal.n += 1; }

    pushNonEmpty(benefits, row[C.benefit_1]);
    pushNonEmpty(benefits, row[C.benefit_2]);
    pushNonEmpty(nextTopics, row[C.next_1]);
    pushNonEmpty(nextTopics, row[C.next_2]);
    pushNonEmpty(comments, row[C.comment_1]);
    pushNonEmpty(comments, row[C.comment_2]);
  }

  var r = empty;
  var courseNames = Object.keys(courseCounts);
  r.courseName = courseNames.length === 1 ? courseNames[0] : (courseNames.length > 1 ? 'ทุกหลักสูตร' : '—');
  r.startDate = startDates.length ? fmtDate(new Date(Math.min.apply(null, startDates))) : '—';
  r.endDate = endDates.length ? fmtDate(new Date(Math.max.apply(null, endDates))) : '—';
  r.speaker = speakers.length ? speakers[speakers.length - 1] : '—';
  // จำนวนผู้เข้าอบรม: ต้องมาจาก input ที่กรอกเท่านั้น (ไม่ใช้จำนวนแถวในชีตเป็นค่าเริ่มต้น)
  var baseAtt = attendeesInput > 0 ? attendeesInput : 0;
  r.totalAttendees = baseAtt > 0 ? baseAtt : '—';
  r.totalEvaluated = evaluated;
  r.evalPercent = baseAtt > 0 ? (evaluated / baseAtt * 100).toFixed(2) : '—';
  // จำนวนที่ยังไม่ทำแบบประเมิน = ผู้เข้าอบรม − ทำแล้ว (ไม่ต่ำกว่า 0)
  r.notEvaluated = baseAtt > 0 ? Math.max(baseAtt - evaluated, 0) : 0;
  r.notEvalPercent = baseAtt > 0 ? (r.notEvaluated / baseAtt * 100).toFixed(2) : '—';
  r.totalMale = classified > 0 ? String(maleCount) : '—';
  r.totalFemale = classified > 0 ? String(femaleCount) : '—';

  var deptEntries = [];
  for (var dk in deptCounts) deptEntries.push([dk, deptCounts[dk]]);
  deptEntries.sort(function (a, b) { return b[1] - a[1]; });
  r.deptCount = deptEntries.length;
  r.deptText = deptEntries.map(function (e) { return e[0] + ' ' + e[1]; }).join(', ');
  if (r.deptText === '') r.deptText = '—';

  r.q1_1 = fmtAvg(qTotals[C.q1_1]);
  r.q1_2 = fmtAvg(qTotals[C.q1_2]);
  r.q1_3 = fmtAvg(qTotals[C.q1_3]);
  r.q1_4 = fmtAvg(qTotals[C.q1_4]);
  r.q1_5 = fmtAvg(qTotals[C.q1_5]);
  r.q2_1 = fmtAvg(qTotals[C.q2_1]);
  r.q2_2 = fmtAvg(qTotals[C.q2_2]);
  r.q2_3 = fmtAvg(qTotals[C.q2_3]);
  r.q2_4 = fmtAvg(qTotals[C.q2_4]);
  r.q3_1 = fmtAvg(qTotals[C.q3_1]);
  r.q3_2 = fmtAvg(qTotals[C.q3_2]);
  r.q3_3 = fmtAvg(qTotals[C.q3_3]);
  r.q3_4 = fmtAvg(qTotals[C.q3_4]);
  r.q3_5 = fmtAvg(qTotals[C.q3_5]);

  r.sec1 = meanOf([r.q1_1, r.q1_2, r.q1_3, r.q1_4, r.q1_5]);
  r.sec2 = meanOf([r.q2_1, r.q2_2, r.q2_3, r.q2_4]);
  r.sec3 = meanOf([r.q3_1, r.q3_2, r.q3_3, r.q3_4, r.q3_5]);
  r.overall = meanOf([r.sec1, r.sec2, r.sec3]);

  r.sup1 = fmtAvg(supTotals[C.sup_1]);
  r.sup2 = fmtAvg(supTotals[C.sup_2]);
  r.sup3 = fmtAvg(supTotals[C.sup_3]);
  r.sup4 = fmtAvg(supTotals[C.sup_4]);
  r.sup5 = fmtAvg(supTotals[C.sup_5]);
  r.sat = fmtAvg(satTotal);

  r.chart1Svg = buildChart1Svg([r.sec1, r.sec2, r.sec3, r.overall]);
  r.chart2Svg = buildChart2Svg([r.sup1, r.sup2, r.sup3, r.sup4, r.sup5, r.sat]);

  // ข้อคิดเห็นหน้า 2 (สูงสุด 10 รายการ ต่อหมวด)
  var rowCount = Math.max(benefits.length, nextTopics.length, comments.length);
  if (rowCount > 10) rowCount = 10;
  for (var m = 0; m < rowCount; m++) {
    r.feedbackRows.push({
      b: benefits[m] ? ('4.' + (m + 1) + ' ' + benefits[m]) : '',
      n: nextTopics[m] ? ('5.' + (m + 1) + ' ' + nextTopics[m]) : '',
      c: comments[m] ? ('6.' + (m + 1) + ' ' + comments[m]) : ''
    });
  }

  r.deptOptions = deptOptions;
  r.courseOptions = courseOptions;
  r.scoreRows = scoreRows;
  r.scoreCount = scoreCount;
  r.scoreAvg = scoreCount > 0 ? (scoreAvgSum / scoreCount).toFixed(2) : '—';
  r.scoreAvgTotal = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(2) : '—';

  // ค่าเฉลี่ยของทุกคน แยกตามหลักสูตร
  var courseStatsArr = [];
  for (var cs in courseStats) {
    var st = courseStats[cs];
    courseStatsArr.push({
      course: cs,
      count: st.n,
      totalAvg: (st.sum / st.n).toFixed(2),
      avg: (st.avgSum / st.n).toFixed(2)
    });
  }
  courseStatsArr.sort(function (a, b) {
    return a.course < b.course ? -1 : (a.course > b.course ? 1 : 0);
  });
  r.courseStats = courseStatsArr;

  return r;
}

/** ค่าเฉลี่ยจาก {sum, n} -> 'x.xx' หรือ '—' */
function fmtAvg(o) {
  if (!o || o.n === 0) return '—';
  return (o.sum / o.n).toFixed(2);
}

/** ค่าเฉลี่ยจากรายการตัวเลข (ข้ามค่าที่ไม่ใช่ตัวเลข) */
function meanOf(vals) {
  var sum = 0, count = 0;
  for (var i = 0; i < vals.length; i++) {
    var n = parseFloat(vals[i]);
    if (!isNaN(n)) { sum += n; count += 1; }
  }
  if (count === 0) return '—';
  return (sum / count).toFixed(2);
}

function pushNonEmpty(arr, val) {
  var s = String(val || '').trim();
  if (s !== '') arr.push(s);
}

/** จำแนกเพศจากคำนำหน้าชื่อ: นาย/MR = ชาย, นาง/นางสาว/น.ส./MRS = หญิง */
function classifyGender(name) {
  var n = String(name || '').trim();
  var up = n.toUpperCase();
  // เช็ค MRS ก่อน MR เพราะ "MRS" ขึ้นต้นด้วย "MR" ด้วย
  if (up.indexOf('MRS') === 0) return 'หญิง';
  if (up.indexOf('MR') === 0) return 'ชาย';
  // คำนำหน้าภาษาไทย
  if (n.indexOf('นาย') === 0) return 'ชาย';
  if (n.indexOf('นาง') === 0 || n.indexOf('น.ส.') === 0) return 'หญิง';
  return '';
}

var THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** แปลงวันที่จากชีตเป็น Date รองรับทั้ง dd/mm/yyyy และรูปแบบไทย เช่น 5 ส.ค. 2567 (ปี พ.ศ.) */
function parseDateStr(s) {
  s = String(s || '').trim();
  if (!s) return null;
  // รูปแบบ dd/mm/yyyy หรือ d/m/yyyy (กันพลาดปี พ.ศ. ด้วย)
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    var y1 = Number(m[3]);
    if (y1 > 2500) y1 -= 543; // ปี พ.ศ. → ค.ศ.
    return new Date(y1, Number(m[2]) - 1, Number(m[1]));
  }
  // รูปแบบไทย: 5 ส.ค. 2567 (เดือนไทย + ปี พ.ศ. = ค.ศ. + 543)
  var tm = s.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (tm) {
    var mi = THAI_MONTHS.indexOf(tm[2]);
    if (mi !== -1) {
      var yr = Number(tm[3]);
      if (yr > 2500) yr -= 543; // ปี พ.ศ. → ค.ศ.
      return new Date(yr, mi, Number(tm[1]));
    }
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** แปลงวันที่แบบ yyyy-mm-dd (จาก input type="date") เป็น Date ตามเวลาท้องถิ่น */
function parseISODate(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fmtDate(d) {
  if (!d) return '—';
  return d.getDate() + ' ' + THAI_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/** สร้าง SVG กราฟเส้นเปรียบเทียบผลฝึกอบรม (หมวด 1/2/3 + ภาพรวม) */
function buildChart1Svg(vals) {
  var nums = [];
  for (var i = 0; i < vals.length; i++) {
    var n = parseFloat(vals[i]);
    if (!isNaN(n)) nums.push(n);
  }
  var hasData = nums.length > 0;
  var lo = 3.55, hi = 3.95;
  if (hasData) {
    var minV = Math.min.apply(null, nums);
    var maxV = Math.max.apply(null, nums);
    var pad = 0.08;
    lo = Math.floor((minV - pad) * 20) / 20;
    hi = Math.ceil((maxV + pad) * 20) / 20;
    if (hi - lo < 0.4) { var mid = (lo + hi) / 2; lo = mid - 0.2; hi = mid + 0.2; }
  }
  var step = (hi - lo) <= 0.5 ? 0.05 : 0.1;
  var xs = [110, 210, 320, 420];
  var colors = ['#ffc000', '#5b9bd5', '#70ad47', '#ff0000'];
  var yFor = function (v) { return 210 - (v - lo) / (hi - lo) * 195; };

  var s = '<svg viewBox="0 0 500 220" class="chart-svg">';
  for (var g = lo; g <= hi + 0.0001; g = Math.round((g + step) * 100) / 100) {
    var gy = yFor(g);
    s += '<line x1="45" y1="' + gy.toFixed(1) + '" x2="470" y2="' + gy.toFixed(1) + '" stroke="#ccc" stroke-dasharray="2,2" />';
    s += '<text x="40" y="' + (gy + 4).toFixed(1) + '" font-size="10" text-anchor="end">' + g.toFixed(2) + '</text>';
  }
  s += '<line x1="45" y1="10" x2="45" y2="215" stroke="#888" />';
  s += '<line x1="45" y1="215" x2="475" y2="215" stroke="#888" />';

  var pts = [];
  for (var p = 0; p < vals.length; p++) {
    var n2 = parseFloat(vals[p]);
    if (!isNaN(n2)) pts.push(xs[p] + ',' + yFor(n2).toFixed(1));
  }
  if (pts.length > 0) {
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#8ea9db" stroke-width="3" stroke-dasharray="4,3" />';
  }
  for (var m = 0; m < vals.length; m++) {
    var n3 = parseFloat(vals[m]);
    if (isNaN(n3)) continue;
    var x = xs[m], y = yFor(n3);
    s += '<polygon points="' + x + ',' + (y - 6).toFixed(1) + ' ' + (x + 6) + ',' + y.toFixed(1) + ' ' + x + ',' + (y + 6).toFixed(1) + ' ' + (x - 6) + ',' + y.toFixed(1) + '" fill="' + colors[m] + '" />';
    var ly = y - 8;
    if (ly < 12) ly = y + 16;
    s += '<text x="' + x + '" y="' + ly.toFixed(1) + '" font-size="10" font-weight="bold" text-anchor="middle">' + n3.toFixed(2) + '</text>';
  }
  s += '</svg>';
  return s;
}

/** สร้าง SVG กราฟเส้นสรุปผลผู้เข้าอบรม (หัวหน้างาน 5 ข้อ + ความพึงพอใจ) */
function buildChart2Svg(vals) {
  var nums = [];
  for (var i = 0; i < vals.length; i++) {
    var n = parseFloat(vals[i]);
    if (!isNaN(n)) nums.push(n);
  }
  var hasData = nums.length > 0;
  var lo = 0, hi = 4.5;
  if (hasData) {
    var minV = Math.min.apply(null, nums);
    var maxV = Math.max.apply(null, nums);
    var pad = 0.3;
    lo = Math.floor((minV - pad) * 2) / 2;
    hi = Math.ceil((maxV + pad) * 2) / 2;
    if (hi - lo < 1) { var mid = (lo + hi) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  }
  var step = 0.5;
  var xs = [55, 110, 165, 220, 275, 330];
  var yFor = function (v) { return 190 - (v - lo) / (hi - lo) * 175; };

  var s = '<svg viewBox="0 0 500 200" class="chart-svg">';
  for (var g = lo; g <= hi + 0.0001; g = Math.round((g + step) * 10) / 10) {
    var gy = yFor(g);
    s += '<line x1="40" y1="' + gy.toFixed(1) + '" x2="360" y2="' + gy.toFixed(1) + '" stroke="#ccc" stroke-dasharray="2,2" />';
    s += '<text x="35" y="' + (gy + 3).toFixed(1) + '" font-size="9" text-anchor="end">' + g.toFixed(2) + '</text>';
  }
  s += '<line x1="40" y1="10" x2="40" y2="190" stroke="#888" />';
  s += '<line x1="40" y1="190" x2="360" y2="190" stroke="#888" />';

  var pts = [];
  for (var p = 0; p < vals.length; p++) {
    var n2 = parseFloat(vals[p]);
    if (!isNaN(n2)) pts.push(xs[p] + ',' + yFor(n2).toFixed(1));
  }
  if (pts.length > 0) {
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#8ea9db" stroke-width="2.5" stroke-dasharray="3,3" />';
  }
  for (var m = 0; m < vals.length; m++) {
    var n3 = parseFloat(vals[m]);
    if (isNaN(n3)) continue;
    var x = xs[m], y = yFor(n3);
    s += '<polygon points="' + x + ',' + (y - 4).toFixed(1) + ' ' + (x + 4) + ',' + y.toFixed(1) + ' ' + x + ',' + (y + 4).toFixed(1) + ' ' + (x - 4) + ',' + y.toFixed(1) + '" fill="#5b9bd5" />';
    var ly = y - 7;
    if (ly < 12) ly = y + 14;
    s += '<text x="' + x + '" y="' + ly.toFixed(1) + '" font-size="9" font-weight="bold" text-anchor="middle">' + n3.toFixed(2) + '</text>';
  }
  s += '</svg>';
  return s;
}
