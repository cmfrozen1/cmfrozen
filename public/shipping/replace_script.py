
import re

with open('src/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def replace_form_data(match):
    block = match.group(0)
    # 1. Replace "const fd = new FormData();" with "const data = {};"
    block = block.replace('const fd = new FormData();', 'const data = {};')
    block = block.replace('const notifyFd = new FormData();', 'const data = {};')

    # 2. Replace "fd.append("key", "value");" with "data["key"] = "value";"
    # This regex is a bit tricky, need to handle both fd and notifyFd (or others)
    block = re.sub(r'(\w+)\.append\(([^,]+),\s*(.+)\);', r'data[\2] = \3;', block)
    
    # 3. Replace the fetchPostAPI call
    # This might match the wrong thing, need to be careful.
    # The pattern is fetchPostAPI(action, fd) or fetchPostAPI(action, notifyFd)
    block = re.sub(r'fetchPostAPI\(([^,]+),\s*(\w+)\)', r'fetchPostAPI(\1, data)', block)
    
    return block

# The regex for finding the blocks is complex due to structure.
# Let's find blocks starting with "const fd = new FormData();" 
# and ending at "fetchPostAPI(...);"
# This is hard with simple regex.

# Alternative: manually replace them? No, too many.
# Let's try a regex that matches the block.

pattern = r'const \w+ = new FormData\(\);.*?fetchPostAPI\([^,]+,\s*\w+\);'
# This is a bit too broad as it might span across functions.

# Based on the file, the fd usage is always within a function and the fetchPostAPI is the last call.
# Let's try to match the block more precisely.
# The `re.DOTALL` flag is needed.

# Let's do it in steps.
# Actually, I can just do a search and replace for the common patterns.
print("Manual replacement needed due to complexity")
