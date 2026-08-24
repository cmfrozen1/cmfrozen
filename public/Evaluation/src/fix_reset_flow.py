import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

# Modify resetForm to support force parameter
old_reset_func = """        function resetForm() {
            const doReset = () => {
                document.querySelectorAll('input[type="text"]').forEach(i => i.value = '');
                document.querySelectorAll('input[type="radio"]').forEach(i => {
                    i.checked = false;
                    i.disabled = false;
                });
                document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
                clearSig('sig1');
                clearSig('sig2');
            };

            if (typeof Swal !== 'undefined') {"""

new_reset_func = """        function resetForm(force = false) {
            const doReset = () => {
                document.querySelectorAll('input[type="text"]').forEach(i => i.value = '');
                document.querySelectorAll('input[type="radio"]').forEach(i => {
                    i.checked = false;
                    i.disabled = false;
                });
                document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
                clearSig('sig1');
                clearSig('sig2');
            };

            if (force === true) {
                doReset();
                return;
            }

            if (typeof Swal !== 'undefined') {"""

html = html.replace(old_reset_func, new_reset_func)

# Make sure submitForm calls resetForm(true)
# Let's search for resetForm() in submitForm success callback
old_submit_success_reset = """                            }).then(() => {
                                resetForm(); window.scrollTo(0,0);
                            });"""
new_submit_success_reset = """                            }).then(() => {
                                resetForm(true); window.scrollTo(0,0);
                            });"""
html = html.replace(old_submit_success_reset, new_submit_success_reset)

# Also check other instances of resetForm() in index.html to see if we need to adjust
# Specifically, in submitSupervisorForm, or other success handlers
# Let's see:
html = html.replace("resetForm(); window.scrollTo(0,0);", "resetForm(true); window.scrollTo(0,0);")

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("resetForm logic updated.")
