import os
import re

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"

# 1. Modify Code.js (รหัส.js)
code_path = os.path.join(DIR, "รหัส.js")
with open(code_path, "r", encoding="utf-8") as f:
    code = f.read()

# Replace doGet
code = re.sub(
    r"function doGet\(e\) \{.*?\}",
    """function doGet(e) {
  var page = (e.parameter && e.parameter.page) ? e.parameter.page : 'index';
  var title = page === 'dashboard' ? 'แดชบอร์ดหัวหน้างาน - รอประเมิน' : 'แบบประเมินผลการฝึกอบรม (F-HR-004/03)';
  var template = HtmlService.createTemplateFromFile(page);
  
  if (e.parameter && e.parameter.id) {
    template.recordId = e.parameter.id;
  }
  
  return template.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}""",
    code,
    flags=re.DOTALL
)

# Replace initDatabase headers
code = code.replace(
    '"PDF Report (URL/lh5)"',
    '"PDF Report (URL/lh5)",\n    "Record_ID",\n    "Status"'
)

# Append new backend functions
new_backend_functions = """
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

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    var empId = (rowData && rowData[5]) ? rowData[5] : 'EMP';
    var timeStampClean = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
    var recordId = empId + '_' + timeStampClean;

    // บันทึกลายเซ็นผู้เข้าอบรม (ตำแหน่งดัชนี 27) ลง Google Drive
    if (rowData && rowData[27] && rowData[27].indexOf('base64,') !== -1) {
      var fileName1 = 'Sig_Attendee_' + empId + '_' + timeStampClean + '.png';
      rowData[27] = saveBase64ToDrive(rowData[27], fileName1, DRIVE_FOLDER_ID);
    }

    // PDF URL ยังไม่มีในขั้นตอนนี้
    rowData.push(''); // 45: PDF URL
    rowData.push(recordId); // 46: Record_ID
    rowData.push('WAITING_SUPERVISOR'); // 47: Status

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
 */
function getPendingTasks() {
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
}

/**
 * ดึงข้อมูลการประเมินตาม Record_ID (สำหรับแสดงให้หัวหน้าดู)
 */
function getTaskById(recordId) {
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
}

/**
 * บันทึกข้อมูลส่วนของหัวหน้างาน (Supervisor) และออก PDF
 */
function saveSupervisorData(recordId, supData) {
  try {
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
      sig1_raw: rowData[28], // ลายเซ็น LH5 URL ผู้เข้าอบรม (pdf_template ต้องการ URL หรือ base64)
      attendee_name_bracket: rowData[29],
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
    rowData[47] = 'COMPLETED';

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
"""
code += new_backend_functions

with open(code_path, "w", encoding="utf-8") as f:
    f.write(code)


