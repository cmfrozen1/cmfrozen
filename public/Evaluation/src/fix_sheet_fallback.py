import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
code_path = os.path.join(DIR, "รหัส.js")

with open(code_path, "r", encoding="utf-8") as f:
    code = f.read()

# Fix getPendingTasks sheet retrieval
code = code.replace(
    "var sheet = ss.getSheetByName('data');\n  if (!sheet) return [];",
    "var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();\n  if (!sheet) return [];"
)

# Fix getTaskById sheet retrieval
code = code.replace(
    "var sheet = ss.getSheetByName('data');\n  if (!sheet) return null;",
    "var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();\n  if (!sheet) return null;"
)

# Fix saveSupervisorData sheet retrieval
code = code.replace(
    "var sheet = ss.getSheetByName('data');\n    if (!sheet) throw new Error(\"ไม่พบชีต data\");",
    "var sheet = ss.getSheetByName('data') || ss.getSheetByName('Data') || ss.getActiveSheet();\n    if (!sheet) throw new Error(\"ไม่พบชีตสำหรับเก็บข้อมูล\");"
)

with open(code_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Sheet fallbacks added successfully!")
