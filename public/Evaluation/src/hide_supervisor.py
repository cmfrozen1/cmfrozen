import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

# Add ID to the supervisor section
old_div = "<!-- Section 2: Supervisor Evaluation Box -->\n        <div class=\"border-2 border-black\">"
new_div = "<!-- Section 2: Supervisor Evaluation Box -->\n        <div id=\"supervisor-section\" class=\"border-2 border-black\">"
html = html.replace(old_div, new_div)

# In prepareTraineeMode, hide it
old_trainee = """            // Lock Supervisor Section for Trainee
            document.querySelectorAll('input[name^=\"sup_\"], input[name^=\"follow_\"], input[name=\"sat\"], #sup_comment_1, #sup_comment_2, #sup_name_bracket').forEach(el => {
                el.disabled = true;
            });"""
new_trainee = """            // Hide Supervisor Section completely for Trainee
            const supSection = document.getElementById('supervisor-section');
            if (supSection) supSection.style.display = 'none';
            
            // Lock Supervisor Section for Trainee (backup)
            document.querySelectorAll('input[name^=\"sup_\"], input[name^=\"follow_\"], input[name=\"sat\"], #sup_comment_1, #sup_comment_2, #sup_name_bracket').forEach(el => {
                el.disabled = true;
            });"""
html = html.replace(old_trainee, new_trainee)

# In openSupervisorTask, show it
old_open_sup = """            const topHeader = document.querySelector('#view-form .bg-blue-600 h1');
            if (topHeader) topHeader.innerText = 'แบบประเมิน - ส่วนของหัวหน้างาน';"""
new_open_sup = """            const topHeader = document.querySelector('#view-form .bg-blue-600 h1');
            if (topHeader) topHeader.innerText = 'แบบประเมิน - ส่วนของหัวหน้างาน';
            
            const supSection = document.getElementById('supervisor-section');
            if (supSection) supSection.style.display = 'block';"""
html = html.replace(old_open_sup, new_open_sup)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Supervisor section hidden for trainees.")
