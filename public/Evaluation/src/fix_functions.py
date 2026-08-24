import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

missing_funcs = """
        function showLoadingOverlay(show) {
            const overlay = document.getElementById('loadOverlay');
            if (!overlay) return;
            if (show) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }

        function setButtonsLoading(isLoading) {
            const b2 = document.getElementById('btnSaveBottom');
            if (isLoading) {
                if (b2) { b2.disabled = true; b2.innerText = 'กำลังประมวลผล...'; }
            } else {
                if (b2) {
                    b2.disabled = false;
                    const txt = IS_SUPERVISOR_MODE ? 'อนุมัติและสร้าง PDF' : 'ส่งแบบประเมิน (ให้หัวหน้างาน)';
                    b2.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> ${txt}`;
                }
            }
        }

        function submitForm() {"""

html = html.replace("function submitForm() {", missing_funcs)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Restored missing functions")
