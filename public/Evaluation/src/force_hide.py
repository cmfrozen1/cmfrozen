import os

DIR = "/home/it-teerapong/Desktop/cmfrozen/public/Evaluation/src"
index_path = os.path.join(DIR, "index.html")

with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

# Add display: none directly to the tag
old_div = '<div id="supervisor-section" class="border-2 border-black">'
new_div = '<div id="supervisor-section" class="border-2 border-black" style="display: none;">'
html = html.replace(old_div, new_div)

# Ensure js uses block
html = html.replace("supSection.style.display = 'block';", "supSection.style.display = '';")

with open(index_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Applied inline style to supervisor-section")
