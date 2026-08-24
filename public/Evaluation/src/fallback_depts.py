import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
code_path = os.path.join(DIR, "รหัส.js")

with open(code_path, "r", encoding="utf-8") as f:
    code = f.read()

old_get_depts = """function getDepartments() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('dept');
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var depts = [];
    data.forEach(function (row) {
      var val = row[0] ? row[0].toString().trim() : '';
      if (val !== '') depts.push(val);
    });
    return depts;
  } catch (err) {
    Logger.log("Error in getDepartments: " + err.toString());
    return [];
  }
}"""

new_get_depts = """function getDepartments() {
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
      if (val !== '') depts.push(val);
    });
    
    return depts.length > 0 ? depts : fallbackDepts;
  } catch (err) {
    Logger.log("Error in getDepartments: " + err.toString());
    return ["HR", "IT", "Production", "QA", "QC", "Maintenance", "Store", "Logistics"];
  }
}"""

code = code.replace(old_get_depts, new_get_depts)

with open(code_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Updated getDepartments with fallback options")
