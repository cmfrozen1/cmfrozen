
import re

def refactor_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all patterns of the form:
    # const <var> = new FormData();
    # <var>.append(...);
    # ...
    # fetchPostAPI(..., <var>);
    
    # This is still hard to do with a single regex.
    # Maybe I can replace them individually by finding the blocks.
    
    # A safer approach: find all "new FormData()" and for each one, 
    # find the block and replace it.
    
    # Since I cannot use complex regex for this in one go, I will use a series of replacements
    # that I can apply with this script.
    
    # Actually, I can just use sed/awk or python to replace the patterns.
    
    # Let's try a simpler approach:
    # 1. Replace "const fd = new FormData();" with "const data = {};"
    # 2. Replace "fd.append" with "data["..."] = ..."
    # 3. Replace "fetchPostAPI(action, fd)" with "fetchPostAPI(action, data)"
    
    content = content.replace('const fd = new FormData();', 'const data = {};')
    content = content.replace('const notifyFd = new FormData();', 'const data = {};')
    
    # Replace append
    content = re.sub(r'(\w+)\.append\(([^,]+),\s*(.+)\);', r'data[\2] = \3;', content)
    
    # Replace fetchPostAPI call
    content = re.sub(r'fetchPostAPI\(([^,]+),\s*(fd|notifyFd)\)', r'fetchPostAPI(\1, data)', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

refactor_file('src/index.html')
