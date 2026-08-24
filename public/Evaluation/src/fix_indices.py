import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
code_path = os.path.join(DIR, "รหัส.js")

with open(code_path, "r", encoding="utf-8") as f:
    code = f.read()

# Replace getPendingTasks
old_pending = """function getPendingTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data');
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  var data = sheet.getRange(2, 1, lastRow - 1, 48).getValues();
  var pendingTasks = [];
  
  for (var i = 0; i < data.length; i++) {
    var status = data[i][47];
    if (status === 'WAITING_SUPERVISOR') {
      pendingTasks.push({
        recordId: data[i][46],
        timestamp: data[i][0],
        courseName: data[i][1],
        empName: data[i][5],
        empId: data[i][6],
        department: data[i][7]
      });
    }
  }
  return pendingTasks;
}"""

new_pending = """function getPendingTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data');
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  var data = sheet.getRange(2, 1, lastRow - 1, 49).getValues();
  var pendingTasks = [];
  
  for (var i = 0; i < data.length; i++) {
    var status = data[i][48]; // Status is index 48
    if (status === 'WAITING_SUPERVISOR') {
      pendingTasks.push({
        recordId: data[i][47], // Record_ID is index 47
        timestamp: data[i][0],
        courseName: data[i][1],
        empName: data[i][5],
        empId: data[i][6],
        department: data[i][7]
      });
    }
  }
  return pendingTasks;
}"""
code = code.replace(old_pending, new_pending)

# Replace getTaskById
old_task = """function getTaskById(recordId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data');
  if (!sheet) return null;
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  
  var data = sheet.getRange(2, 1, lastRow - 1, 48).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][46] === recordId) {
      return data[i];
    }
  }
  return null;
}"""

new_task = """function getTaskById(recordId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('data');
  if (!sheet) return null;
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  
  var data = sheet.getRange(2, 1, lastRow - 1, 49).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][47] === recordId) {
      return data[i];
    }
  }
  return null;
}"""
code = code.replace(old_task, new_task)

# Fix saveSupervisorData
old_sup_data = """  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data');
    if (!sheet) throw new Error("ไม่พบชีต data");

    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 48).getValues();
    var targetRowIndex = -1;
    var rowData = null;

    for (var i = 0; i < data.length; i++) {
      if (data[i][46] === recordId) {
        if (data[i][47] === 'COMPLETED') {
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

    // นำ supData (ข้อมูลหัวหน้าที่ส่งมา) ไปอัปเดตใส่ rowData ที่ตำแหน่งที่เกี่ยวข้อง (29-44)
    // หัวหน้างาน 1-5 (29-33)
    rowData[29] = supData[0];
    rowData[30] = supData[1];
    rowData[31] = supData[2];
    rowData[32] = supData[3];
    rowData[33] = supData[4];
    rowData[34] = supData[5]; // คะแนนรวม
    rowData[35] = supData[6]; // follow_interview
    rowData[36] = supData[7]; // follow_test
    rowData[37] = supData[8]; // follow_observe
    rowData[38] = supData[9]; // follow_other_check
    rowData[39] = supData[10]; // follow_other_detail
    rowData[40] = supData[11]; // sat
    rowData[41] = supData[12]; // sup_comment_1
    rowData[42] = supData[13]; // sup_comment_2
    
    // บันทึกลายเซ็นหัวหน้า (ตำแหน่ง 43)
    var sig2_base64 = supData[14];
    if (sig2_base64 && sig2_base64.indexOf('base64,') !== -1) {
      var fileName2 = 'Sig_Supervisor_' + empId + '_' + timeStampClean + '.png';
      rowData[43] = saveBase64ToDrive(sig2_base64, fileName2, DRIVE_FOLDER_ID);
    } else {
      rowData[43] = '';
    }
    
    rowData[44] = supData[15]; // sup_name_bracket

    // เตรียมตัวแปรสำหรับสร้าง PDF
    var d = {
      course_name: rowData[1], start_date: rowData[2], end_date: rowData[3],
      speaker: rowData[4], emp_name: rowData[5], emp_id: rowData[6], department: rowData[7],
      p1_1: rowData[8], p1_2: rowData[9], p1_3: rowData[10], p1_4: rowData[11], p1_5: rowData[12],
      p2_1: rowData[13], p2_2: rowData[14], p2_3: rowData[15], p2_4: rowData[16],
      p3_1: rowData[17], p3_2: rowData[18], p3_3: rowData[19], p3_4: rowData[20], p3_5: rowData[21],
      benefit_1: rowData[22], benefit_2: rowData[23], next_topic_1: rowData[24], next_topic_2: rowData[25],
      comment_1: rowData[26], comment_2: rowData[27],
      sig1_raw: rowData[27], // ลายเซ็น LH5 URL ผู้เข้าอบรม
      attendee_name_bracket: rowData[28],
      sup_1: rowData[29], sup_2: rowData[30], sup_3: rowData[31], sup_4: rowData[32], sup_5: rowData[33],
      total_score: rowData[34], follow_interview: rowData[35], follow_test: rowData[36], follow_observe: rowData[37],
      follow_other_check: rowData[38], follow_other_detail: rowData[39], sat: rowData[40],
      sup_comment_1: rowData[41], sup_comment_2: rowData[42],
      sig2_raw: rowData[43], // ลายเซ็น LH5 URL หัวหน้า
      sup_name_bracket: rowData[44]
    };

    // สร้าง PDF
    var pdfUrl = createPdfFromHtml(d, timeStampClean, DRIVE_FOLDER_ID);
    rowData[45] = pdfUrl;
    rowData[47] = 'COMPLETED';"""

