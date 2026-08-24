import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

load_depts_code = """        function loadDepartments() {
            const deptEl = document.getElementById('department');
            if (!deptEl) return;

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(function (depts) {
                        deptEl.innerHTML = '<option value="">-- เลือกแผนก --</option>';
                        if (depts && depts.length > 0) {
                            depts.forEach(d => {
                                const opt = document.createElement('option');
                                opt.value = d;
                                opt.textContent = d;
                                deptEl.appendChild(opt);
                            });
                        } else {
                            deptEl.innerHTML = '<option value="">-- ไม่มีข้อมูลแผนก --</option>';
                        }
                    })
                    .withFailureHandler(function (err) {
                        console.error('Error loading depts:', err);
                        deptEl.innerHTML = '<option value="">-- โหลดแผนกไม่สำเร็จ --</option>';
                    })
                    .getDepartments();
            } else {
                // local preview fallback
                const mockDepts = ["IT", "HR", "Production", "QA", "QC", "Maintenance", "Store", "Logistics"];
                deptEl.innerHTML = '<option value="">-- เลือกแผนก --</option>';
                mockDepts.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    deptEl.appendChild(opt);
                });
            }
        }

        window.onload = function () {"""

html = html.replace("window.onload = function () {", load_depts_code)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("loadDepartments function defined successfully!")
