import re

with open('src/รหัส.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. leaveStatus_ function
old_leaveStatus = """function leaveStatus_(headApproval, mgrApproval, foremanApproval) {
  const head = String(headApproval || '').trim();
  const mgr = String(mgrApproval || '').trim();
  const foreman = String(foremanApproval || '').trim();

  if (head === 'ไม่อนุมัติ' || mgr === 'ไม่อนุมัติ' || foreman === 'ไม่อนุมัติ') return 'ไม่อนุมัติ';
  if (head === 'อนุมัติ' && mgr === 'อนุมัติ') return 'อนุมัติ';

  const waiting = [];
  if (head !== 'อนุมัติ') waiting.push(ROLE_LABEL.head);
  if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);

  return 'รออนุมัติ (' + waiting.join(', ') + ')';
}"""

new_leaveStatus = """function leaveStatus_(headApproval, mgrApproval, foremanApproval, empType, empTo) {
  const head = String(headApproval || '').trim();
  const mgr = String(mgrApproval || '').trim();
  const foreman = String(foremanApproval || '').trim();
  const type = String(empType || '').trim();
  const to = String(empTo || '').trim();

  if (head === 'ไม่อนุมัติ' || mgr === 'ไม่อนุมัติ' || foreman === 'ไม่อนุมัติ') return 'ไม่อนุมัติ';

  const isHeadRequest = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก|manager/i.test(to);
  const isDaily = /รายวัน/.test(type);

  const waiting = [];
  if (isHeadRequest) {
    if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);
  } else if (isDaily) {
    if (foreman !== 'อนุมัติ') waiting.push(ROLE_LABEL.foreman);
    if (head !== 'อนุมัติ') waiting.push(ROLE_LABEL.head);
    if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);
  } else {
    if (head !== 'อนุมัติ') waiting.push(ROLE_LABEL.head);
    if (mgr !== 'อนุมัติ') waiting.push(ROLE_LABEL.mgr);
  }

  if (waiting.length === 0) return 'อนุมัติ';
  return 'รออนุมัติ (' + waiting.join(', ') + ')';
}"""

content = content.replace(old_leaveStatus, new_leaveStatus)

# 2. saveLeave 
old_saveLeave = """      id, now, leaveStatus_(headApproval, mgrApproval, foremanApproval), d.emp, d.fdate, d.to,"""
new_saveLeave = """      id, now, leaveStatus_(headApproval, mgrApproval, foremanApproval, d.emp, d.to), d.emp, d.fdate, d.to,"""
content = content.replace(old_saveLeave, new_saveLeave)

# 3. getLeavesForApproval
old_getLeaves1 = """      const headApproval = String(row[31] || '').trim();
      const mgrApproval = String(row[32] || '').trim();
      const foremanApproval = String(row[34] || '').trim();

      // ผู้ช่วย/รอง/ผู้จัดการ พิจารณาหลังหัวหน้าแผนกเท่านั้น
      if (approverRole === 'mgr' && headApproval !== 'อนุมัติ') continue;"""

new_getLeaves1 = """      const headApproval = String(row[31] || '').trim();
      const mgrApproval = String(row[32] || '').trim();
      const foremanApproval = String(row[34] || '').trim();
      const empType = String(row[3] || '').trim();
      const empTo = String(row[5] || '').trim();
      
      const isHeadRequest = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก|manager/i.test(empTo);
      const isDaily = /รายวัน/.test(empType);

      if (approverRole === 'mgr' && !isHeadRequest && headApproval !== 'อนุมัติ') continue;
      if (approverRole === 'head' && isDaily && foremanApproval !== 'อนุมัติ') continue;
      if (approverRole === 'head' && isHeadRequest) continue;"""
content = content.replace(old_getLeaves1, new_getLeaves1)

old_getLeaves2 = """        status: leaveStatus_(headApproval, mgrApproval, foremanApproval),"""
new_getLeaves2 = """        status: leaveStatus_(headApproval, mgrApproval, foremanApproval, empType, empTo),"""
content = content.replace(old_getLeaves2, new_getLeaves2)

# 4. updateLeaveApproval
old_update = """    const oldHeadApp = String(sheet.getRange(rowIndex, COL.HEAD_RESULT).getDisplayValue() || '').trim();
    const oldMgrApp = String(sheet.getRange(rowIndex, COL.MGR_RESULT).getDisplayValue() || '').trim();
    const oldForemanApp = String(sheet.getRange(rowIndex, COL.FOREMAN_RESULT).getDisplayValue() || '').trim();

    if (role === 'mgr' && oldHeadApp !== 'อนุมัติ') {
      throw new Error(ROLE_LABEL.head + 'ยังไม่อนุมัติ ใบลานี้จึงยังไม่ส่งให้' + ROLE_LABEL.mgr + 'พิจารณา');
    }
    if (role === 'head' && oldForemanApp === 'ไม่อนุมัติ') {
      throw new Error(ROLE_LABEL.foreman + 'ไม่อนุมัติ ใบลานี้จึงไม่ส่งต่อให้' + ROLE_LABEL.head + 'พิจารณา');
    }"""

new_update = """    const oldHeadApp = String(sheet.getRange(rowIndex, COL.HEAD_RESULT).getDisplayValue() || '').trim();
    const oldMgrApp = String(sheet.getRange(rowIndex, COL.MGR_RESULT).getDisplayValue() || '').trim();
    const oldForemanApp = String(sheet.getRange(rowIndex, COL.FOREMAN_RESULT).getDisplayValue() || '').trim();
    const empType = String(sheet.getRange(rowIndex, 4).getDisplayValue() || '').trim();
    const empTo = String(sheet.getRange(rowIndex, 6).getDisplayValue() || '').trim();
    
    const isHeadRequest = /ผู้จัดการ|ผู้ช่วย|รอง|ผจก|manager/i.test(empTo);
    const isDaily = /รายวัน/.test(empType);

    if (role === 'mgr' && !isHeadRequest && oldHeadApp !== 'อนุมัติ') {
      throw new Error(ROLE_LABEL.head + 'ยังไม่อนุมัติ ใบลานี้จึงยังไม่ส่งให้' + ROLE_LABEL.mgr + 'พิจารณา');
    }
    if (role === 'head' && isDaily && oldForemanApp !== 'อนุมัติ') {
      throw new Error(ROLE_LABEL.foreman + 'ยังไม่อนุมัติ ใบลานี้จึงไม่ส่งต่อให้' + ROLE_LABEL.head + 'พิจารณา');
    }
    if (role === 'head' && isHeadRequest) {
      throw new Error('ระดับหัวหน้างาน ต้องให้ ' + ROLE_LABEL.mgr + ' เป็นผู้อนุมัติ');
    }"""
content = content.replace(old_update, new_update)

old_update2 = """    const newStatus = leaveStatus_(newHeadApp, newMgrApp, newForemanApp);"""
new_update2 = """    const newStatus = leaveStatus_(newHeadApp, newMgrApp, newForemanApp, empType, empTo);"""
content = content.replace(old_update2, new_update2)


with open('src/รหัส.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched รหัส.js successfully")
