import re

with open('src/Index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_bar = """<div class="bar" id="bar"><button class="btn" id="show" type="button">ดูตัวอย่างใบลา</button><button class="btn"
      id="pdfNow" type="button">📄 ดู PDF</button><button class="btn pri" id="save" type="button">บันทึกลง
      Sheet</button></div>"""

new_bar = """<div class="bar" id="bar"><button class="btn" id="show" type="button" style="display:none;">ดูตัวอย่างใบลา</button><button class="btn"
      id="pdfNow" type="button" style="display:none;">📄 ดู PDF</button><button class="btn pri" id="save" type="button">บันทึกลง
      Sheet</button></div>"""

content = content.replace(old_bar, new_bar)

with open('src/Index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched Index.html successfully")