new_sup_data = """  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('data');
    if (!sheet) throw new Error("ไม่พบชีต data");

    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 49).getValues();
    var targetRowIndex = -1;
    var rowData = null;

    for (var i = 0; i < data.length; i++) {
      if (data[i][47] === recordId) {
        if (data[i][48] === 'COMPLETED') {
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
    var d = {
      course_name: rowData[1], start_date: rowData[2], end_date: rowData[3],
      speaker: rowData[4], emp_name: rowData[5], emp_id: rowData[6], department: rowData[7],
      p1_1: rowData[8], p1_2: rowData[9], p1_3: rowData[10], p1_4: rowData[11], p1_5: rowData[12],
      p2_1: rowData[13], p2_2: rowData[14], p2_3: rowData[15], p2_4: rowData[16],
      p3_1: rowData[17], p3_2: rowData[18], p3_3: rowData[19], p3_4: rowData[20], p3_5: rowData[21],
      benefit_1: rowData[22], benefit_2: rowData[23], next_topic_1: rowData[24], next_topic_2: rowData[25],
      comment_1: rowData[26], comment_2: rowData[27],
      sig1_raw: rowData[28], // ลายเซ็น LH5 URL ผู้เข้าอบรม
      attendee_name_bracket: rowData[29],
      sup_1: rowData[30], sup_2: rowData[31], sup_3: rowData[32], sup_4: rowData[33], sup_5: rowData[34],
      total_score: rowData[35], follow_interview: rowData[36], follow_test: rowData[37], follow_observe: rowData[38],
      follow_other_check: rowData[39], follow_other_detail: rowData[40], sat: rowData[41],
      sup_comment_1: rowData[42], sup_comment_2: rowData[43],
      sig2_raw: rowData[44], // ลายเซ็น LH5 URL หัวหน้า
      sup_name_bracket: rowData[45]
    };

    // สร้าง PDF
    var pdfUrl = createPdfFromHtml(d, timeStampClean, DRIVE_FOLDER_ID);
    rowData[46] = pdfUrl;
    rowData[48] = 'COMPLETED';"""

code = code.replace(old_sup_data, new_sup_data)

with open(code_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Fixed array indices!")
