import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

date_dropdowns_code = """        function buildDateDropdowns() {
            const months = [
                { val: '01', text: 'ม.ค.' },
                { val: '02', text: 'ก.พ.' },
                { val: '03', text: 'มี.ค.' },
                { val: '04', text: 'เม.ย.' },
                { val: '05', text: 'พ.ค.' },
                { val: '06', text: 'มิ.ย.' },
                { val: '07', text: 'ก.ค.' },
                { val: '08', text: 'ส.ค.' },
                { val: '09', text: 'ก.ย.' },
                { val: '10', text: 'ต.ค.' },
                { val: '11', text: 'พ.ย.' },
                { val: '12', text: 'ธ.ค.' }
            ];

            function populate(prefix) {
                const dEl = document.getElementById(prefix + '_day');
                const mEl = document.getElementById(prefix + '_month');
                const yEl = document.getElementById(prefix + '_year');

                if (dEl) {
                    dEl.innerHTML = '<option value="">วัน</option>';
                    for (let i = 1; i <= 31; i++) {
                        dEl.add(new Option(i, i));
                    }
                }
                if (mEl) {
                    mEl.innerHTML = '<option value="">เดือน</option>';
                    months.forEach(m => {
                        mEl.add(new Option(m.text, m.val));
                    });
                }
                if (yEl) {
                    yEl.innerHTML = '<option value="">ปี</option>';
                    const currentYear = new Date().getFullYear();
                    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
                        yEl.add(new Option(i + 543, i + 543));
                    }
                }
            }

            populate('start');
            populate('end');
        }

        function loadDepartments() {"""

html = html.replace("function loadDepartments() {", date_dropdowns_code)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("buildDateDropdowns added successfully!")
