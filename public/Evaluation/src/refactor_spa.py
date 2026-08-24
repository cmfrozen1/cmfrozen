import os
import re

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"

# 1. Update Code.js (รหัส.js)
code_path = os.path.join(DIR, "รหัส.js")
with open(code_path, "r", encoding="utf-8") as f:
    code = f.read()

# Revert doGet to simplest form
code = re.sub(
    r"function doGet\(e\) \{.*?\}",
    """function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ระบบแบบประเมินผลการฝึกอบรม')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}""",
    code,
    flags=re.DOTALL
)

with open(code_path, "w", encoding="utf-8") as f:
    f.write(code)


# 2. Update index.html to be a SPA
index_path = os.path.join(DIR, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    index = f.read()

# Add Tabs HTML right after <body>
tabs_html = """
    <!-- Navigation Tabs -->
    <div class="bg-blue-800 text-white shadow-md sticky top-0 z-50">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-center h-14">
                <div class="flex space-x-4">
                    <button id="tab-trainee" onclick="switchView('trainee')" class="bg-blue-900 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors">
                        📝 ผู้เข้าอบรม (สร้างใหม่)
                    </button>
                    <button id="tab-dashboard" onclick="switchView('dashboard')" class="text-blue-200 hover:bg-blue-700 hover:text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors">
                        📋 หัวหน้างาน (รอประเมิน)
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- View: Dashboard -->
    <div id="view-dashboard" class="hidden page-container max-w-4xl mx-auto my-6 p-4 bg-white rounded-lg shadow">
        <div class="bg-blue-700 text-white p-4 rounded-t-lg">
            <h1 class="text-xl font-bold">📋 รายการรอประเมินจากหัวหน้างาน</h1>
            <p class="text-blue-100 text-sm mt-1">รายการทั้งหมดด้านล่างนี้ ผู้เข้าอบรมได้ทำการเซ็นชื่อแล้ว รอหัวหน้างานประเมินในขั้นตอนสุดท้าย</p>
        </div>
        <div class="p-4 border border-t-0 rounded-b-lg">
            <div id="loading" class="text-center py-10 hidden">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
            <div id="noData" class="hidden text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">ไม่มีรายการค้าง</h3>
            </div>
            <div class="overflow-x-auto">
                <table id="taskTable" class="min-w-full divide-y divide-gray-200 hidden">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">วันที่ส่ง</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">ผู้เข้าอบรม</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">หลักสูตร</th>
                            <th class="px-4 py-2 text-center text-xs font-medium text-gray-500">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="taskBody" class="bg-white divide-y divide-gray-200 text-sm">
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <!-- View: Form -->
    <div id="view-form" class="block">
"""

# Inject after <body> tag
index = index.replace('<body class="p-6">', '<body class="bg-gray-100">\n' + tabs_html)
# If original body tag was different:
index = index.replace('<body>', '<body class="bg-gray-100">\n' + tabs_html)
if '<body>' not in index and '<body class="p-6">' not in index:
    # Try generic matching
    index = re.sub(r'<body.*?>', '<body class="bg-gray-100">\n' + tabs_html, index, count=1)

# Add closing div for view-form before script
index = index.replace('<script>', '</div>\n\n    <script>')

# Update JavaScript to handle SPA view switching
js_spa_logic = """
        let currentRecordId = '';
        let IS_SUPERVISOR_MODE = false;

        function switchView(viewName) {
            const btnTrainee = document.getElementById('tab-trainee');
            const btnDashboard = document.getElementById('tab-dashboard');
            const viewForm = document.getElementById('view-form');
            const viewDashboard = document.getElementById('view-dashboard');
            
            // Reset active styles
            btnTrainee.className = 'text-blue-200 hover:bg-blue-700 hover:text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors';
            btnDashboard.className = 'text-blue-200 hover:bg-blue-700 hover:text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors';
            
            if (viewName === 'trainee') {
                btnTrainee.className = 'bg-blue-900 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors';
                viewForm.classList.remove('hidden');
                viewDashboard.classList.add('hidden');
                prepareTraineeMode();
            } else if (viewName === 'dashboard') {
                btnDashboard.className = 'bg-blue-900 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors';
                viewForm.classList.add('hidden');
                viewDashboard.classList.remove('hidden');
                loadDashboardData();
            } else if (viewName === 'supervisor_form') {
                btnDashboard.className = 'bg-blue-900 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors';
                viewForm.classList.remove('hidden');
                viewDashboard.classList.add('hidden');
                // prepareSupervisorMode is called separately with recordId
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function prepareTraineeMode() {
            IS_SUPERVISOR_MODE = false;
            currentRecordId = '';
            const topHeader = document.querySelector('#view-form .bg-blue-600 h1');
            if (topHeader) topHeader.innerText = 'แบบประเมินผลการฝึกอบรม (F-HR-004/03)';
            
            // Unlock all inputs
            document.querySelectorAll('#view-form input, #view-form select, #view-form textarea').forEach(el => {
                el.disabled = false;
                el.classList.remove('bg-gray-100');
            });
            
            // Lock Supervisor Section for Trainee
            document.querySelectorAll('input[name^="sup_"], input[name^="follow_"], input[name="sat"], #sup_comment_1, #sup_comment_2, #sup_name_bracket').forEach(el => {
                el.disabled = true;
            });
            const sig2 = document.getElementById('sig2');
            if (sig2) {
                sig2.style.pointerEvents = 'none';
                sig2.style.opacity = '0.5';
            }
            
            // Reset Trainee Sig visibility
            document.getElementById('sig1').style.display = 'block';
            const sig1Btn = document.getElementById('sig1').nextElementSibling;
            if (sig1Btn) sig1Btn.style.display = 'inline-flex';
            const oldMsg = document.getElementById('trainee-signed-msg');
            if (oldMsg) oldMsg.remove();
            
            const btnSaveBottom = document.getElementById('btnSaveBottom');
            if (btnSaveBottom) btnSaveBottom.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> ส่งแบบประเมิน (ให้หัวหน้างาน)`;
        }

        function loadDashboardData() {
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('taskTable').classList.add('hidden');
            document.getElementById('noData').classList.add('hidden');
            
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(function (data) {
                        document.getElementById('loading').classList.add('hidden');
                        const tbody = document.getElementById('taskBody');
                        tbody.innerHTML = '';
                        
                        if (!data || data.length === 0) {
                            document.getElementById('noData').classList.remove('hidden');
                        } else {
                            document.getElementById('taskTable').classList.remove('hidden');
                            data.forEach(task => {
                                const tr = document.createElement('tr');
                                tr.className = "hover:bg-blue-50 transition-colors";
                                const dateStr = new Date(task.timestamp).toLocaleString('th-TH');
                                
                                tr.innerHTML = `
                                    <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-500">${dateStr}</td>
                                    <td class="px-4 py-2 text-xs font-medium text-gray-900">${task.empName} <br><span class="text-gray-500">รหัส: ${task.empId}</span></td>
                                    <td class="px-4 py-2 text-xs text-gray-500 max-w-xs truncate" title="${task.courseName}">${task.courseName}</td>
                                    <td class="px-4 py-2 whitespace-nowrap text-center text-xs">
                                        <button onclick="openSupervisorTask('${task.recordId}')" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow">
                                            ประเมิน
                                        </button>
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
            }
        }

        function openSupervisorTask(recordId) {
            currentRecordId = recordId;
            IS_SUPERVISOR_MODE = true;
            switchView('supervisor_form');
            
            const topHeader = document.querySelector('#view-form .bg-blue-600 h1');
            if (topHeader) topHeader.innerText = 'แบบประเมิน - ส่วนของหัวหน้างาน';
            
            const btnSaveBottom = document.getElementById('btnSaveBottom');
            if (btnSaveBottom) btnSaveBottom.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg> อนุมัติและสร้าง PDF`;

            loadExistingData();
        }
"""

# Replace the URL_RECORD_ID const and IS_SUPERVISOR_MODE
index = re.sub(r"const URL_RECORD_ID = '.*?(?:recordId).*?';\n.*?let IS_SUPERVISOR_MODE = .*?;", js_spa_logic, index, flags=re.DOTALL)

# In loadExistingData, update getTaskById(URL_RECORD_ID) to use currentRecordId
index = index.replace("getTaskById(URL_RECORD_ID)", "getTaskById(currentRecordId)")

# In loadExistingData, fix trainee-signed-msg creation so it doesn't duplicate
msg_create_code = """
                        const msg = document.createElement('div');
                        msg.className = 'text-green-600 font-bold p-4 bg-green-50 rounded-lg text-center border border-green-200';
                        msg.innerHTML = '✅ ผู้เข้าอบรมเซ็นชื่อเรียบร้อยแล้ว<br><img src="' + data[28] + '" style="max-height:80px; margin:10px auto;">';
                        document.getElementById('sig1').parentElement.prepend(msg);
"""
new_msg_create_code = """
                        const oldMsg = document.getElementById('trainee-signed-msg');
                        if (oldMsg) oldMsg.remove();
                        const msg = document.createElement('div');
                        msg.id = 'trainee-signed-msg';
                        msg.className = 'text-green-600 font-bold p-4 bg-green-50 rounded-lg text-center border border-green-200';
                        msg.innerHTML = '✅ ผู้เข้าอบรมเซ็นชื่อเรียบร้อยแล้ว<br><img src="' + data[28] + '" style="max-height:80px; margin:10px auto;">';
                        document.getElementById('sig1').parentElement.prepend(msg);
"""
index = index.replace(msg_create_code, new_msg_create_code)

# In submitSupervisorForm, use currentRecordId and change redirect to switchView
index = index.replace("saveSupervisorData(URL_RECORD_ID", "saveSupervisorData(currentRecordId")
index = index.replace("window.location.href = '?page=dashboard';", "switchView('dashboard');")

# Fix trainee submission reload to switchView('trainee') instead of reload? Actually reload is fine, or resetForm(). 
# Let's change window.location.reload() to resetForm() + prepareTraineeMode()
index = index.replace("window.location.reload();", "resetForm(); window.scrollTo(0,0);")

# Update window.onload
old_onload = """        const originalOnLoad = window.onload;
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
        };"""

new_onload = """        window.onload = function () {
            // Existing init code
            document.querySelectorAll('.evaluation-table tbody tr:not(.total-row) > td:first-child').forEach(function (cell) {
                const match = cell.innerHTML.match(/^\\s*(\\d+(?:\\.\\d+)?\\.?)\\s*([\\s\\S]*)$/);
                if (!match) return;
                cell.innerHTML = '<div class="numbered-layout"><span class="order">' + formatOrderLabel(match[1]) +
                    '</span><span class="description">' + match[2].trim() + '</span></div>';
            });
            setupSignaturePad('sig1');
            setupSignaturePad('sig2');
            buildDateDropdowns();
            loadDepartments();
            
            // Set initial view
            prepareTraineeMode();
        };"""

index = index.replace(old_onload, new_onload)
# Also remove the initial window.onload created originally if it exists
index = re.sub(r"window\.onload = function \(\) \{.*?loadDepartments\(\);\s*?\};", "", index, flags=re.DOTALL)
# Add back the unified onload at the end
index = index.replace("</script>\n</body>", new_onload + "\n    </script>\n</body>")

with open(index_path, "w", encoding="utf-8") as f:
    f.write(index)

print("SPA refactoring complete.")
