import os
import re

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"

# --- Fix Code.js (รหัส.js) ---
code_path = os.path.join(DIR, "รหัส.js")
with open(code_path, "r", encoding="utf-8") as f:
    code = f.read()

# Fix doGet template.recordId
code = code.replace(
    "if (e.parameter && e.parameter.id) {\n    template.recordId = e.parameter.id;\n  }",
    "template.recordId = (e.parameter && e.parameter.id) ? e.parameter.id : '';"
)

# Fix saveTraineeData array padding
old_trainee = """    // PDF URL ยังไม่มีในขั้นตอนนี้
    rowData.push(''); // 45: PDF URL
    rowData.push(recordId); // 46: Record_ID
    rowData.push('WAITING_SUPERVISOR'); // 47: Status"""

new_trainee = """    // เติม Array ให้ครบ 45 ช่องก่อนเพื่อป้องกันความคลาดเคลื่อนของ Index คอลัมน์หัวหน้างาน
    while (rowData.length < 45) {
      rowData.push('');
    }
    // PDF URL ยังไม่มีในขั้นตอนนี้
    rowData.push(''); // Index 45: PDF Report
    rowData.push(recordId); // Index 46: Record_ID
    rowData.push('WAITING_SUPERVISOR'); // Index 47: Status"""

code = code.replace(old_trainee, new_trainee)

# Fix saveSupervisorData PDF 'd' mapping
old_d_mapping = """      sig1_raw: rowData[28], // ลายเซ็น LH5 URL ผู้เข้าอบรม (pdf_template ต้องการ URL หรือ base64)
      attendee_name_bracket: rowData[29],
      sup_1: rowData[29],"""

new_d_mapping = """      sig1_raw: rowData[27], // ลายเซ็น LH5 URL ผู้เข้าอบรม
      attendee_name_bracket: rowData[28],
      sup_1: rowData[29],"""

code = code.replace(old_d_mapping, new_d_mapping)

with open(code_path, "w", encoding="utf-8") as f:
    f.write(code)


# --- Fix index.html ---
index_path = os.path.join(DIR, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    index_html = f.read()

# Replace URL_RECORD_ID declaration
index_html = index_html.replace(
    "const URL_RECORD_ID = '<?!= typeof recordId !== \"undefined\" ? recordId : \"\" ?>';",
    "const URL_RECORD_ID = '<?= recordId ?>';"
)

# Add Date & Department binding in loadExistingData
old_load_existing = """                        // Set Dates (Basic split by space since it's saved as "D Mon YYYY")
                        // For simplicity, we just show them as read-only text or let them be since we disable inputs"""

new_load_existing = """                        // Set Dates
                        const monthsMap = {'ม.ค.':'01','ก.พ.':'02','มี.ค.':'03','เม.ย.':'04','พ.ค.':'05','มิ.ย.':'06','ก.ค.':'07','ส.ค.':'08','ก.ย.':'09','ต.ค.':'10','พ.ย.':'11','ธ.ค.':'12'};
                        function setDateDropdowns(prefix, dateStr) {
                            if (!dateStr) return;
                            const parts = dateStr.split(' ');
                            if (parts.length === 3) {
                                const dEl = document.getElementById(prefix + '_day');
                                if(dEl) dEl.value = parseInt(parts[0], 10);
                                const mEl = document.getElementById(prefix + '_month');
                                if(mEl) mEl.value = monthsMap[parts[1]] || '';
                                const yEl = document.getElementById(prefix + '_year');
                                if(yEl) yEl.value = parts[2];
                            }
                        }
                        setDateDropdowns('start', data[2]);
                        setDateDropdowns('end', data[3]);
                        
                        // Set Department
                        const deptSel = document.getElementById('department');
                        if (deptSel) {
                            if (!Array.from(deptSel.options).some(o => o.value === data[7])) {
                                deptSel.add(new Option(data[7], data[7]));
                            }
                            deptSel.value = data[7];
                        }"""

index_html = index_html.replace(old_load_existing, new_load_existing)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(index_html)

print("Bug fixes applied successfully!")
