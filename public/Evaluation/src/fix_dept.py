import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

# Fix table header
old_th = """                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">หลักสูตร</th>
                            <th class="px-4 py-2 text-center text-xs font-medium text-gray-500">จัดการ</th>"""
new_th = """                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">หลักสูตร</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">แผนก</th>
                            <th class="px-4 py-2 text-center text-xs font-medium text-gray-500">จัดการ</th>"""
html = html.replace(old_th, new_th)

# Fix table body
old_td = """                                    <td class="px-4 py-2 text-xs text-gray-500 max-w-xs truncate" title="${task.courseName}">${task.courseName}</td>
                                    <td class="px-4 py-2 whitespace-nowrap text-center text-xs">"""
new_td = """                                    <td class="px-4 py-2 text-xs text-gray-500 max-w-xs truncate" title="${task.courseName}">${task.courseName}</td>
                                    <td class="px-4 py-2 text-xs text-gray-500">${task.department || '-'}</td>
                                    <td class="px-4 py-2 whitespace-nowrap text-center text-xs">"""
html = html.replace(old_td, new_td)

# Just to be extremely safe, update loadExistingData dept setting to handle spaces
old_dept = """                        // Set Department
                        const deptSel = document.getElementById('department');
                        if (deptSel) {
                            if (!Array.from(deptSel.options).some(o => o.value === data[7])) {
                                deptSel.add(new Option(data[7], data[7]));
                            }
                            deptSel.value = data[7];
                        }"""
new_dept = """                        // Set Department
                        const deptSel = document.getElementById('department');
                        if (deptSel) {
                            const dVal = String(data[7] || '').trim();
                            if (dVal) {
                                if (!Array.from(deptSel.options).some(o => o.value === dVal)) {
                                    deptSel.add(new Option(dVal, dVal));
                                }
                                deptSel.value = dVal;
                            }
                        }"""
html = html.replace(old_dept, new_dept)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Department column restored.")