# 2. Modify index.html (Add logic to load data and disable fields if it's supervisor mode)
index_path = os.path.join(DIR, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    index_html = f.read()

# Replace collectFormData and submitForm
replacement_js = """
        // Inject Record ID if exists (Supervisor Mode)
        const URL_RECORD_ID = '<?!= typeof recordId !== "undefined" ? recordId : "" ?>';
        let IS_SUPERVISOR_MODE = URL_RECORD_ID !== '';

        function loadExistingData() {
            if (!IS_SUPERVISOR_MODE) return;
            
            showLoadingOverlay(true);
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(function (data) {
                        showLoadingOverlay(false);
                        if (!data) {
                            alert("ไม่พบข้อมูลการประเมิน หรือข้อมูลถูกประเมินไปแล้ว");
                            window.location.href = '?page=dashboard';
                            return;
                        }
                        
                        // Populate Trainee Data and Lock it
                        document.getElementById('course_name').value = data[1] || '';
                        document.getElementById('speaker').value = data[4] || '';
                        document.getElementById('emp_name').value = data[5] || '';
                        document.getElementById('emp_id').value = data[6] || '';
                        
                        // Set Dates (Basic split by space since it's saved as "D Mon YYYY")
                        // For simplicity, we just show them as read-only text or let them be since we disable inputs
                        
                        // Disable all trainee inputs
                        document.querySelectorAll('input, select, textarea').forEach(el => {
                            const name = el.name || el.id;
                            if (name && !name.startsWith('sup_') && name !== 'total_score' && !name.startsWith('follow_') && name !== 'sat') {
                                el.disabled = true;
                                if (el.type === 'text' || el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'select') {
                                    el.classList.add('bg-gray-100');
                                }
                            }
                        });
                        
                        // Check radio buttons manually based on data (index 8 to 22)
                        const radioMap = [
                            {id: 'p1_1', val: data[8]}, {id: 'p1_2', val: data[9]}, {id: 'p1_3', val: data[10]},
                            {id: 'p1_4', val: data[11]}, {id: 'p1_5', val: data[12]}, {id: 'p2_1', val: data[13]},
                            {id: 'p2_2', val: data[14]}, {id: 'p2_3', val: data[15]}, {id: 'p2_4', val: data[16]},
                            {id: 'p3_1', val: data[17]}, {id: 'p3_2', val: data[18]}, {id: 'p3_3', val: data[19]},
                            {id: 'p3_4', val: data[20]}, {id: 'p3_5', val: data[21]}
                        ];
                        radioMap.forEach(item => {
                            if (item.val) {
                                const radio = document.querySelector(`input[name="${item.id}"][value="${item.val}"]`);
                                if (radio) radio.checked = true;
                            }
                        });
                        
                        document.getElementById('benefit_1').value = data[22] || '';
                        document.getElementById('benefit_2').value = data[23] || '';
                        document.getElementById('next_topic_1').value = data[24] || '';
                        document.getElementById('next_topic_2').value = data[25] || '';
                        document.getElementById('comment_1').value = data[26] || '';
                        document.getElementById('comment_2').value = data[27] || '';
                        
                        // Hide Trainee Signature pad, just show text that it's signed
                        document.getElementById('sig1').style.display = 'none';
                        const sig1Btn = document.getElementById('sig1').nextElementSibling;
                        if (sig1Btn) sig1Btn.style.display = 'none';
                        document.getElementById('attendee_name_bracket').value = data[29] || '';
                        
                        const msg = document.createElement('div');
                        msg.className = 'text-green-600 font-bold p-4 bg-green-50 rounded-lg text-center border border-green-200';
                        msg.innerHTML = '✅ ผู้เข้าอบรมเซ็นชื่อเรียบร้อยแล้ว<br><img src="' + data[28] + '" style="max-height:80px; margin:10px auto;">';
                        document.getElementById('sig1').parentElement.prepend(msg);

                        // Scroll to supervisor section
                        setTimeout(() => {
                            document.getElementById('sup_name_bracket').scrollIntoView({ behavior: 'smooth', block: 'end' });
                            
                            if (typeof Swal !== 'undefined') {
                                Swal.fire({
                                    title: 'โหลดข้อมูลสำเร็จ',
                                    text: 'กรุณากรอกคะแนนประเมินในส่วนของหัวหน้างาน',
                                    icon: 'info',
                                    timer: 2000,
                                    showConfirmButton: false
                                });
                            }
                        }, 500);

                    })
                    .withFailureHandler(function (error) {
                        showLoadingOverlay(false);
                        alert("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + error);
                    })
                    .getTaskById(URL_RECORD_ID);
            }
        }

        function collectSupervisorData() {
            return [
                getRadioVal('sup_1'),                                         // 0
                getRadioVal('sup_2'),                                         // 1
                getRadioVal('sup_3'),                                         // 2
                getRadioVal('sup_4'),                                         // 3
                getRadioVal('sup_5'),                                         // 4
                document.getElementById('total_score').value.trim(),           // 5
                getCheckboxVal('follow_interview'),                           // 6
                getCheckboxVal('follow_test'),                                // 7
                getCheckboxVal('follow_observe'),                             // 8
                getCheckboxVal('follow_other_check'),                         // 9
                document.getElementById('follow_other_detail').value.trim(),   // 10
                getRadioVal('sat'),                                           // 11
                document.getElementById('sup_comment_1').value.trim(),         // 12
                document.getElementById('sup_comment_2').value.trim(),         // 13
                getCanvasBase64('sig2'),                                      // 14
                document.getElementById('sup_name_bracket').value.trim()      // 15
            ];
        }

        function collectFormData() {
            return [
                document.getElementById('course_name').value.trim(),
                getDateValue('start'),
                getDateValue('end'),
                document.getElementById('speaker').value.trim(),
                document.getElementById('emp_name').value.trim(),
                document.getElementById('emp_id').value.trim(),
                document.getElementById('department').value.trim(),
                getRadioVal('p1_1'), getRadioVal('p1_2'), getRadioVal('p1_3'), getRadioVal('p1_4'), getRadioVal('p1_5'),
                getRadioVal('p2_1'), getRadioVal('p2_2'), getRadioVal('p2_3'), getRadioVal('p2_4'),
                getRadioVal('p3_1'), getRadioVal('p3_2'), getRadioVal('p3_3'), getRadioVal('p3_4'), getRadioVal('p3_5'),
                document.getElementById('benefit_1').value.trim(),
                document.getElementById('benefit_2').value.trim(),
                document.getElementById('next_topic_1').value.trim(),
                document.getElementById('next_topic_2').value.trim(),
                document.getElementById('comment_1').value.trim(),
                document.getElementById('comment_2').value.trim(),
                getCanvasBase64('sig1'),
                document.getElementById('attendee_name_bracket').value.trim()
                // Not passing supervisor data in Trainee form
            ];
        }

        function submitForm() {
            if (IS_SUPERVISOR_MODE) {
                submitSupervisorForm();
                return;
            }

            if (!validateAndHighlightFormTrainee()) {
                return;
            }

            const rowData = collectFormData();
            showLoadingOverlay(true);
            setButtonsLoading(true);

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(function (response) {
                        showLoadingOverlay(false);
                        setButtonsLoading(false);
                        const msg = (response && response.message) ? response.message : 'บันทึกสำเร็จ';
                        
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'success',
                                title: 'ส่งแบบประเมินสำเร็จ!',
                                text: msg,
                                confirmButtonColor: '#059669',
                                confirmButtonText: 'ตกลง'
                            }).then(() => {
                                window.location.reload();
                            });
                        } else {
                            alert('✅ ' + msg);
                            window.location.reload();
                        }
                    })
                    .withFailureHandler(function (error) {
                        showLoadingOverlay(false);
                        setButtonsLoading(false);
                        alert('❌ เกิดข้อผิดพลาด: ' + error);
                    })
                    .saveTraineeData(rowData);
            }
        }

        function submitSupervisorForm() {
            // Validate Supervisor Fields
            const supGroups = [
                { name: 'sup_1', label: 'หัวหน้างานประเมิน ข้อ 1' },
                { name: 'sup_2', label: 'หัวหน้างานประเมิน ข้อ 2' },
                { name: 'sup_3', label: 'หัวหน้างานประเมิน ข้อ 3' },
                { name: 'sup_4', label: 'หัวหน้างานประเมิน ข้อ 4' },
                { name: 'sup_5', label: 'หัวหน้างานประเมิน ข้อ 5' }
            ];
            for (let s of supGroups) {
                const checked = document.querySelector(`input[name="${s.name}"]:checked`);
                if (!checked) {
                    highlightElement(document.querySelector(`input[name="${s.name}"]`), `กรุณาประเมิน "${s.label}"`);
                    return;
                }
            }
            if (isCanvasBlank('sig2')) {
                highlightElement(document.getElementById('sig2'), 'กรุณาลงลายเซ็นหัวหน้างาน');
                return;
            }

            const supData = collectSupervisorData();
            showLoadingOverlay(true);
            setButtonsLoading(true);

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(function (response) {
                        showLoadingOverlay(false);
                        setButtonsLoading(false);
                        if (response.success) {
                            if (typeof Swal !== 'undefined') {
                                Swal.fire({
                                    icon: 'success',
                                    title: 'อนุมัติสำเร็จ!',
                                    text: response.message,
                                    showCancelButton: true,
                                    confirmButtonColor: '#059669',
                                    cancelButtonColor: '#4b5563',
                                    confirmButtonText: 'พิมพ์ / เปิดดู PDF',
                                    cancelButtonText: 'กลับหน้า Dashboard'
                                }).then((result) => {
                                    if (result.isConfirmed && response.pdfUrl) {
                                        window.open(response.pdfUrl, '_blank');
                                    }
                                    window.location.href = '?page=dashboard';
                                });
                            }
                        } else {
                            alert('❌ ' + response.message);
                        }
                    })
                    .withFailureHandler(function (error) {
                        showLoadingOverlay(false);
                        setButtonsLoading(false);
                        alert('❌ เกิดข้อผิดพลาด: ' + error);
                    })
                    .saveSupervisorData(URL_RECORD_ID, supData);
            }
        }

        function validateAndHighlightFormTrainee() {
            // Trainee validation only (same as old validateAndHighlightForm but without supervisor part)
            const textFields = [
                { id: 'course_name', name: 'ชื่อหลักสูตร' },
                { id: 'speaker', name: 'วิทยากร' },
                { id: 'emp_name', name: 'ชื่อ - นามสกุล' },
                { id: 'emp_id', name: 'รหัสพนักงาน' },
            ];

            for (let f of textFields) {
                const input = document.getElementById(f.id);
                if (!input || !input.value.toString().trim()) {
                    highlightElement(input, `กรุณากรอก "${f.name}"`);
                    return false;
                }
            }
            
            if (isCanvasBlank('sig1')) {
                highlightElement(document.getElementById('sig1'), 'กรุณาลงลายเซ็นผู้เข้าร่วมอบรม');
                return false;
            }
            return true;
        }

        // --- Window OnLoad Extension ---
        const originalOnLoad = window.onload;
        window.onload = function () {
            if (originalOnLoad) originalOnLoad();
            
            if (IS_SUPERVISOR_MODE) {
                // Update UI for Supervisor
                const topHeader = document.querySelector('.bg-blue-600 h1');
                if (topHeader) topHeader.innerText = 'แบบประเมิน - ส่วนของหัวหน้างาน';
                loadExistingData();
            } else {
                // Hide Supervisor Section in Trainee mode?
                // For better UX, we could fade it out or show a message.
                // Let's just lock the supervisor section for trainees
                document.querySelectorAll('input[name^="sup_"], input[name^="follow_"], input[name="sat"], #sup_comment_1, #sup_comment_2, #sup_name_bracket').forEach(el => {
                    el.disabled = true;
                });
                const sig2 = document.getElementById('sig2');
                if (sig2) {
                    sig2.style.pointerEvents = 'none';
                    sig2.style.opacity = '0.5';
                }
                const btnSaveBottom = document.getElementById('btnSaveBottom');
                if (btnSaveBottom) btnSaveBottom.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> ส่งแบบประเมิน (ให้หัวหน้างาน)`;
            }
        };
"""

index_html = re.sub(r"function collectFormData\(\).*?window\.onload = function \(\) \{", replacement_js + "        window.onload = function () {", index_html, flags=re.DOTALL)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(index_html)

# 3. Create dashboard.html
dashboard_html = """<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>แดชบอร์ดหัวหน้างาน - แบบประเมิน</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Sarabun', sans-serif; background-color: #f3f4f6; }
    </style>
</head>
<body class="p-6">
    <div class="max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div class="bg-blue-700 text-white p-6">
            <h1 class="text-2xl font-bold">📋 รายการรอประเมินจากหัวหน้างาน</h1>
            <p class="text-blue-100 mt-2">รายการทั้งหมดด้านล่างนี้ ผู้เข้าอบรมได้ทำการเซ็นชื่อแล้ว รอหัวหน้างานประเมินในขั้นตอนสุดท้าย</p>
        </div>
        
        <div class="p-6">
            <div id="loading" class="text-center py-10">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
            
            <div id="noData" class="hidden text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">ไม่มีรายการค้าง</h3>
                <p class="mt-1 text-sm text-gray-500">ยอดเยี่ยม! คุณประเมินทุกรายการเสร็จสิ้นแล้ว</p>
            </div>

            <div class="overflow-x-auto">
                <table id="taskTable" class="min-w-full divide-y divide-gray-200 hidden">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่ส่ง</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รหัสพนง.</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อ - นามสกุล</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หลักสูตร</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">แผนก</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="taskBody" class="bg-white divide-y divide-gray-200">
                        <!-- Rows will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        function loadData() {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(function (data) {
                        document.getElementById('loading').classList.add('hidden');
                        const tbody = document.getElementById('taskBody');
                        
                        if (!data || data.length === 0) {
                            document.getElementById('noData').classList.remove('hidden');
                        } else {
                            document.getElementById('taskTable').classList.remove('hidden');
                            data.forEach(task => {
                                const tr = document.createElement('tr');
                                tr.className = "hover:bg-blue-50 transition-colors";
                                
                                const dateStr = new Date(task.timestamp).toLocaleString('th-TH');
                                
                                tr.innerHTML = `
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dateStr}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${task.empId}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${task.empName}</td>
                                    <td class="px-6 py-4 text-sm text-gray-500">${task.courseName}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${task.department}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <a href="?page=index&id=${task.recordId}" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                            ประเมินและเซ็นชื่อ
                                        </a>
                                    </td>
                                `;
                                tbody.appendChild(tr);
                            });
                        }
                    })
                    .withFailureHandler(function (error) {
                        document.getElementById('loading').innerHTML = `<p class="text-red-500">เกิดข้อผิดพลาด: ${error}</p>`;
                    })
                    .getPendingTasks();
            } else {
                document.getElementById('loading').innerHTML = `<p class="text-red-500">ต้องรันบน Google Apps Script เท่านั้น</p>`;
            }
        }

        window.onload = loadData;
    </script>
</body>
</html>
"""
dashboard_path = os.path.join(DIR, "dashboard.html")
with open(dashboard_path, "w", encoding="utf-8") as f:
    f.write(dashboard_html)

print("Replacement successful.")
