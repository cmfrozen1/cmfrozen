// ============================================
// GOOGLE APPS SCRIPT BACKEND + FIREBASE
// ระบบจองห้องประชุม LINE MiniApp + LINE Bot
// เวอร์ชัน: 30.0 (AUTO TRIGGER + ADMIN REMINDER)
// ============================================

// ========== CONFIGURATION ==========
const CONFIG = {
  // LINE Configuration
  LINE: {
    CHANNEL_ACCESS_TOKEN: 'aPAvFs9wjzMKfX6pug8zBVpEoOdtDOaQ1nP060YodHilNRw/Y+/b8v8TqQ7uFGZiqErGn3G+b/2xHiCFK+p3e7IPIX5/l5+eMzYkUtyQvJuXZmoGW990hq22Ei7ljXHjFIwYBfTgJ8QUyxr/ze7aQgdB04t89/1O/w1cDnyilFU=',
    LIFF_ID: '2009198981-GsqxkwIK'
  },
  
  // Firebase Configuration
  FIREBASE: {
    URL: 'https://cm-bookingroom-default-rtdb.firebaseio.com/',
    PROJECT_ID: 'cm-bookingroom'
  },
  
  // Google Drive folder for images
  DRIVE_FOLDER_ID: '1ZEoKjSfG8gYxlxz9dY0OPBz2Ez-TK00D',
  
  // Database structure
  DB: {
    USERS: 'Users',
    USER_LINKS: 'UserLinks',
    ROOMS: 'Rooms',
    BOOKINGS: 'Bookings',
    NOTIFICATIONS: 'Notifications',
    SETTINGS: 'Settings',
    LOGS: 'LOGS',
    USER_TRACKING: 'UserTracking',
    DELETED_USERS: 'DeletedUsers',
    TRIGGERS: 'Triggers'
  }
};

// ========== FIREBASE HELPER FUNCTIONS ==========
function getFirebaseUrl(path) {
  let baseUrl = CONFIG.FIREBASE.URL;
  if (!baseUrl.endsWith('/')) baseUrl += '/';
  const cleanPath = path.replace(/^\//, '');
  return baseUrl + cleanPath + '.json';
}

function firebaseGet(path) {
  try {
    const url = getFirebaseUrl(path);
    console.log('Firebase GET:', url);
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const responseCode = response.getResponseCode();
    console.log('Firebase GET response code:', responseCode);
    
    if (responseCode !== 200) return null;
    
    const content = response.getContentText();
    return content ? JSON.parse(content) : null;
  } catch (e) {
    console.error('Firebase GET error:', e);
    return null;
  }
}

function firebasePut(path, data) {
  try {
    const url = getFirebaseUrl(path);
    console.log('Firebase PUT:', url, data);
    const response = UrlFetchApp.fetch(url, {
      method: 'put',
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const responseCode = response.getResponseCode();
    console.log('Firebase PUT response code:', responseCode);
    
    if (responseCode !== 200) return null;
    
    return JSON.parse(response.getContentText());
  } catch (error) {
    console.error('Firebase PUT error:', error);
    return null;
  }
}

function firebasePatch(path, data) {
  try {
    const url = getFirebaseUrl(path);
    console.log('Firebase PATCH:', url, data);
    const response = UrlFetchApp.fetch(url, {
      method: 'patch',
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const responseCode = response.getResponseCode();
    console.log('Firebase PATCH response code:', responseCode);
    
    if (responseCode !== 200) return null;
    return JSON.parse(response.getContentText());
  } catch (error) {
    console.error('Firebase PATCH error:', error);
    return null;
  }
}

function firebaseDelete(path) {
  try {
    const url = getFirebaseUrl(path);
    console.log('Firebase DELETE:', url);
    const response = UrlFetchApp.fetch(url, {
      method: 'delete',
      muteHttpExceptions: true,
      headers: { 'Content-Type': 'application/json' }
    });
    const responseCode = response.getResponseCode();
    console.log('Firebase DELETE response code:', responseCode);
    return responseCode === 200;
  } catch (error) {
    console.error('Firebase DELETE error:', error);
    return false;
  }
}

function generateId(prefix) {
  const uuid = Utilities.getUuid().replace(/-/g, '');
  return prefix + uuid.substring(0, 8).toUpperCase();
}

function safeFirebaseKey(key) {
  if (!key) return key;
  return key.replace(/[.#$\[\]]/g, '_');
}

// ========== LINE PROFILE API ==========
function getLineUserProfile(userId) {
  if (!userId || !CONFIG.LINE.CHANNEL_ACCESS_TOKEN) {
    console.log('❌ ไม่มี userId หรือ Channel Access Token');
    return null;
  }
  
  try {
    const url = `https://api.line.me/v2/bot/profile/${userId}`;
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.LINE.CHANNEL_ACCESS_TOKEN
      },
      muteHttpExceptions: true
    };
    
    console.log(`📥 กำลังดึงโปรไฟล์ LINE ของผู้ใช้: ${userId}`);
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      const profile = JSON.parse(response.getContentText());
      console.log(`✅ ดึงโปรไฟล์สำเร็จ: ${profile.displayName}`);
      return profile;
    } else {
      console.error(`❌ ไม่สามารถดึงโปรไฟล์ได้ (${responseCode})`);
      return null;
    }
  } catch (e) {
    console.error('❌ Error fetching LINE profile:', e.toString());
    return null;
  }
}

// ========== USER LINKING FUNCTIONS ==========
function linkUserIds(primaryUserId, secondaryUserId, source) {
  if (!primaryUserId || !secondaryUserId || primaryUserId === secondaryUserId) return null;
  
  console.log(`🔗 เชื่อมโยง User ID: ${primaryUserId} <-> ${secondaryUserId} จาก ${source}`);
  
  const now = new Date().toISOString();
  const linkId = generateId('LNK');
  
  const linkKey1 = `${safeFirebaseKey(primaryUserId)}_${safeFirebaseKey(secondaryUserId)}`;
  const linkKey2 = `${safeFirebaseKey(secondaryUserId)}_${safeFirebaseKey(primaryUserId)}`;
  
  const linkData = {
    linkId,
    primaryUserId,
    secondaryUserId,
    source,
    linkedAt: now,
    updatedAt: now,
    active: true
  };
  
  firebasePut(`${CONFIG.DB.USER_LINKS}/${linkKey1}`, linkData);
  firebasePut(`${CONFIG.DB.USER_LINKS}/${linkKey2}`, {...linkData, isReverse: true});
  
  updateUserTracking(primaryUserId, secondaryUserId, source);
  
  return linkData;
}

function getPrimaryUserId(anyUserId) {
  if (!anyUserId) return null;
  
  const cleanUserId = anyUserId.trim();
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  for (let key in users) {
    if (users[key].lineUserId === cleanUserId || 
        (users[key].linkedIds && users[key].linkedIds.includes(cleanUserId))) {
      return users[key].lineUserId;
    }
  }
  
  const links = firebaseGet(CONFIG.DB.USER_LINKS) || {};
  
  for (let key in links) {
    const link = links[key];
    if (link.primaryUserId === cleanUserId) return cleanUserId;
    if (link.secondaryUserId === cleanUserId) return link.primaryUserId;
  }
  
  return cleanUserId;
}

function getLinkedUserIds(userId) {
  if (!userId) return [];
  
  const linkedIds = [userId];
  const links = firebaseGet(CONFIG.DB.USER_LINKS) || {};
  
  for (let key in links) {
    const link = links[key];
    if (link.primaryUserId === userId && link.secondaryUserId) {
      linkedIds.push(link.secondaryUserId);
    }
    if (link.secondaryUserId === userId && link.primaryUserId) {
      linkedIds.push(link.primaryUserId);
    }
  }
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  for (let key in users) {
    if (users[key].lineUserId === userId && users[key].linkedIds) {
      users[key].linkedIds.forEach(id => {
        if (!linkedIds.includes(id)) linkedIds.push(id);
      });
    }
  }
  
  return [...new Set(linkedIds)];
}

function updateUserTracking(primaryUserId, secondaryUserId, source) {
  const safeKey = safeFirebaseKey(primaryUserId);
  const tracking = firebaseGet(`${CONFIG.DB.USER_TRACKING}/${safeKey}`) || {
    userId: primaryUserId,
    linkedIds: [],
    sources: [],
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    visitCount: 0
  };
  
  tracking.lastSeen = new Date().toISOString();
  tracking.visitCount = (tracking.visitCount || 0) + 1;
  
  if (secondaryUserId && !tracking.linkedIds.includes(secondaryUserId)) {
    tracking.linkedIds.push(secondaryUserId);
  }
  
  if (source && !tracking.sources.includes(source)) {
    tracking.sources.push(source);
  }
  
  firebasePut(`${CONFIG.DB.USER_TRACKING}/${safeKey}`, tracking);
}

function getUserFromAnyId(anyUserId) {
  if (!anyUserId) return null;
  
  const primaryId = getPrimaryUserId(anyUserId);
  const safeKey = safeFirebaseKey(primaryId);
  
  return firebaseGet(`${CONFIG.DB.USERS}/${safeKey}`);
}

// ผู้ใช้เปิดรับการแจ้งเตือน LINE หรือไม่ (ค่า default = เปิด ถ้ายังไม่มีการตั้งค่า)
function userWantsNotifications(user) {
  if (!user) return true;
  const v = user.notificationsEnabled;
  return v === undefined || v === true || v === 'true' || v === 1;
}

// ========== USER DELETE FUNCTION ==========
function deleteUser(params) {
  const adminId = params.lineUserId;
  const targetUserId = params.targetUserId;
  
  if (!isAdmin(adminId)) {
    return { success: false, message: 'ไม่มีสิทธิ์ลบผู้ใช้ (ต้องเป็น Admin เท่านั้น)' };
  }
  
  if (!targetUserId) {
    return { success: false, message: 'กรุณาระบุผู้ใช้ที่ต้องการลบ' };
  }
  
  const adminPrimary = getPrimaryUserId(adminId);
  const targetPrimary = getPrimaryUserId(targetUserId);
  
  if (adminPrimary === targetPrimary) {
    return { success: false, message: 'ไม่สามารถลบผู้ใช้ของตัวเองได้' };
  }
  
  console.log(`🗑️ Admin ${adminPrimary} กำลังลบผู้ใช้ ${targetPrimary}`);
  
  const now = new Date().toISOString();
  const results = {
    userDeleted: false,
    bookingsDeleted: 0,
    notificationsDeleted: 0,
    linksDeleted: 0,
    trackingDeleted: false
  };
  
  const user = getUserFromAnyId(targetPrimary);
  if (!user) {
    return { success: false, message: 'ไม่พบผู้ใช้ที่ต้องการลบ' };
  }
  
  const linkedIds = getLinkedUserIds(targetPrimary);
  
  const deletedUserRecord = {
    originalUserId: targetPrimary,
    linkedIds: linkedIds,
    userData: user,
    deletedBy: adminPrimary,
    deletedAt: now,
    reason: params.reason || 'ลบโดย Admin'
  };
  
  const deleteId = generateId('DEL');
  firebasePut(`${CONFIG.DB.DELETED_USERS}/${deleteId}`, deletedUserRecord);
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  Object.keys(bookings).forEach(key => {
    const booking = bookings[key];
    if (linkedIds.includes(booking.userId)) {
      const deletedBookingRecord = {
        ...booking,
        deletedAt: now,
        deletedBy: adminPrimary
      };
      firebasePut(`${CONFIG.DB.DELETED_USERS}/bookings_${key}`, deletedBookingRecord);
      
      if (firebaseDelete(`${CONFIG.DB.BOOKINGS}/${key}`)) {
        results.bookingsDeleted++;
      }
    }
  });
  
  const notifications = firebaseGet(CONFIG.DB.NOTIFICATIONS) || {};
  Object.keys(notifications).forEach(key => {
    if (notifications[key].userId === targetPrimary) {
      if (firebaseDelete(`${CONFIG.DB.NOTIFICATIONS}/${key}`)) {
        results.notificationsDeleted++;
      }
    }
  });
  
  const links = firebaseGet(CONFIG.DB.USER_LINKS) || {};
  Object.keys(links).forEach(key => {
    const link = links[key];
    if (link.primaryUserId === targetPrimary || 
        link.secondaryUserId === targetPrimary ||
        linkedIds.includes(link.primaryUserId) || 
        linkedIds.includes(link.secondaryUserId)) {
      if (firebaseDelete(`${CONFIG.DB.USER_LINKS}/${key}`)) {
        results.linksDeleted++;
      }
    }
  });
  
  const trackingKey = safeFirebaseKey(targetPrimary);
  if (firebaseDelete(`${CONFIG.DB.USER_TRACKING}/${trackingKey}`)) {
    results.trackingDeleted = true;
  }
  
  const userKey = safeFirebaseKey(targetPrimary);
  if (firebaseDelete(`${CONFIG.DB.USERS}/${userKey}`)) {
    results.userDeleted = true;
  }
  
  linkedIds.forEach(id => {
    if (id !== targetPrimary) {
      const secondaryKey = safeFirebaseKey(id);
      firebaseDelete(`${CONFIG.DB.USERS}/${secondaryKey}`);
    }
  });
  
  console.log(`✅ ลบผู้ใช้ ${targetPrimary} สำเร็จ`, results);
  
  return {
    success: true,
    data: results,
    message: `ลบผู้ใช้สำเร็จ (ลบการจอง ${results.bookingsDeleted} รายการ)`
  };
}

// ========== CREATE OR UPDATE USER WITH PROFILE ==========
function createOrUpdateUserFromLine(userId, source = 'bot') {
  if (!userId) return null;
  
  console.log(`👤 กำลังสร้าง/อัปเดตผู้ใช้จาก LINE: ${userId}`);
  
  const profile = getLineUserProfile(userId);
  const now = new Date().toISOString();
  
  const existingUser = getUserFromAnyId(userId);
  
  if (existingUser) {
    console.log(`✅ พบผู้ใช้เดิม: ${existingUser.displayName || userId}`);
    
    const updates = {
      lastLogin: now,
      updatedAt: now,
      lastInteraction: now
    };
    
    if (profile) {
      if (profile.displayName) updates.displayName = profile.displayName;
      if (profile.pictureUrl) updates.pictureUrl = profile.pictureUrl;
      if (profile.statusMessage) updates.statusMessage = profile.statusMessage;
    }
    
    if (existingUser.status === 'inactive') {
      updates.status = 'active';
      updates.unfollowedAt = null;
    }
    
    const safeKey = safeFirebaseKey(getPrimaryUserId(userId));
    firebasePatch(`${CONFIG.DB.USERS}/${safeKey}`, updates);
    
    return { ...existingUser, ...updates };
  }
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  const isFirstUser = Object.keys(users).length === 0;
  
  const newUser = {
    userId: generateId('USR'),
    lineUserId: userId,
    linkedIds: [],
    displayName: profile ? profile.displayName : '',
    pictureUrl: profile ? profile.pictureUrl : '',
    statusMessage: profile ? profile.statusMessage : '',
    email: '',
    phone: '',
    department: '',
    role: isFirstUser ? 'admin' : 'user',
    status: 'active',
    notificationsEnabled: true,
    lastLogin: now,
    createdAt: now,
    updatedAt: now,
    lastInteraction: now,
    welcomeSent: false,
    source: source,
    unfollowedAt: null
  };
  
  console.log(`✨ สร้างผู้ใช้ใหม่: ${newUser.displayName || userId} (${isFirstUser ? 'Admin' : 'User'})`);
  
  firebasePut(`${CONFIG.DB.USERS}/${safeFirebaseKey(userId)}`, newUser);
  
  return newUser;
}

// ========== FLEX MESSAGE CREATORS ==========
function createFlexDetailRow(label, value, valueColor) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, flex: 3, color: "#8A94A6", size: "sm", wrap: true },
      { type: "text", text: value || "-", flex: 5, color: valueColor || "#243B53", size: "sm", wrap: true, offsetStart: "md" }
    ]
  };
}

function createBookingFlexMessage(booking, type = 'new', showApproveButtons = true) {
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  
  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  
  let dateStr = startTime.toLocaleDateString('th-TH', dateOptions);
  let timeStr = `${startTime.toLocaleTimeString('th-TH', timeOptions)} - ${endTime.toLocaleTimeString('th-TH', timeOptions)} น.`;
  
  if (booking.isMultiDay && booking.multiDayDates && booking.multiDayDates.length > 0) {
    const endDates = new Date(booking.multiDayDates[booking.multiDayDates.length - 1]);
    dateStr = `${startTime.toLocaleDateString('th-TH', dateOptions)} - ${endDates.toLocaleDateString('th-TH', dateOptions)}`;
  }
  
  const detailUrl = `https://liff.line.me/${CONFIG.LINE.LIFF_ID}?bookingId=${booking.bookingId}&view=detail`;
  
  let headerColor = '#06c755';
  let headerText = 'รายละเอียดการจอง';
  let statusColor = '#f59e0b';
  let statusText = 'รอการอนุมัติ';
  let actionButtons = [];
  
  if (type === 'new') {
    headerColor = '#06c755';
    headerText = 'คำขอจองใหม่';
    statusColor = '#f59e0b';
    statusText = 'รอการอนุมัติ';
    if (showApproveButtons) {
      // Admin: มีปุ่มอนุมัติและยกเลิก
      actionButtons = [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: { type: 'postback', label: 'อนุมัติ', data: `action=approve&bookingId=${booking.bookingId}`, displayText: 'อนุมัติการจอง' },
              style: 'primary',
              color: '#06C755',
              height: 'sm',
              flex: 1
            },
            {
              type: 'button',
              action: { type: 'postback', label: 'ยกเลิก', data: `action=cancel&bookingId=${booking.bookingId}`, displayText: 'ยกเลิกการจอง' },
              style: 'primary',
              color: '#E53935',
              height: 'sm',
              flex: 1
            }
          ]
        },
        {
          type: 'button',
          action: { type: 'uri', label: 'ดูรายละเอียด', uri: detailUrl },
          style: 'link',
          color: '#2F6B8A',
          height: 'sm',
          margin: 'sm'
        }
      ];
    } else {
      // Operator: receives the notification without approval controls
      actionButtons = [
        {
          type: 'button',
          action: { type: 'uri', label: 'ดูรายละเอียด', uri: detailUrl },
          style: 'primary',
          color: '#3b82f6'
        }
      ];
    }
  } else if (type === 'approved') {
    headerColor = '#06c755';
    headerText = 'ยืนยันการจองแล้ว';
    statusColor = '#06c755';
    statusText = 'อนุมัติแล้ว';
    actionButtons = [
      {
        type: 'button',
        action: { type: 'uri', label: 'ดูรายละเอียด', uri: detailUrl },
        style: 'primary',
        color: '#06c755'
      }
    ];
  } else if (type === 'rejected') {
    headerColor = '#ef4444';
    headerText = 'ไม่อนุมัติการจอง';
    statusColor = '#ef4444';
    statusText = 'ไม่อนุมัติ';
    actionButtons = [
      {
        type: 'button',
        action: { type: 'uri', label: 'จองใหม่', uri: `https://liff.line.me/${CONFIG.LINE.LIFF_ID}?view=booking` },
        style: 'primary',
        color: '#06c755'
      },
      {
        type: 'button',
        action: { type: 'message', label: 'เมนูหลัก', text: 'เมนู' },
        style: 'secondary',
        color: '#888888'
      }
    ];
  } else if (type === 'reminder') {
    headerColor = '#3b82f6';
    headerText = 'แจ้งเตือนก่อนการประชุม';
    statusColor = '#3b82f6';
    statusText = 'กำลังจะเริ่ม';
    actionButtons = [
      {
        type: 'button',
        action: {
          type: 'uri',
          label: 'ดูรายละเอียดการจอง',
          uri: `https://liff.line.me/${CONFIG.LINE.LIFF_ID}?bookingId=${booking.bookingId}&view=detail`
        },
        style: 'primary',
        color: '#3b82f6'
      }
    ];
    if (booking.meetingLink) {
      actionButtons.push({
        type: 'button',
        action: {
          type: 'uri',
          label: 'เข้าร่วมประชุม',
          uri: booking.meetingLink
        },
        style: 'secondary',
        color: '#06c755'
      });
    }

  } else if (type === 'user_deleted') {
    headerColor = '#ef4444';
    headerText = 'ผู้ใช้ถูกลบจากระบบ';
    statusColor = '#ef4444';
    statusText = 'ถูกลบจากระบบ';
    actionButtons = [
      {
        type: 'button',
        action: { type: 'uri', label: 'ดูรายละเอียด', uri: `https://liff.line.me/${CONFIG.LINE.LIFF_ID}` },
        style: 'primary',
        color: '#06c755'
      }
    ];
  } else if (type === 'auto_cancelled') {
    headerColor = '#f59e0b';
    headerText = 'ระบบยกเลิกการจองอัตโนมัติ';
    statusColor = '#f59e0b';
    statusText = 'ระบบยกเลิกอัตโนมัติ';
    actionButtons = [
      {
        type: 'button',
        action: { type: 'uri', label: 'จองใหม่', uri: `https://liff.line.me/${CONFIG.LINE.LIFF_ID}?view=booking` },
        style: 'primary',
        color: '#06c755'
      },
      {
        type: 'button',
        action: { type: 'message', label: 'เมนูหลัก', text: 'เมนู' },
        style: 'secondary',
        color: '#888888'
      }
    ];
  } else if (type === 'admin_cancelled') {
    headerColor = '#ef4444';
    headerText = 'ผู้ดูแลยกเลิกการจอง';
    statusColor = '#ef4444';
    statusText = 'ยกเลิกโดยผู้ดูแล';
    actionButtons = [
      {
        type: 'button',
        action: { type: 'uri', label: 'จองใหม่', uri: `https://liff.line.me/${CONFIG.LINE.LIFF_ID}?view=booking` },
        style: 'primary',
        color: '#06c755'
      },
      {
        type: 'button',
        action: { type: 'message', label: 'เมนูหลัก', text: 'เมนู' },
        style: 'secondary',
        color: '#888888'
      }
    ];
  }
  
  const notificationNote = {
    new: "รายการนี้กำลังรอการพิจารณา",
    approved: "การจองได้รับการยืนยันเรียบร้อย",
    rejected: "กรุณาเลือกช่วงเวลาหรือห้องประชุมใหม่",
    reminder: booking.reminderPoint ? `เริ่มประชุมใน ${formatReminderLabel(booking.reminderPoint)}` : "ใกล้ถึงเวลาประชุม",
    auto_cancelled: "ระบบยกเลิกรายการตามเงื่อนไขที่กำหนด",
    admin_cancelled: "รายการนี้ถูกยกเลิกโดยผู้ดูแลระบบ",
    user_deleted: "ข้อมูลผู้ใช้ถูกนำออกจากระบบ"
  }[type] || "รายละเอียดการจองห้องประชุม";

  return {
    type: "flex",
    altText: headerText,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "horizontal",
        backgroundColor: headerColor,
        paddingTop: "md",
        paddingBottom: "md",
        paddingStart: "lg",
        paddingEnd: "lg",
        contents: [
          { type: "text", text: "ระบบจองห้องประชุม", color: "#FFFFFF", size: "xs", weight: "bold", flex: 7, gravity: "center" },
          { type: "text", text: "การแจ้งเตือน", color: "#FFFFFF", size: "xs", align: "end", flex: 5, gravity: "center" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingTop: "xl",
        paddingBottom: "xl",
        paddingStart: "xxl",
        paddingEnd: "xxl",
        contents: [
          { type: "text", text: headerText, weight: "bold", size: "lg", align: "center", color: "#172B4D", wrap: true },
          { type: "text", text: booking.title || "การจองห้องประชุม", size: "sm", align: "center", color: "#52616B", wrap: true, margin: "sm" },
          { type: "separator", margin: "lg", color: "#E8EDF2" },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            margin: "lg",
            contents: [
              createFlexDetailRow("ห้องประชุม", booking.roomName),
              createFlexDetailRow("วันที่", dateStr),
              createFlexDetailRow("เวลา", timeStr),
              createFlexDetailRow("ผู้จอง", booking.userName),
              createFlexDetailRow("สถานะ", statusText, statusColor)
            ]
          },
          { type: "separator", margin: "lg", color: "#E8EDF2" },
          { type: "text", text: notificationNote, size: "sm", color: "#52616B", wrap: true, margin: "lg", lineSpacing: "4px" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingTop: "lg",
        paddingBottom: "lg",
        paddingStart: "xxl",
        paddingEnd: "xxl",
        contents: actionButtons
      },
      styles: {
        body: { backgroundColor: "#FFFFFF" },
        footer: { backgroundColor: "#F6F8FA", separator: true, separatorColor: "#E8EDF2" }
      }
    }
  };
}

function formatReminderLabel(minutes) {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return days === 1 ? '1 วันก่อนประชุม' : `${days} วันก่อนประชุม`;
  } else if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} ชั่วโมงก่อนประชุม`;
  } else {
    return `${minutes} นาทีก่อนประชุม`;
  }
}

function createMainMenuFlex(userName) {
  return {
    type: 'flex',
    altText: '📋 เมนูหลัก',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📋 เมนูหลัก', weight: 'bold', size: 'xl', color: '#06c755' },
          { type: 'text', text: userName ? `สวัสดีคุณ ${userName}` : 'ระบบจองห้องประชุม', size: 'sm', color: '#888888', margin: 'md' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'เลือกคำสั่งด้านล่าง', size: 'md', color: '#666666', weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box', layout: 'horizontal', margin: 'lg',
            action: { type: 'message', label: 'การจองของฉัน', text: 'การจอง' },
            contents: [
              { type: 'text', text: '📅', size: 'xl', flex: 1 },
              { type: 'text', text: 'การจองของฉัน', size: 'md', color: '#06c755', weight: 'bold', flex: 4, wrap: true },
              { type: 'text', text: 'พิมพ์ "การจอง"', size: 'xs', color: '#888888', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            action: { type: 'message', label: 'ห้องว่างวันนี้', text: 'ห้องว่าง' },
            contents: [
              { type: 'text', text: '🏢', size: 'xl', flex: 1 },
              { type: 'text', text: 'ห้องว่างวันนี้', size: 'md', color: '#06c755', weight: 'bold', flex: 4, wrap: true },
              { type: 'text', text: 'พิมพ์ "ห้องว่าง"', size: 'xs', color: '#888888', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            action: { type: 'message', label: 'สรุปการใช้ห้องวันนี้', text: 'สรุป' },
            contents: [
              { type: 'text', text: '📊', size: 'xl', flex: 1 },
              { type: 'text', text: 'สรุปการใช้ห้องวันนี้', size: 'md', color: '#06c755', weight: 'bold', flex: 4, wrap: true },
              { type: 'text', text: 'พิมพ์ "สรุป"', size: 'xs', color: '#888888', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            action: { type: 'message', label: 'รายการรออนุมัติ', text: 'รออนุมัติ' },
            contents: [
              { type: 'text', text: '⏳', size: 'xl', flex: 1 },
              { type: 'text', text: 'รายการรออนุมัติ', size: 'md', color: '#06c755', weight: 'bold', flex: 4, wrap: true },
              { type: 'text', text: 'พิมพ์ "รออนุมัติ"', size: 'xs', color: '#888888', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            action: { type: 'message', label: 'แสดงเมนู', text: 'เมนู' },
            contents: [
              { type: 'text', text: '📋', size: 'xl', flex: 1 },
              { type: 'text', text: 'แสดงเมนู', size: 'md', color: '#06c755', weight: 'bold', flex: 4, wrap: true },
              { type: 'text', text: 'พิมพ์ "เมนู"', size: 'xs', color: '#888888', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            action: { type: 'message', label: 'ช่วยเหลือ', text: 'help' },
            contents: [
              { type: 'text', text: '❓', size: 'xl', flex: 1 },
              { type: 'text', text: 'ช่วยเหลือ', size: 'md', color: '#06c755', weight: 'bold', flex: 4, wrap: true },
              { type: 'text', text: 'พิมพ์ "help"', size: 'xs', color: '#888888', flex: 3, align: 'end' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: '📅 เปิดแอปจองห้อง', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` },
            style: 'primary',
            color: '#06c755'
          },
          {
            type: 'button',
            action: { type: 'message', label: '⏳ รายการรออนุมัติ', text: 'รออนุมัติ' },
            style: 'primary',
            color: '#FF8C00'
          }
        ],
        paddingAll: 'lg'
      }
    }
  };
}

function createWelcomeFlex(user) {
  return {
    type: 'flex',
    altText: '🎉 ยินดีต้อนรับ',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🎉 ยินดีต้อนรับ', weight: 'bold', size: 'xl', color: '#06c755' },
          { 
            type: 'text', 
            text: user.displayName ? `คุณ ${user.displayName}` : 'สู่ระบบจองห้องประชุม', 
            size: 'md', 
            color: '#888888', 
            margin: 'md' 
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'พิมพ์คำสั่งด้านล่างเพื่อใช้งาน', size: 'md', color: '#666666', wrap: true },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box', layout: 'horizontal', margin: 'lg',
            contents: [
              { type: 'text', text: '📅', size: 'xl', flex: 1 },
              { type: 'text', text: 'ดูการจองของฉัน', size: 'sm', color: '#666666', flex: 4, wrap: true },
              { type: 'text', text: '"การจอง"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: '🏢', size: 'xl', flex: 1 },
              { type: 'text', text: 'ดูห้องว่างวันนี้', size: 'sm', color: '#666666', flex: 4, wrap: true },
              { type: 'text', text: '"ห้องว่าง"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: '📊', size: 'xl', flex: 1 },
              { type: 'text', text: 'สรุปการใช้ห้องวันนี้', size: 'sm', color: '#666666', flex: 4, wrap: true },
              { type: 'text', text: '"สรุป"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: '📋', size: 'xl', flex: 1 },
              { type: 'text', text: 'แสดงเมนู', size: 'sm', color: '#666666', flex: 4, wrap: true },
              { type: 'text', text: '"เมนู"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: '📅 เริ่มจองห้องประชุม', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` },
            style: 'primary',
            color: '#06c755'
          }
        ],
        paddingAll: 'lg'
      }
    }
  };
}

function createDailySummaryFlex(date = null, requestUserId = null) {
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  
  const targetDate = date ? new Date(date) : new Date();
  const targetDateStr = Utilities.formatDate(targetDate, "Asia/Bangkok", "yyyy-MM-dd");
  const now = new Date();

  const allDayBookings = [];
  const roomUsage = {};
  const totalRooms = Object.keys(rooms).length;

  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    if (b.startTime) {
      const bStart = new Date(b.startTime);
      const bDateStr = Utilities.formatDate(bStart, "Asia/Bangkok", "yyyy-MM-dd");
      if (bDateStr === targetDateStr) {
        if (b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed') {
          allDayBookings.push(b);
          roomUsage[b.roomId] = (roomUsage[b.roomId] || 0) + 1;
        }
      }
    }
    if (b.isMultiDay && b.multiDayDates && b.multiDayDates.includes(targetDateStr)) {
      if (b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed') {
        if (!allDayBookings.find(existing => existing.bookingId === b.bookingId)) {
          allDayBookings.push(b);
          roomUsage[b.roomId] = (roomUsage[b.roomId] || 0) + 1;
        }
      }
    }
  });

  const pendingBookings = allDayBookings.filter(b => b.status === 'pending');
  const confirmedBookings = allDayBookings.filter(b => b.status === 'confirmed');
  const completedBookings = allDayBookings.filter(b => b.status === 'completed' || 
    (b.status === 'confirmed' && new Date(b.endTime) < now));
  
  const usedRooms = Object.keys(roomUsage).length;

  allDayBookings.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const showAdminButtons = requestUserId && (isAdmin(requestUserId) || isManager(requestUserId));

  const bookingItems = allDayBookings.slice(0, 15).map(b => {
    const startTime = new Date(b.startTime);
    const endTime = new Date(b.endTime);
    const timeStr = startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + 
                   ' - ' + 
                   endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    
    let statusIcon = '⏳';
    let statusColor = '#f59e0b';
    let statusText = 'รออนุมัติ';
    
    if (endTime < now && b.status === 'confirmed') {
      statusIcon = '✅';
      statusColor = '#888888';
      statusText = 'ผ่านไปแล้ว';
    } else if (b.status === 'confirmed') {
      statusIcon = '✅';
      statusColor = '#06c755';
      statusText = 'อนุมัติแล้ว';
    } else if (b.status === 'pending') {
      statusIcon = '⏳';
      statusColor = '#f59e0b';
      statusText = 'รออนุมัติ';
    } else if (b.status === 'completed') {
      statusIcon = '✅';
      statusColor = '#888888';
      statusText = 'เสร็จสิ้น';
    } else if (b.status === 'auto_cancelled') {
      statusIcon = '🤖';
      statusColor = '#f59e0b';
      statusText = 'ระบบยกเลิก';
    } else if (b.status === 'cancelled' && b.cancelledBy === 'admin') {
      statusIcon = '🔴';
      statusColor = '#ef4444';
      statusText = 'แอดมินยกเลิก';
    }

    const itemContents = [
      {
        type: 'box', layout: 'horizontal',
        contents: [
          { type: 'text', text: `${statusIcon} ${timeStr}`, size: 'sm', weight: 'bold', color: '#333333', flex: 5 },
          { type: 'text', text: statusText, size: 'xs', color: statusColor, align: 'end', flex: 3, weight: 'bold' }
        ]
      },
      {
        type: 'box', layout: 'horizontal', margin: 'xs',
        contents: [
          { type: 'text', text: b.roomName || '', size: 'sm', color: '#06c755', weight: 'bold', flex: 1 }
        ]
      },
      {
        type: 'box', layout: 'horizontal', margin: 'xs',
        contents: [
          { type: 'text', text: `👤 ผู้จอง: ${b.userName || '-'} (${b.title || '-'})`, size: 'xs', color: '#666666', wrap: true, flex: 1 }
        ]
      }
    ];

    if (b.status === 'pending' && showAdminButtons) {
      itemContents.push({
        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'md',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: 'อนุมัติ', data: `action=approve&bookingId=${b.bookingId}`, displayText: 'อนุมัติการจอง' },
            style: 'primary',
            color: '#06c755',
            height: 'sm',
            flex: 1
          },
          {
            type: 'button',
            action: { type: 'postback', label: 'ยกเลิก', data: `action=cancel&bookingId=${b.bookingId}`, displayText: 'ยกเลิกการจอง' },
            style: 'primary',
            color: '#ef4444',
            height: 'sm',
            flex: 1
          }
        ]
      });
    }

    itemContents.push({ type: 'separator', margin: 'md' });

    return {
      type: 'box', layout: 'vertical',
      contents: itemContents,
      margin: 'md'
    };
  });

  if (allDayBookings.length > 15) {
    bookingItems.push({
      type: 'text',
      text: `และอีก ${allDayBookings.length - 15} รายการ...`,
      size: 'xs', color: '#888888', align: 'end', margin: 'md'
    });
  }

  const totalBookings = allDayBookings.length;
  const completedCount = completedBookings.length;
  
  const thaiDateStr = targetDate.toLocaleDateString('th-TH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return {
    type: 'flex',
    altText: `📊 สรุปการใช้ห้องวันที่ ${thaiDateStr}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: '📊 สรุปการใช้ห้องรายวัน', weight: 'bold', size: 'xl', color: '#06c755' },
          {
            type: 'text',
            text: thaiDateStr,
            size: 'sm', color: '#888888', margin: 'md'
          }
        ]
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          {
            type: 'box', layout: 'vertical',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '🏢 ห้องทั้งหมด:', size: 'sm', color: '#666666', flex: 3 },
                { type: 'text', text: `${totalRooms} ห้อง`, size: 'sm', color: '#06c755', weight: 'bold', flex: 2, align: 'end' }
              ]},
              { type: 'box', layout: 'horizontal', margin: 'md', contents: [
                { type: 'text', text: '📊 การจองทั้งหมด:', size: 'sm', color: '#666666', flex: 3 },
                { type: 'text', text: `${totalBookings} รายการ`, size: 'sm', color: '#06c755', weight: 'bold', flex: 2, align: 'end' }
              ]},
              { type: 'box', layout: 'horizontal', margin: 'md', contents: [
                { type: 'text', text: '✅ อนุมัติแล้ว:', size: 'sm', color: '#666666', flex: 3 },
                { type: 'text', text: `${confirmedBookings.length} รายการ`, size: 'sm', color: '#06c755', flex: 2, align: 'end' }
              ]},
              { type: 'box', layout: 'horizontal', margin: 'md', contents: [
                { type: 'text', text: '⏳ รออนุมัติ:', size: 'sm', color: '#666666', flex: 3 },
                { type: 'text', text: `${pendingBookings.length} รายการ`, size: 'sm', color: '#f59e0b', flex: 2, align: 'end' }
              ]},
              { type: 'box', layout: 'horizontal', margin: 'md', contents: [
                { type: 'text', text: '✅ ผ่านไปแล้ว:', size: 'sm', color: '#666666', flex: 3 },
                { type: 'text', text: `${completedCount} รายการ`, size: 'sm', color: '#888888', flex: 2, align: 'end' }
              ]},
              { type: 'separator', margin: 'lg' },
              { type: 'text', text: '📋 รายการจองทั้งหมด', size: 'md', color: '#666666', weight: 'bold', margin: 'lg' }
            ]
          }
        ].concat(bookingItems.length > 0 ? bookingItems : [
          { type: 'text', text: 'ไม่มีการจองในวันนี้', size: 'sm', color: '#888888', align: 'center', margin: 'md' }
        ])
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'uri', label: '📅 จองห้องประชุม', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' },
          { type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888', margin: 'md' }
        ],
        paddingAll: 'lg'
      }
    }
  };
}

function createHelpFlex() {
  return {
    type: 'flex',
    altText: '❓ วิธีใช้',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: '❓ วิธีใช้ระบบ', weight: 'bold', size: 'xl', color: '#06c755' }]
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: '📋 คำสั่งพื้นฐาน', weight: 'bold', size: 'md', color: '#666666' },
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'horizontal', margin: 'lg', contents: [{ type: 'text', text: '📅', size: 'xl', flex: 1 }, { type: 'text', text: 'ดูการจองของฉัน', size: 'sm', color: '#666666', flex: 4, wrap: true }, { type: 'text', text: '"การจอง"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }] },
          { type: 'box', layout: 'horizontal', margin: 'md', contents: [{ type: 'text', text: '🏢', size: 'xl', flex: 1 }, { type: 'text', text: 'ดูห้องว่างวันนี้', size: 'sm', color: '#666666', flex: 4, wrap: true }, { type: 'text', text: '"ห้องว่าง"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }] },
          { type: 'box', layout: 'horizontal', margin: 'md', contents: [{ type: 'text', text: '📊', size: 'xl', flex: 1 }, { type: 'text', text: 'สรุปการใช้ห้องวันนี้', size: 'sm', color: '#666666', flex: 4, wrap: true }, { type: 'text', text: '"สรุป"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }] },
          { type: 'box', layout: 'horizontal', margin: 'md', contents: [{ type: 'text', text: '📋', size: 'xl', flex: 1 }, { type: 'text', text: 'แสดงเมนู', size: 'sm', color: '#666666', flex: 4, wrap: true }, { type: 'text', text: '"เมนู"', size: 'xs', color: '#06c755', flex: 3, align: 'end' }] }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', action: { type: 'uri', label: '📅 เปิดแอปจองห้อง', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' }],
        paddingAll: 'lg'
      }
    }
  };
}

// ========== FLEX MESSAGE DESIGN SYSTEM ==========
// Apply the same visual rules immediately before every push/reply. This keeps
// legacy messages visually consistent without duplicating layout code.
function sanitizeFlexContent(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeFlexContent).filter(item => !(
      item && item.type === 'text' && !String(item.text || '').trim()
    ));
  }

  if (!value || typeof value !== 'object') return value;

  Object.keys(value).forEach(key => {
    const item = value[key];
    if (typeof item === 'string' && ['text', 'altText', 'label', 'displayText'].includes(key)) {
      value[key] = item
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
        .replace(/  +/g, ' ')
        .trim();
    } else if (item && typeof item === 'object') {
      value[key] = sanitizeFlexContent(item);
    }
  });

  return value;
}

function applyFlexBranding(message) {
  if (!message || message.type !== 'flex' || !message.contents) return message;
  message = sanitizeFlexContent(message);

  const bubbles = message.contents.type === 'carousel'
    ? (message.contents.contents || [])
    : [message.contents];

  bubbles.forEach(bubble => {
    if (!bubble || bubble.type !== 'bubble') return;

    bubble.styles = bubble.styles || {};
    bubble.styles.body = Object.assign({ backgroundColor: '#FFFFFF' }, bubble.styles.body || {});
    bubble.styles.footer = Object.assign({
      backgroundColor: '#F6F8FA',
      separator: true,
      separatorColor: '#E8EDF2'
    }, bubble.styles.footer || {});

    if (bubble.header) {
      bubble.header.paddingAll = bubble.header.paddingAll || 'lg';
      bubble.header.backgroundColor = bubble.header.backgroundColor || '#06C755';
      const headerTexts = (bubble.header.contents || []).filter(item => item.type === 'text');
      headerTexts.forEach((item, index) => {
        item.color = index === 0 ? '#FFFFFF' : '#D9E7EA';
        item.weight = item.weight || (index === 0 ? 'bold' : 'regular');
      });
    }

    if (bubble.body) {
      bubble.body.paddingAll = bubble.body.paddingAll || 'lg';
      bubble.body.spacing = bubble.body.spacing || 'sm';
    }

    if (bubble.footer) {
      bubble.footer.paddingAll = bubble.footer.paddingAll || 'lg';
      bubble.footer.spacing = bubble.footer.spacing || 'sm';
      (bubble.footer.contents || []).forEach(item => {
        if (item.type === 'button') {
          item.height = item.height || 'sm';
          if (item.style === 'primary' && !item.color) item.color = '#0F766E';
        }
      });
    }
  });

  return message;
}

// ========== SEND FLEX MESSAGE ==========
function sendFlexMessage(userId, flexMessage) {
  if (!CONFIG.LINE.CHANNEL_ACCESS_TOKEN) {
    console.error('❌ ไม่พบ LINE Channel Access Token');
    return { success: false, error: 'NO_TOKEN' };
  }
  
  if (!userId) {
    console.error('❌ ไม่พบ userId');
    return { success: false, error: 'NO_USER_ID' };
  }

  console.log(`📤 กำลังส่งข้อความไปยัง ${userId}`);

  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: userId,
    messages: [applyFlexBranding(flexMessage)]
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE.CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    console.log(`📥 LINE API ตอบกลับ: ${responseCode}`);
    
    if (responseCode === 200) {
      console.log(`✅ ส่งข้อความไปยัง ${userId} สำเร็จ`);
      return { success: true };
    } else {
      console.error(`❌ LINE API error ${responseCode}: ${responseText}`);
      const isQuotaError = responseCode === 429 || (responseCode === 400 && responseText.includes('monthly limit'));
      return { success: false, error: 'API_ERROR', code: responseCode, isQuotaError: isQuotaError };
    }
  } catch (e) {
    console.error('❌ ส่งข้อความ error:', e.toString());
    return { success: false, error: 'EXCEPTION', message: e.toString() };
  }
}

// ========== REPLY MESSAGE (Save Quota) ==========
function replyMessage(replyToken, messages) {
  if (!CONFIG.LINE.CHANNEL_ACCESS_TOKEN) {
    console.error('❌ ไม่พบ LINE Channel Access Token');
    return { success: false, error: 'NO_TOKEN' };
  }
  
  if (!replyToken) {
    console.error('❌ ไม่พบ replyToken');
    return { success: false, error: 'NO_REPLY_TOKEN' };
  }

  if (!Array.isArray(messages)) messages = [messages];

  console.log(`📤 กำลังตอบกลับข้อความ (Reply)`);

  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: messages.map(applyFlexBranding)
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE.CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      console.log(`✅ ตอบกลับสำเร็จ`);
      return { success: true };
    } else {
      console.error(`❌ LINE Reply API error ${responseCode}: ${responseText}`);
      return { success: false, error: 'API_ERROR', code: responseCode };
    }
  } catch (e) {
    console.error('❌ ตอบกลับข้อความ error:', e.toString());
    return { success: false, error: 'EXCEPTION', message: e.toString() };
  }
}

function showLoadingAnimation(userId, seconds) {
  seconds = seconds || 5;
  if (!CONFIG.LINE.CHANNEL_ACCESS_TOKEN || !userId) return false;
  
  const loadingSeconds = Math.min(seconds, 5);
  const url = 'https://api.line.me/v2/bot/chat/loading/start';
  const payload = { chatId: userId, loadingSeconds: loadingSeconds };
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE.CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 202;
  } catch (e) {
    console.error('Loading animation error:', e.toString());
    return false;
  }
}

// ========== TRIGGER MANAGEMENT ==========
function setupSystemTriggers() {
  console.log('⚙️ กำลังตั้งค่า System Triggers...');
  
  // ลบ triggers เดิมทั้งหมด
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendMeetingReminders' ||
        trigger.getHandlerFunction() === 'autoCancelOverdueBookings' ||
        trigger.getHandlerFunction() === 'checkAndRunEndOfMonthSummary' ||
        trigger.getHandlerFunction() === 'cleanupInactiveUsers') {
      ScriptApp.deleteTrigger(trigger);
      console.log(`🗑️ ลบ Trigger: ${trigger.getHandlerFunction()}`);
    }
  });
  
  // 1. สร้าง Trigger สำหรับ Reminder (ทุก 10 นาที)
  ScriptApp.newTrigger('sendMeetingReminders')
    .timeBased()
    .everyMinutes(10)
    .create();
  console.log('✅ สร้าง Trigger: sendMeetingReminders (ทุก 10 นาที)');
  
  // 2. สร้าง Trigger สำหรับ Auto Cancel (ทุก 30 นาที)
  ScriptApp.newTrigger('autoCancelOverdueBookings')
    .timeBased()
    .everyMinutes(30)
    .create();
  console.log('✅ สร้าง Trigger: autoCancelOverdueBookings (ทุก 30 นาที)');
  
  // 3. สร้าง Trigger สำหรับ End of Month Summary (ทุกวันตอน 20:00)
  ScriptApp.newTrigger('checkAndRunEndOfMonthSummary')
    .timeBased()
    .atHour(20)
    .everyDays(1)
    .create();
  console.log('✅ สร้าง Trigger: checkAndRunEndOfMonthSummary (ทุกวัน 20:00)');
  
  // 4. สร้าง Trigger สำหรับ Cleanup Inactive Users (ทุกวันตอน 03:00)
  ScriptApp.newTrigger('cleanupInactiveUsers')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
  console.log('✅ สร้าง Trigger: cleanupInactiveUsers (ทุกวัน 03:00)');
  
  // บันทึกสถานะลง Firebase
  const triggerStatus = {
    setupAt: new Date().toISOString(),
    triggers: [
      { name: 'sendMeetingReminders', schedule: 'every 10 minutes' },
      { name: 'autoCancelOverdueBookings', schedule: 'every 30 minutes' },
      { name: 'checkAndRunEndOfMonthSummary', schedule: 'every day at 20:00' },
      { name: 'cleanupInactiveUsers', schedule: 'every day at 03:00' }
    ]
  };
  firebasePut(`${CONFIG.DB.TRIGGERS}/status`, triggerStatus);
  
  return {
    success: true,
    message: 'ตั้งค่า System Triggers เรียบร้อย',
    data: triggerStatus
  };
}

function getTriggerStatus() {
  const status = firebaseGet(`${CONFIG.DB.TRIGGERS}/status`);
  const triggers = ScriptApp.getProjectTriggers();
  
  const triggerList = triggers.map(t => ({
    function: t.getHandlerFunction(),
    type: t.getEventType(),
    source: t.getTriggerSource(),
    uniqueId: t.getUniqueId()
  }));
  
  return {
    success: true,
    data: {
      status: status || { setupAt: null, triggers: [] },
      activeTriggers: triggerList
    }
  };
}

// ========== RUN TRIGGER MANUALLY FUNCTIONS ==========
function runReminderManually(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์ (ต้องเป็น Admin เท่านั้น)' };
  }
  
  try {
    sendMeetingReminders();
    return { 
      success: true, 
      message: '✅ รัน Reminder สำเร็จแล้ว',
      data: { triggeredAt: new Date().toISOString() }
    };
  } catch (error) {
    console.error('Error running reminder:', error);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

function runAutoCancelManually(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์ (ต้องเป็น Admin เท่านั้น)' };
  }
  
  try {
    const silentMode = params.silentMode === 'true';
    const result = autoCancelOverdueBookings({ silentMode: silentMode });
    return { 
      success: true, 
      message: `✅ รัน Auto Cancel สำเร็จ (ยกเลิก ${result.data.cancelledCount} รายการ)`,
      data: result.data
    };
  } catch (error) {
    console.error('Error running auto cancel:', error);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

function runCleanupManually(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์ (ต้องเป็น Admin เท่านั้น)' };
  }
  
  try {
    const result = cleanupInactiveUsers({});
    return { 
      success: true, 
      message: `✅ รัน Cleanup สำเร็จ (ลบ ${result.data.cleanedCount} รายการ)`,
      data: result.data
    };
  } catch (error) {
    console.error('Error running cleanup:', error);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

// ========== ENTRY POINT ==========
function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  console.log('Request received');
  
  const params = e.parameter || {};
  const path = params.path || '';
  
  try {
    if (path === 'webhook' || (e.postData && e.postData.contents && e.postData.contents.includes('events'))) {
      return handleLineWebhook(e);
    }

    if (path === 'rooms') return jsonResponse(true, getRooms(params).data);
    if (path === 'rooms/available') return jsonResponse(true, getAvailableRooms(params).data, getAvailableRooms(params).message);
    if (path === 'summary/daily') return jsonResponse(true, getDailySummary(params).data);
    if (path === 'test') return jsonResponse(true, { message: 'API is working' });
    if (path === 'testConnection') return jsonResponse(true, { message: '✅ เชื่อมต่อสำเร็จ' });
    if (path === 'setupDatabase' || path === 'force-create') return jsonResponse(true, forceCreateCollections().data);
    if (path === 'test-line') return jsonResponse(testLineConnection().success, null, testLineConnection().message);
    
    // Trigger management paths
    if (path === 'admin/setup-triggers') {
      const result = setupSystemTriggers();
      return jsonResponse(result.success, result.data, result.message);
    }
    if (path === 'admin/trigger-status') {
      const result = getTriggerStatus();
      return jsonResponse(result.success, result.data);
    }
    if (path === 'admin/run-reminder') {
      const result = runReminderManually(params);
      return jsonResponse(result.success, result.data, result.message);
    }
    if (path === 'admin/run-auto-cancel') {
      const result = runAutoCancelManually(params);
      return jsonResponse(result.success, result.data, result.message);
    }
    if (path === 'admin/run-cleanup') {
      const result = runCleanupManually(params);
      return jsonResponse(result.success, result.data, result.message);
    }
    
    if (!params.lineUserId) {
      return jsonResponse(false, null, 'กรุณาระบุ lineUserId');
    }
    
    const result = routeRequest(path, params);
    return jsonResponse(result.success, result.data, result.message);
    
  } catch (err) {
    console.error('Handler error:', err);
    return jsonResponse(false, null, err.toString());
  }
}

function routeRequest(path, params) {
  switch(path) {
    // User
    case 'user/profile': return getUserProfile(params);
    case 'user/update': return updateUserProfile(params);
    case 'user/bookings': return getUserBookings(params);
    case 'user/get-name': return getUserName(params);
    case 'user/update-email': return updateUserEmail(params);
    
    // Room
    case 'room': return getRoomDetail(params);
    case 'room/create': return createRoom(params);
    case 'room/update': return updateRoom(params);
    case 'room/delete': return deleteRoom(params);
    case 'room/upload-image': return uploadAndUpdateRoomImage(params);
    
    // Booking
    case 'bookings': return getBookings(params);
    case 'booking': return getBookingDetail(params);
    case 'booking/create': return createBooking(params);
    case 'booking/update': return updateBooking(params);
    case 'booking/cancel': return cancelBooking(params);
    case 'booking/approve': return approveBooking(params);
    case 'booking/reject': return rejectBooking(params);
    case 'booking/admin-cancel': return adminCancelBooking(params);
    case 'booking/check-availability': return (params.isMultiDay || (params.multiDayDates && params.multiDayDates.length > 0)) ? checkMultiDayAvailability({ ...params, dates: params.multiDayDates || [], excludeBookingId: params.bookingId || params.excludeBookingId }) : checkAvailability({ ...params, excludeBookingId: params.bookingId || params.excludeBookingId });
    case 'booking/check-multi-day-availability': return checkMultiDayAvailability(params);
    
    // Admin
    case 'admin/stats': return getAdminStats(params);
    case 'admin/users': return getUsers(params);
    case 'admin/user/role': return updateUserRole(params);
    case 'admin/user/delete': return deleteUser(params);
    case 'admin/all-bookings': return getAllBookings(params);
    case 'admin/pending-bookings': return getPendingBookings(params);
    case 'admin/settings/update': return updateSettings(params);
    case 'admin/settings/get': return getSettings(params);
    case 'admin/auto-cancel-overdue': return autoCancelOverdueBookings(params);
    case 'admin/cleanup-inactive': return cleanupInactiveUsers(params);
    case 'admin/cleanup-unfollowed': return cleanupUnfollowedUsers(params);
    case 'admin/monthly-summary/get': return getMonthlyBookingSummary(params);
    case 'admin/monthly-summary/send': return sendMonthlySummaryBroadcast(params);
    
    // Notifications
    case 'notifications': return getUserNotifications(params);
    case 'notification/read': return markNotificationAsRead(params);
    case 'notifications/read-all': return markAllNotificationsAsRead(params);
    
    // Upload
    case 'uploadImage': return uploadImage(params);
    
    // User Linking
    case 'user/link': return linkUserAccounts(params);
    case 'user/linked-ids': return getLinkedUserIdsResult(params);
    
    // Settings
    case 'settings': return getSettings(params);
    
    default: return { success: false, message: 'ไม่พบ path: ' + path };
  }
}

function jsonResponse(success, data, message) {
  const response = { success, data, message };
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== USER LINKING API ==========
function linkUserAccounts(params) {
  const primaryUserId = params.lineUserId;
  const secondaryUserId = params.secondaryUserId;
  const source = params.source || 'api';
  
  if (!primaryUserId || !secondaryUserId) {
    return { success: false, message: 'กรุณาระบุ User ID ทั้งสอง' };
  }
  
  const result = linkUserIds(primaryUserId, secondaryUserId, source);
  
  if (result) {
    return { 
      success: true, 
      data: result,
      message: 'เชื่อมโยงบัญชีสำเร็จ' 
    };
  } else {
    return { 
      success: false, 
      message: 'ไม่สามารถเชื่อมโยงบัญชีได้' 
    };
  }
}

function getLinkedUserIdsResult(params) {
  const lineUserId = params.lineUserId || params;
  const linkedIds = getLinkedUserIds(lineUserId);
  return { success: true, data: linkedIds };
}

// ========== ROLE FUNCTIONS ==========
function getUserRole(lineUserId) {
  if (!lineUserId) return 'guest';
  try {
    const user = getUserFromAnyId(lineUserId);
    // `manager` is the legacy value stored in Firebase. Keep accepting it so
    // existing users do not lose access when the displayed name changes to
    // "ผู้ดำเนินการ".
    const role = user ? (user.role || 'user') : 'guest';
    return role === 'operator' ? 'manager' : role;
  } catch (e) {
    return 'guest';
  }
}

function isAdmin(lineUserId) {
  return getUserRole(lineUserId) === 'admin';
}

function isManager(lineUserId) {
  const role = getUserRole(lineUserId);
  return role === 'manager' || role === 'admin';
}

/**
 * Names and UI permissions returned to the Mini App. The database role is
 * intentionally left as `manager` for backwards compatibility; the user sees
 * it as "ผู้ดำเนินการ" instead.
 */
function getRoleLabel(role) {
  const labels = {
    admin: 'ผู้ดูแลระบบ',
    manager: 'ผู้ดำเนินการ',
    operator: 'ผู้ดำเนินการ',
    user: 'ผู้ใช้งาน',
    guest: 'ผู้เยี่ยมชม'
  };
  return labels[role] || labels.user;
}

function getRolePermissions(role) {
  const normalizedRole = role === 'operator' ? 'manager' : role;
  const isAdminRole = normalizedRole === 'admin';
  const isOperatorRole = normalizedRole === 'manager';

  return {
    // Use these values in the Mini App to decide which navigation items to
    // render. Operators keep their existing booking operations, but do not
    // get the pending-approval, user-management, or settings sections.
    showNotifications: true,
    showPendingApprovals: isAdminRole,
    showUserManagement: isAdminRole,
    showSettings: isAdminRole,
    canManageBookings: isAdminRole || isOperatorRole
  };
}

// ========== USER FUNCTIONS ==========
function getUserProfile(params) {
  const lineUserId = params.lineUserId;
  const forceEmailFetch = params.forceEmailFetch === 'true';
  
  const user = createOrUpdateUserFromLine(lineUserId, 'api');
  
  if (forceEmailFetch && user && !user.email) {
    // ถ้าต้องการให้ดึง email ใหม่ แต่ LINE API ไม่ให้ email ผ่าน Bot API
    // ต้องให้ MiniApp ดึงเองแล้วส่งมาอัปเดต
  }
  
  return {
    success: true,
    data: {
      ...user,
      // Keep `role` unchanged for existing clients; new clients should use
      // roleLabel/permissions when presenting the navigation.
      roleLabel: getRoleLabel(user.role),
      permissions: getRolePermissions(user.role)
    }
  };
}

function updateUserProfile(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  const safeUserId = safeFirebaseKey(primaryId);
  
  const updates = { updatedAt: new Date().toISOString() };
  if (params.phone !== undefined) updates.phone = params.phone;
  if (params.department !== undefined) updates.department = params.department;
  if (params.displayName !== undefined) updates.displayName = params.displayName;
  if (params.email !== undefined) updates.email = params.email;
  if (params.notificationsEnabled !== undefined) {
    updates.notificationsEnabled = params.notificationsEnabled === true || params.notificationsEnabled === 'true';
  }
  
  firebasePatch(`${CONFIG.DB.USERS}/${safeUserId}`, updates);
  return { success: true, message: 'อัปเดตสำเร็จ' };
}

function updateUserEmail(params) {
  const lineUserId = params.lineUserId;
  const email = params.email;
  
  if (!lineUserId || !email) {
    return { success: false, message: 'กรุณาระบุ userId และ email' };
  }
  
  const primaryId = getPrimaryUserId(lineUserId);
  const safeUserId = safeFirebaseKey(primaryId);
  
  firebasePatch(`${CONFIG.DB.USERS}/${safeUserId}`, { 
    email: email,
    updatedAt: new Date().toISOString()
  });
  
  return { success: true, message: 'อัปเดตอีเมลสำเร็จ' };
}

function getUserName(params) {
  const userId = params.userId;
  if (!userId) return { success: false, message: 'ไม่พบ userId' };
  
  const user = getUserFromAnyId(userId);
  if (user && user.displayName) {
    return { success: true, data: { name: user.displayName } };
  }
  
  return { success: false, message: 'ไม่พบชื่อผู้ใช้' };
}

function getUserBookings(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  const linkedIds = getLinkedUserIds(primaryId);
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const userBookings = [];
  
  Object.keys(bookings).forEach(key => {
    const booking = bookings[key];
    if (linkedIds.includes(booking.userId)) {
      userBookings.push(booking);
    }
  });
  
  userBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { success: true, data: userBookings.slice(0, 50) };
}

// ========== ROOM FUNCTIONS ==========
function getRooms(params) {
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  const roomList = [];
  
  Object.keys(rooms).forEach(key => {
    if (rooms[key].status !== 'inactive') {
      roomList.push(rooms[key]);
    }
  });
  
  return { success: true, data: roomList };
}

function getAvailableRooms(params) {
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  
  const now = new Date();
  let checkDateTime = now;
  
  if (params.date) {
    const timeStr = params.time || '00:00';
    checkDateTime = new Date(`${params.date}T${timeStr}:00`);
  }
  
  console.log(`🔍 ตรวจสอบห้องว่าง ณ เวลา: ${checkDateTime.toISOString()}`);
  
  const bookedRoomIds = new Set();
  
  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    
    if (b.status !== 'pending' && b.status !== 'confirmed') return;
    
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    
    if (checkDateTime >= bStart && checkDateTime < bEnd) {
      bookedRoomIds.add(b.roomId);
    }
    
    if (b.isMultiDay && b.multiDayDates) {
      const checkDateStr = Utilities.formatDate(checkDateTime, "Asia/Bangkok", "yyyy-MM-dd");
      if (b.multiDayDates.includes(checkDateStr)) {
        const checkTime = checkDateTime.getHours() * 60 + checkDateTime.getMinutes();
        const startTime = bStart.getHours() * 60 + bStart.getMinutes();
        const endTime = bEnd.getHours() * 60 + bEnd.getMinutes();
        
        if (checkTime >= startTime && checkTime < endTime) {
          bookedRoomIds.add(b.roomId);
        }
      }
    }
  });
  
  const availableRooms = [];
  Object.keys(rooms).forEach(key => {
    const room = rooms[key];
    if (room.status === 'active' && !bookedRoomIds.has(room.roomId)) {
      availableRooms.push(room);
    }
  });
  
  console.log(`✅ พบห้องว่างทั้งหมด ${availableRooms.length} ห้อง จากทั้งหมด ${Object.keys(rooms).length} ห้อง`);
  
  return {
    success: true,
    data: {
      rooms: availableRooms,
      totalRooms: Object.keys(rooms).length,
      availableCount: availableRooms.length,
      checkDateTime: checkDateTime.toISOString(),
      bookedRoomIds: Array.from(bookedRoomIds)
    },
    message: `พบห้องว่าง ${availableRooms.length} ห้อง`
  };
}

function getRoomDetail(params) {
  const roomId = params.roomId;
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  
  for (let key in rooms) {
    if (rooms[key].roomId === roomId) {
      const room = rooms[key];
      
      const now = new Date();
      const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
      let isAvailableNow = true;
      let currentBooking = null;
      
      Object.keys(bookings).forEach(bKey => {
        const b = bookings[bKey];
        if (b.roomId === roomId && (b.status === 'pending' || b.status === 'confirmed')) {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          
          if (now >= bStart && now < bEnd) {
            isAvailableNow = false;
            currentBooking = {
              title: b.title,
              startTime: b.startTime,
              endTime: b.endTime,
              status: b.status,
              userName: b.userName
            };
          }
          
          if (b.isMultiDay && b.multiDayDates && !currentBooking) {
            const todayStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
            if (b.multiDayDates.includes(todayStr)) {
              const nowMinutes = now.getHours() * 60 + now.getMinutes();
              const startMinutes = bStart.getHours() * 60 + bStart.getMinutes();
              const endMinutes = bEnd.getHours() * 60 + bEnd.getMinutes();
              
              if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
                isAvailableNow = false;
                currentBooking = {
                  title: b.title,
                  startTime: b.startTime,
                  endTime: b.endTime,
                  status: b.status,
                  userName: b.userName,
                  isMultiDay: true
                };
              }
            }
          }
        }
      });
      
      return { 
        success: true, 
        data: {
          ...room,
          isAvailableNow,
          currentBooking
        } 
      };
    }
  }
  
  return { success: false, message: 'ไม่พบห้อง' };
}

function getDailySummary(params) {
  const date = params.date || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  
  const targetDate = new Date(date);
  const targetDateStr = date;
  const now = new Date();

  const allDayBookings = [];
  const roomUsage = {};
  const hourlyStats = {};

  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    
    if (b.startTime) {
      const bStart = new Date(b.startTime);
      const bDateStr = Utilities.formatDate(bStart, "Asia/Bangkok", "yyyy-MM-dd");
      if (bDateStr === targetDateStr) {
        allDayBookings.push(b);
        
        if (b.status === 'confirmed' || b.status === 'pending') {
          roomUsage[b.roomId] = (roomUsage[b.roomId] || 0) + 1;
          
          const hour = bStart.getHours();
          hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
        }
      }
    }
    
    if (b.isMultiDay && b.multiDayDates && b.multiDayDates.includes(targetDateStr)) {
      if (!allDayBookings.find(existing => existing.bookingId === b.bookingId)) {
        allDayBookings.push(b);
        
        if (b.status === 'confirmed' || b.status === 'pending') {
          roomUsage[b.roomId] = (roomUsage[b.roomId] || 0) + 1;
          
          const hour = new Date(b.startTime).getHours();
          hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
        }
      }
    }
  });

  const pendingBookings = allDayBookings.filter(b => b.status === 'pending');
  const confirmedBookings = allDayBookings.filter(b => b.status === 'confirmed');
  const completedBookings = allDayBookings.filter(b => 
    b.status === 'confirmed' && new Date(b.endTime) < now
  );
  const cancelledBookings = allDayBookings.filter(b => b.status === 'cancelled');
  const rejectedBookings = allDayBookings.filter(b => b.status === 'rejected');
  const autoCancelledBookings = allDayBookings.filter(b => b.status === 'auto_cancelled');
  const adminCancelledBookings = allDayBookings.filter(b => b.status === 'cancelled' && b.cancelledBy === 'admin');

  const usedRooms = Object.keys(roomUsage).length;
  const totalRooms = Object.keys(rooms).length;

  allDayBookings.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return {
    success: true,
    data: {
      date: targetDateStr,
      thaiDate: targetDate.toLocaleDateString('th-TH', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      statistics: {
        totalBookings: allDayBookings.length,
        pending: pendingBookings.length,
        confirmed: confirmedBookings.length,
        completed: completedBookings.length,
        cancelled: cancelledBookings.length,
        rejected: rejectedBookings.length,
        autoCancelled: autoCancelledBookings.length,
        adminCancelled: adminCancelledBookings.length,
        totalRooms: totalRooms,
        usedRooms: usedRooms,
        availableRooms: totalRooms - usedRooms,
        usage_rate: totalRooms > 0 ? Math.round((usedRooms / totalRooms) * 100) : 0
      },
      hourlyStats: hourlyStats,
      bookings: allDayBookings.slice(0, 50),
      popularRooms: Object.entries(roomUsage)
        .map(([roomId, count]) => ({ roomId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  };
}

function createRoom(params) {
  if (!isAdmin(params.lineUserId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const now = new Date().toISOString();
  const roomId = generateId('RM');
  const roomKey = safeFirebaseKey(roomId);
  
  const newRoom = {
    roomId,
    name: params.name || '',
    capacity: parseInt(params.capacity) || 0,
    location: params.location || '',
    description: params.description || '',
    facilities: params.facilities || '',
    imageUrl: params.imageUrl || '',
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  
  firebasePut(`${CONFIG.DB.ROOMS}/${roomKey}`, newRoom);
  return { success: true, data: { roomId }, message: 'สร้างห้องสำเร็จ' };
}

function updateRoom(params) {
  if (!isAdmin(params.lineUserId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const roomId = params.roomId;
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  
  for (let key in rooms) {
    if (rooms[key].roomId === roomId) {
      const updates = { updatedAt: new Date().toISOString() };
      
      if (params.name !== undefined) updates.name = params.name;
      if (params.capacity !== undefined) updates.capacity = parseInt(params.capacity);
      if (params.location !== undefined) updates.location = params.location;
      if (params.description !== undefined) updates.description = params.description;
      if (params.facilities !== undefined) updates.facilities = params.facilities;
      if (params.imageUrl !== undefined) updates.imageUrl = params.imageUrl;
      if (params.status !== undefined) updates.status = params.status;
      
      firebasePatch(`${CONFIG.DB.ROOMS}/${key}`, updates);
      return { success: true, message: 'แก้ไขสำเร็จ' };
    }
  }
  
  return { success: false, message: 'ไม่พบห้อง' };
}

function deleteRoom(params) {
  if (!isAdmin(params.lineUserId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const roomId = params.roomId;
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  
  for (let key in rooms) {
    if (rooms[key].roomId === roomId) {
      firebaseDelete(`${CONFIG.DB.ROOMS}/${key}`);
      return { success: true, message: 'ลบสำเร็จ' };
    }
  }
  
  return { success: false, message: 'ไม่พบห้อง' };
}

// ========== IMAGE UPLOAD FUNCTIONS ==========
function uploadAndUpdateRoomImage(params) {
  if (!isAdmin(params.lineUserId)) return { success: false, message: 'ไม่มีสิทธิ์อัปโหลดรูป' };
  if (!params.roomId) return { success: false, message: 'กรุณาระบุ roomId' };

  const uploadResult = uploadImage(params);
  if (!uploadResult.success) return uploadResult;

  const roomId = params.roomId;
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  
  for (let key in rooms) {
    if (rooms[key].roomId === roomId) {
      const updates = { imageUrl: uploadResult.data.fileUrl, updatedAt: new Date().toISOString() };
      const updateResult = firebasePatch(`${CONFIG.DB.ROOMS}/${key}`, updates);
      
      if (updateResult) {
        return { 
          success: true, 
          data: { ...uploadResult.data, roomId: roomId, updated: true }, 
          message: 'อัปโหลดรูปและบันทึกข้อมูลเรียบร้อย' 
        };
      } else {
        return { 
          success: false, 
          data: uploadResult.data, 
          message: 'อัปโหลดรูปสำเร็จ แต่ไม่สามารถบันทึกข้อมูลห้องได้' 
        };
      }
    }
  }
  
  return { 
    success: false, 
    data: uploadResult.data, 
    message: 'อัปโหลดรูปสำเร็จ แต่ไม่พบห้องที่ต้องการอัปเดต' 
  };
}

function uploadImage(params) {
  try {
    const fileName = params.fileName || 'image.jpg';
    const fileData = params.fileData;
    const mimeType = params.mimeType || 'image/jpeg';
    
    if (!fileData) {
      return { success: false, message: 'ไม่มีข้อมูลรูปภาพ' };
    }
    
    const bytes = Utilities.base64Decode(fileData);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    
    let folder;
    try {
      folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    } catch (e) {
      folder = DriveApp.createFolder('Meeting_Room_Images_' + new Date().getTime());
    }
    
    const file = folder.createFile(blob);
    file.setDescription('อัปโหลดจากระบบจองห้องประชุม เมื่อ ' + new Date().toLocaleString('th-TH'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    const lh5Url = `https://lh5.googleusercontent.com/d/${fileId}`;
    
    return {
      success: true,
      data: {
        fileId: fileId,
        fileUrl: lh5Url,
        thumbnailUrl: `https://lh5.googleusercontent.com/d/${fileId}=s400`,
        directLink: `https://drive.google.com/uc?export=view&id=${fileId}`,
        fileName: fileName,
        uploadedAt: new Date().toISOString()
      },
      message: 'อัปโหลดรูปภาพสำเร็จ'
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { 
      success: false, 
      message: 'อัปโหลดไม่สำเร็จ: ' + error.toString()
    };
  }
}

// ========== BOOKING FUNCTIONS ==========
function checkAvailability(params) {
  if (!params.roomId) {
    return { success: false, message: 'กรุณาระบุห้องที่ต้องการตรวจสอบ' };
  }
  if (!params.startTime || !params.endTime) {
    return { success: false, message: 'กรุณาระบุเวลาเริ่มต้นและสิ้นสุด' };
  }
  
  const roomId = params.roomId;
  const startTime = new Date(params.startTime);
  const endTime = new Date(params.endTime);
  const excludeBookingId = params.excludeBookingId || null;
  
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return { success: false, message: 'รูปแบบเวลาไม่ถูกต้อง' };
  }
  
  if (startTime >= endTime) {
    return { success: false, message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม' };
  }
  
  const now = new Date();
  if (startTime < now) {
    return { success: false, message: 'ไม่สามารถจองย้อนหลังได้' };
  }
  
  console.log(`🔍 ตรวจสอบห้อง ${roomId} เวลา ${startTime.toISOString()} - ${endTime.toISOString()}`);
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const conflicting = [];
  
  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    
    if (b.roomId !== roomId) return;
    
    if (b.status !== 'pending' && b.status !== 'confirmed') return;
    
    if (excludeBookingId && b.bookingId === excludeBookingId) return;
    
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);
    
    const isOverlapping = (
      (startTime >= bStart && startTime < bEnd) ||
      (endTime > bStart && endTime <= bEnd) ||
      (startTime <= bStart && endTime >= bEnd)
    );
    
    if (isOverlapping) {
      conflicting.push({
        bookingId: b.bookingId,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        title: b.title,
        roomName: b.roomName,
        isMultiDay: b.isMultiDay || false
      });
    }
  });
  
  if (conflicting.length > 0) {
    console.log(`⚠️ พบการจองที่ชนกัน ${conflicting.length} รายการ:`, conflicting);
  } else {
    console.log(`✅ ห้องว่างในช่วงเวลาที่ต้องการ`);
  }
  
  return { 
    success: true, 
    data: { 
      available: conflicting.length === 0,
      conflictingBookings: conflicting,
      conflicting: conflicting
    } 
  };
}

function checkMultiDayAvailability(params) {
  console.log('📆 ตรวจสอบ Multi-Day Availability:', JSON.stringify(params));
  
  const roomId = params.roomId;
  const dates = params.dates;
  const startTimeStr = params.startTime;
  const endTimeStr = params.endTime;
  const excludeBookingId = params.excludeBookingId || null;
  
  if (!roomId) {
    return { success: false, message: 'กรุณาระบุห้องที่ต้องการตรวจสอบ' };
  }
  
  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return { success: false, message: 'กรุณาระบุวันที่อย่างน้อย 1 วัน' };
  }
  
  if (!startTimeStr || !endTimeStr) {
    return { success: false, message: 'กรุณาระบุเวลาเริ่มต้นและสิ้นสุด' };
  }
  
  if (dates.length > 7) {
    return { success: false, message: 'สามารถจองได้สูงสุด 7 วันต่อเนื่อง' };
  }
  
  const sortedDates = dates.sort();
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00');
    const currDate = new Date(sortedDates[i] + 'T00:00:00');
    const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays !== 1) {
      return { success: false, message: 'วันที่ต้องต่อเนื่องกัน (ห้ามข้ามวัน)' };
    }
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDate = new Date(sortedDates[0] + 'T00:00:00');
  
  if (firstDate < today) {
    return { success: false, message: 'ไม่สามารถจองย้อนหลังได้' };
  }
  
  const [startHour, startMinute] = startTimeStr.split(':').map(Number);
  const [endHour, endMinute] = endTimeStr.split(':').map(Number);
  
  if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
    return { success: false, message: 'รูปแบบเวลาไม่ถูกต้อง' };
  }
  
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  if (startMinutes >= endMinutes) {
    return { success: false, message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม' };
  }
  
  const conflictingByDate = {};
  let hasConflict = false;
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  
  for (const dateStr of sortedDates) {
    const dayConflicts = [];
    
    Object.keys(bookings).forEach(key => {
      const b = bookings[key];
      
      if (b.roomId !== roomId) return;
      if (b.status !== 'pending' && b.status !== 'confirmed') return;
      if (excludeBookingId && b.bookingId === excludeBookingId) return;
      
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      
      const bDateStr = bStart.toISOString().split('T')[0];
      
      if (bDateStr === dateStr) {
        const bStartMinutes = bStart.getHours() * 60 + bStart.getMinutes();
        const bEndMinutes = bEnd.getHours() * 60 + bEnd.getMinutes();
        
        const isOverlapping = (
          (startMinutes >= bStartMinutes && startMinutes < bEndMinutes) ||
          (endMinutes > bStartMinutes && endMinutes <= bEndMinutes) ||
          (startMinutes <= bStartMinutes && endMinutes >= bEndMinutes)
        );
        
        if (isOverlapping) {
          dayConflicts.push({
            bookingId: b.bookingId,
            date: bDateStr,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            title: b.title,
            roomName: b.roomName,
            conflictType: 'single'
          });
        }
      }
      
      if (b.isMultiDay && b.multiDayDates && b.multiDayDates.includes(dateStr)) {
        const bStartMinutes = bStart.getHours() * 60 + bStart.getMinutes();
        const bEndMinutes = bEnd.getHours() * 60 + bEnd.getMinutes();
        
        const isOverlapping = (
          (startMinutes >= bStartMinutes && startMinutes < bEndMinutes) ||
          (endMinutes > bStartMinutes && endMinutes <= bEndMinutes) ||
          (startMinutes <= bStartMinutes && endMinutes >= bEndMinutes)
        );
        
        if (isOverlapping) {
          dayConflicts.push({
            bookingId: b.bookingId,
            date: dateStr,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            title: b.title,
            roomName: b.roomName,
            conflictType: 'multi-day'
          });
        }
      }
    });
    
    if (dayConflicts.length > 0) {
      conflictingByDate[dateStr] = dayConflicts;
      hasConflict = true;
    }
  }
  
  console.log(`📆 ผลการตรวจสอบ Multi-Day: ${hasConflict ? 'พบการชนกัน' : 'ว่างทุกวัน'}`);
  
  return {
    success: true,
    data: {
      available: !hasConflict,
      totalDays: sortedDates.length,
      conflictingByDate: hasConflict ? conflictingByDate : {},
      dates: sortedDates
    }
  };
}

function createBooking(params) {
  console.log('📝 createBooking params:', JSON.stringify(params));
  
  if (!params.roomId) {
    return { success: false, message: 'กรุณาระบุห้องประชุม' };
  }
  
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  const isMultiDay = params.isMultiDay === 'true' || params.isMultiDay === true;
  const multiDayDates = params.multiDayDates ? 
    (Array.isArray(params.multiDayDates) ? params.multiDayDates : JSON.parse(params.multiDayDates)) : 
    [];
  
  let startTime, endTime;
  let validationResult;
  
  if (isMultiDay && multiDayDates.length > 0) {
    if (multiDayDates.length > 7) {
      return { success: false, message: 'สามารถจองได้สูงสุด 7 วันต่อเนื่อง' };
    }
    
    validationResult = checkMultiDayAvailability({
      roomId: params.roomId,
      dates: multiDayDates,
      startTime: params.startTime,
      endTime: params.endTime
    });
    
    if (!validationResult.success) return validationResult;
    if (!validationResult.data.available) {
      const conflictDates = Object.keys(validationResult.data.conflictingByDate);
      return {
        success: false,
        message: `ไม่สามารถจองได้ เนื่องจากมีการชนกันในวันที่: ${conflictDates.join(', ')}`,
        data: validationResult.data
      };
    }
    
    startTime = new Date(`${multiDayDates[0]}T${params.startTime}:00`);
    endTime = new Date(`${multiDayDates[multiDayDates.length - 1]}T${params.endTime}:00`);
    
  } else {
    if (!params.startTime || !params.endTime) {
      return { success: false, message: 'กรุณาระบุเวลาเริ่มต้นและสิ้นสุด' };
    }
    
    startTime = new Date(params.startTime);
    endTime = new Date(params.endTime);
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return { success: false, message: 'รูปแบบเวลาไม่ถูกต้อง' };
    }
    
    validationResult = checkAvailability({
      roomId: params.roomId,
      startTime: params.startTime,
      endTime: params.endTime
    });
    
    if (!validationResult.success) return validationResult;
    if (!validationResult.data.available) {
      return { 
        success: false, 
        message: `ห้องไม่ว่างในช่วงเวลาที่เลือก (มีการจองซ้อน ${validationResult.data.conflicting.length} รายการ)` 
      };
    }
  }
  
  let roomName = '';
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  Object.keys(rooms).forEach(key => {
    if (rooms[key].roomId === params.roomId) {
      roomName = rooms[key].name;
    }
  });
  
  if (!roomName) {
    return { success: false, message: 'ไม่พบห้องที่เลือก' };
  }
  
  const now = new Date().toISOString();
  const bookingId = generateId('BK');
  const bookingKey = safeFirebaseKey(bookingId);
  const isAdminRole = isAdmin(lineUserId);
  
  const newBooking = {
    bookingId,
    roomId: params.roomId,
    roomName,
    userId: primaryId,
    originalUserId: lineUserId,
    userName: params.userName || '',
    title: params.title || 'การจองห้องประชุม',
    description: params.description || '',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    attendees: params.attendees || '1',
    meetingLink: params.meetingLink || '',
    status: isAdminRole ? 'approved' : 'pending',
    createdAt: now,
    updatedAt: now,
    reminderSent: false,
    isMultiDay: isMultiDay,
    multiDayDates: isMultiDay ? multiDayDates : [],
    multiDayCount: isMultiDay ? multiDayDates.length : 1
  };
  
  if (isAdminRole) {
    newBooking.approvedBy = primaryId;
    newBooking.approvedAt = now;
  }
  
  const saveResult = firebasePut(`${CONFIG.DB.BOOKINGS}/${bookingKey}`, newBooking);
  
  if (!saveResult) {
    return { success: false, message: 'ไม่สามารถบันทึกการจองได้ กรุณาลองอีกครั้ง' };
  }
  
  if (primaryId !== lineUserId) {
    linkUserIds(primaryId, lineUserId, 'booking_create');
  }
  
  let quotaWarning = '';
  if (!isAdminRole) {
    try {
      const notifyResult = notifyAdminsNewBooking(newBooking);
      if (notifyResult && notifyResult.quotaExceeded) {
        quotaWarning = ' (โควต้าแจ้งเตือนเดือนนี้ครบ ตามเงื่อนไขของไลน์แล้ว โปรดรอการรีเซ็ตค่าในเดือนถัดไป)';
      }
    } catch (e) {
      console.error('Error notifying admins:', e);
    }
  }
  
  console.log(`✅ สร้างการจองสำเร็จ: ${bookingId} (${isMultiDay ? 'Multi-Day: ' + multiDayDates.length + ' days' : 'Single-Day'})`);
  
  let successMsg = isAdminRole ? 
    (isMultiDay ? `จองสำเร็จ ${multiDayDates.length} วัน (อนุมัติอัตโนมัติ)` : 'จองสำเร็จ (อนุมัติอัตโนมัติ)') :
    (isMultiDay ? `จองสำเร็จ ${multiDayDates.length} วัน รอการอนุมัติจากผู้ดูแลระบบ` : 'จองสำเร็จ รอการอนุมัติจากผู้ดูแลระบบ');

  return { 
    success: true, 
    data: { bookingId, bookingData: newBooking },
    message: successMsg + quotaWarning
  };
}

function updateBooking(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  const bookingId = params.bookingId;
  
  if (!bookingId) {
    return { success: false, message: 'กรุณาระบุรหัสการจอง' };
  }
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  
  for (let key in bookings) {
    if (bookings[key].bookingId === bookingId) {
      const booking = bookings[key];
      
      if (booking.userId !== primaryId) {
        return { success: false, message: 'ไม่มีสิทธิ์แก้ไขการจองนี้' };
      }
      
      if (booking.status !== 'pending') {
        return { success: false, message: 'ไม่สามารถแก้ไขการจองที่ดำเนินการแล้ว' };
      }
      
      if (params.startTime || params.endTime || params.roomId || params.multiDayDates) {
        const isMultiDay = params.isMultiDay === 'true' || params.isMultiDay === true || 
                          (params.multiDayDates && booking.isMultiDay);
        
        if (isMultiDay) {
          const dates = params.multiDayDates ? 
            (Array.isArray(params.multiDayDates) ? params.multiDayDates : JSON.parse(params.multiDayDates)) : 
            booking.multiDayDates;
          
          const checkResult = checkMultiDayAvailability({
            roomId: params.roomId || booking.roomId,
            dates: dates,
            startTime: params.startTime || new Date(booking.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endTime: params.endTime || new Date(booking.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
            excludeBookingId: bookingId
          });
          
          if (!checkResult.success) return checkResult;
          if (!checkResult.data.available) {
            return { success: false, message: 'ช่วงเวลาที่เลือกไม่ว่าง' };
          }
        } else {
          const checkParams = {
            roomId: params.roomId || booking.roomId,
            startTime: params.startTime || booking.startTime,
            endTime: params.endTime || booking.endTime,
            excludeBookingId: bookingId
          };
          
          const avail = checkAvailability(checkParams);
          
          if (!avail.success) return avail;
          if (!avail.data.available) {
            return { success: false, message: 'ช่วงเวลาที่เลือกไม่ว่าง' };
          }
        }
      }
      
      const updates = {
        updatedAt: new Date().toISOString()
      };
      
      if (params.title) updates.title = params.title;
      if (params.description !== undefined) updates.description = params.description;
      if (params.meetingLink !== undefined) updates.meetingLink = params.meetingLink;
      if (params.attendees) updates.attendees = params.attendees;
      if (params.roomId) {
        updates.roomId = params.roomId;
        const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
        Object.keys(rooms).forEach(roomKey => {
          if (rooms[roomKey].roomId === params.roomId) {
            updates.roomName = rooms[roomKey].name;
          }
        });
      }
      
      if (params.startTime) updates.startTime = params.startTime;
      if (params.endTime) updates.endTime = params.endTime;
      
      if (params.isMultiDay !== undefined) updates.isMultiDay = params.isMultiDay === 'true' || params.isMultiDay === true;
      if (params.multiDayDates) {
        const dates = Array.isArray(params.multiDayDates) ? params.multiDayDates : JSON.parse(params.multiDayDates);
        updates.multiDayDates = dates;
        updates.multiDayCount = dates.length;
      }
      
      const updateResult = firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, updates);
      
      if (!updateResult) {
        return { success: false, message: 'ไม่สามารถอัปเดตการจองได้' };
      }
      
      return { success: true, message: 'แก้ไขการจองสำเร็จ' };
    }
  }
  
  return { success: false, message: 'ไม่พบการจอง' };
}

function cancelBooking(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  const bookingId = params.bookingId;
  
  if (!bookingId) {
    return { success: false, message: 'กรุณาระบุรหัสการจอง' };
  }
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  
  for (let key in bookings) {
    if (bookings[key].bookingId === bookingId) {
      const booking = bookings[key];
      
      if (!isAdmin(primaryId) && booking.userId !== primaryId) {
        return { success: false, message: 'ไม่มีสิทธิ์ยกเลิกการจองนี้' };
      }
      
      const now = new Date();
      const startTime = new Date(booking.startTime);
      if (startTime < now && !isAdmin(primaryId)) {
        return { success: false, message: 'ไม่สามารถยกเลิกการจองที่ผ่านไปแล้วได้' };
      }
      
      const updateResult = firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: primaryId,
        updatedAt: new Date().toISOString()
      });
      
      if (!updateResult) {
        return { success: false, message: 'ไม่สามารถยกเลิกการจองได้' };
      }
      
      return { success: true, message: 'ยกเลิกการจองสำเร็จ' };
    }
  }
  
  return { success: false, message: 'ไม่พบการจอง' };
}

function approveBooking(params) {
  console.log('📝 approveBooking');

  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);

  if (!primaryId || !params.bookingId) {
    return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
  }
  
  if (!isManager(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์อนุมัติการจอง' };
  }

  const bookingId = params.bookingId;
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};

  for (let key in bookings) {
    if (bookings[key].bookingId === bookingId) {
      const booking = bookings[key];
      
      if (booking.status !== 'pending') {
        return { success: false, message: 'การจองนี้ถูกดำเนินการไปแล้ว' };
      }

      let availResult;
      if (booking.isMultiDay && booking.multiDayDates && booking.multiDayDates.length > 0) {
        availResult = checkMultiDayAvailability({
          roomId: booking.roomId,
          dates: booking.multiDayDates,
          startTime: new Date(booking.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: new Date(booking.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }),
          excludeBookingId: bookingId
        });
      } else {
        availResult = checkAvailability({
          roomId: booking.roomId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          excludeBookingId: bookingId
        });
      }
      
      if (!availResult.success) return availResult;
      if (!availResult.data.available) {
        return { 
          success: false, 
          message: 'ไม่สามารถอนุมัติได้เนื่องจากมีการจองอื่นในช่วงเวลาเดียวกันแล้ว' 
        };
      }

      const now = new Date().toISOString();
      const updates = { 
        status: 'confirmed', 
        approvedAt: now, 
        approvedBy: primaryId, 
        updatedAt: now 
      };
      
      const updateResult = firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, updates);
      
      if (!updateResult) {
        return { success: false, message: 'ไม่สามารถอัปเดตสถานะได้' };
      }

      let quotaWarning = '';
      if (userWantsNotifications(getUserFromAnyId(booking.userId))) {
        const flexMessage = createBookingFlexMessage({...booking, ...updates}, 'approved');
        const result = sendFlexMessage(booking.userId, flexMessage);
        if (result && result.isQuotaError) {
          quotaWarning = ' (โควต้าแจ้งเตือนเดือนนี้ครบ ตามเงื่อนไขของไลน์แล้ว โปรดรอการรีเซ็ตค่าในเดือนถัดไป)';
        }
      }

      return {
        success: true,
        message: '✅ อนุมัติสำเร็จ' + quotaWarning,
        data: { booking: { ...booking, ...updates } }
      };
    }
  }
  
  return { success: false, message: 'ไม่พบการจอง' };
}

function rejectBooking(params) {
  console.log('📝 rejectBooking');

  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);

  if (!primaryId || !params.bookingId) {
    return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
  }
  
  if (!isManager(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์ปฏิเสธการจอง' };
  }

  const bookingId = params.bookingId;
  const reason = params.reason || 'ไม่ระบุเหตุผล';
  const skipNotification = params.skipNotification === 'true';
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};

  for (let key in bookings) {
    if (bookings[key].bookingId === bookingId) {
      const booking = bookings[key];
      
      if (booking.status !== 'pending') {
        return { success: false, message: 'การจองนี้ถูกดำเนินการไปแล้ว' };
      }

      const now = new Date().toISOString();
      const updates = { 
        status: 'rejected', 
        rejectReason: reason, 
        rejectedAt: now,
        rejectedBy: primaryId,
        updatedAt: now 
      };
      
      const updateResult = firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, updates);
      
      if (!updateResult) {
        return { success: false, message: 'ไม่สามารถอัปเดตสถานะได้' };
      }

      let quotaWarning = '';
      if (!skipNotification && userWantsNotifications(getUserFromAnyId(booking.userId))) {
        const flexMessage = createBookingFlexMessage({...booking, ...updates}, 'rejected');
        const result = sendFlexMessage(booking.userId, flexMessage);
        if (result && result.isQuotaError) {
          quotaWarning = ' (โควต้าแจ้งเตือนเดือนนี้ครบ ตามเงื่อนไขของไลน์แล้ว โปรดรอการรีเซ็ตค่าในเดือนถัดไป)';
        }
      }

      return {
        success: true,
        message: '✅ ปฏิเสธสำเร็จ' + quotaWarning,
        data: { booking: { ...booking, ...updates } }
      };
    }
  }
  
  return { success: false, message: 'ไม่พบการจอง' };
}

function adminCancelBooking(params) {
  console.log('📝 adminCancelBooking');

  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);

  if (!primaryId || !params.bookingId) {
    return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
  }
  
  if (!isManager(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์ยกเลิกการจอง' };
  }

  const bookingId = params.bookingId;
  const skipNotification = params.skipNotification === 'true';
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};

  for (let key in bookings) {
    if (bookings[key].bookingId === bookingId) {
      const booking = bookings[key];
      
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        return { success: false, message: 'ไม่สามารถยกเลิกการจองนี้ได้' };
      }

      const now = new Date().toISOString();
      const updates = { 
        status: 'cancelled', 
        cancelledAt: now,
        cancelledBy: 'admin',
        cancelledByUserId: primaryId,
        updatedAt: now 
      };
      
      const updateResult = firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, updates);
      
      if (!updateResult) {
        return { success: false, message: 'ไม่สามารถอัปเดตสถานะได้' };
      }

      let quotaWarning = '';
      if (!skipNotification && userWantsNotifications(getUserFromAnyId(booking.userId))) {
        const flexMessage = createBookingFlexMessage({
          ...booking, 
          ...updates, 
          cancelledBy: 'ผู้ดูแลระบบ'
        }, 'admin_cancelled');
        const result = sendFlexMessage(booking.userId, flexMessage);
        if (result && result.isQuotaError) {
          quotaWarning = ' (โควต้าแจ้งเตือนเดือนนี้ครบ ตามเงื่อนไขของไลน์แล้ว โปรดรอการรีเซ็ตค่าในเดือนถัดไป)';
        }
      }

      return {
        success: true,
        message: '✅ ยกเลิกการจองสำเร็จ' + quotaWarning,
        data: { booking: { ...booking, ...updates } }
      };
    }
  }
  
  return { success: false, message: 'ไม่พบการจอง' };
}

function autoCancelOverdueBookings(params) {
  console.log('🤖 autoCancelOverdueBookings');
  
  const silentMode = params && params.silentMode === 'true';
  const now = new Date();
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  let cancelledCount = 0;
  const cancelledBookings = [];

  Object.keys(bookings).forEach(key => {
    const booking = bookings[key];
    
    if (booking.status === 'confirmed') {
      const endTime = new Date(booking.endTime);
      
      if (booking.isMultiDay && booking.multiDayDates && booking.multiDayDates.length > 0) {
        const lastDate = new Date(booking.multiDayDates[booking.multiDayDates.length - 1] + 'T23:59:59');
        if (lastDate < now) {
          console.log(`🤖 ยกเลิกการจอง multi-day ที่เลยเวลา: ${booking.bookingId}`);
          performAutoCancel(key, booking, cancelledBookings, silentMode);
          cancelledCount++;
        }
      } else if (endTime < now) {
        console.log(`🤖 ยกเลิกการจองที่เลยเวลา: ${booking.bookingId} - ${booking.title}`);
        performAutoCancel(key, booking, cancelledBookings, silentMode);
        cancelledCount++;
      }
    }
  });

  function performAutoCancel(key, booking, cancelledBookings, silentMode) {
    const updates = {
      status: 'auto_cancelled',
      autoCancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updateResult = firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, updates);
    
    if (updateResult) {
      cancelledBookings.push({
        ...booking,
        ...updates
      });
      
      if (!silentMode && userWantsNotifications(getUserFromAnyId(booking.userId))) {
        const flexMessage = createBookingFlexMessage({
          ...booking,
          ...updates
        }, 'auto_cancelled');
        sendFlexMessage(booking.userId, flexMessage);
      }
    }
  }

  console.log(`✅ ยกเลิกการจองที่เลยเวลาแล้ว ${cancelledCount} รายการ`);

  return {
    success: true,
    data: {
      cancelledCount,
      cancelledBookings
    },
    message: `ยกเลิกการจองที่เลยเวลาแล้ว ${cancelledCount} รายการ`
  };
}

function getBookings(params) {
  const roomId = params.roomId;
  const date = params.date;
  const status = params.status;
  const showPast = params.showPast === 'true';
  const startDate = params.startDate;
  const endDate = params.endDate;
  const includeMultiDay = params.includeMultiDay === 'true';
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const result = [];
  const now = new Date();
  
  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    
    if (roomId && b.roomId !== roomId) return;
    
    if (date) {
      const bookingDate = new Date(b.startTime).toISOString().split('T')[0];
      if (bookingDate !== date) {
        if (includeMultiDay && b.isMultiDay && b.multiDayDates && b.multiDayDates.includes(date)) {
          // ผ่าน
        } else {
          return;
        }
      }
    }
    
    if (startDate && endDate) {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      
      if (bStart < sDate || bStart > eDate) {
        if (!(b.isMultiDay && b.multiDayDates && b.multiDayDates.some(d => d >= startDate && d <= endDate))) {
          return;
        }
      }
    }
    
    if (status && b.status !== status) return;
    
    if (!showPast) {
      const endTime = new Date(b.endTime);
      if (endTime < now) {
        if (b.isMultiDay && b.multiDayDates && b.multiDayDates.length > 0) {
          const lastDate = new Date(b.multiDayDates[b.multiDayDates.length - 1] + 'T23:59:59');
          if (lastDate < now) return;
        } else {
          return;
        }
      }
    }
    
    result.push(b);
  });
  
  result.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  
  return { success: true, data: { bookings: result } };
}

function getBookingDetail(params) {
  const bookingId = params.bookingId;
  
  if (!bookingId) {
    return { success: false, message: 'กรุณาระบุรหัสการจอง' };
  }
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  
  for (let key in bookings) {
    if (bookings[key].bookingId === bookingId) {
      return { success: true, data: bookings[key] };
    }
  }
  
  return { success: false, message: 'ไม่พบการจอง' };
}

// ========== ADMIN FUNCTIONS ==========
function getAdminStats(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  
  let pending = 0;
  let confirmed = 0;
  let rejected = 0;
  let cancelled = 0;
  let autoCancelled = 0;
  let adminCancelled = 0;
  let today = 0;
  let multiDayBookings = 0;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  Object.keys(bookings).forEach(key => {
    const booking = bookings[key];
    if (booking.status === 'pending') pending++;
    if (booking.status === 'confirmed') confirmed++;
    if (booking.status === 'rejected') rejected++;
    if (booking.status === 'cancelled') cancelled++;
    if (booking.status === 'auto_cancelled') autoCancelled++;
    if (booking.isMultiDay) multiDayBookings++;
    
    if (booking.startTime?.startsWith(todayStr)) {
      today++;
    }
    if (booking.isMultiDay && booking.multiDayDates && booking.multiDayDates.includes(todayStr)) {
      today++;
    }
  });
  
  const autoCancelStats = {
    today: 0,
    lastRun: null
  };
  
  Object.keys(bookings).forEach(key => {
    const booking = bookings[key];
    if (booking.status === 'auto_cancelled' && booking.autoCancelledAt) {
      const cancelDate = booking.autoCancelledAt.split('T')[0];
      if (cancelDate === todayStr) {
        autoCancelStats.today++;
      }
      
      if (!autoCancelStats.lastRun || booking.autoCancelledAt > autoCancelStats.lastRun) {
        autoCancelStats.lastRun = booking.autoCancelledAt;
      }
    }
    
    if (booking.status === 'cancelled' && booking.cancelledBy === 'admin' && booking.cancelledAt) {
      const cancelDate = booking.cancelledAt.split('T')[0];
      if (cancelDate === todayStr) {
        adminCancelled++;
      }
    }
  });
  
  return {
    success: true,
    data: {
      users: Object.keys(users).length,
      activeUsers: Object.keys(users).filter(key => users[key].status === 'active').length,
      inactiveUsers: Object.keys(users).filter(key => users[key].status === 'inactive').length,
      rooms: Object.keys(rooms).length,
      activeRooms: Object.keys(rooms).filter(key => rooms[key].status === 'active').length,
      bookings: Object.keys(bookings).length,
      pending,
      confirmed,
      rejected,
      cancelled,
      autoCancelled,
      adminCancelled,
      today,
      multiDayBookings,
      autoCancel: autoCancelStats
    }
  };
}

function getUsers(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  const userList = [];
  
  Object.keys(users).forEach(key => {
    userList.push({ ...users[key], roleLabel: getRoleLabel(users[key].role), permissions: getRolePermissions(users[key].role) });
  });
  
  return { success: true, data: userList };
}

function updateUserRole(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const targetUserId = params.targetUserId;
  // Store the legacy value so existing permission checks remain compatible.
  const newRole = params.role === 'operator' ? 'manager' : params.role;
  
  if (!targetUserId || !newRole) {
    return { success: false, message: 'กรุณาระบุผู้ใช้และบทบาท' };
  }
  
  if (!['user', 'manager', 'admin'].includes(newRole)) {
    return { success: false, message: 'บทบาทไม่ถูกต้อง' };
  }
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  
  for (let key in users) {
    if (users[key].lineUserId === targetUserId) {
      const updateResult = firebasePatch(`${CONFIG.DB.USERS}/${key}`, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      
      if (!updateResult) {
        return { success: false, message: 'ไม่สามารถอัปเดตบทบาทได้' };
      }
      
      return { success: true, message: 'อัปเดตสิทธิ์สำเร็จ' };
    }
  }
  
  return { success: false, message: 'ไม่พบผู้ใช้' };
}

function getAllBookings(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isManager(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const list = [];
  
  Object.keys(bookings).forEach(key => {
    list.push(bookings[key]);
  });
  
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return { success: true, data: list };
}

function getPendingBookings(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isManager(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const pending = [];
  
  Object.keys(bookings).forEach(key => {
    if (bookings[key].status === 'pending') {
      pending.push(bookings[key]);
    }
  });
  
  pending.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  
  return { success: true, data: pending };
}

// ========== NOTIFICATIONS ==========
function getUserNotifications(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  const notifications = firebaseGet(CONFIG.DB.NOTIFICATIONS) || {};
  const list = [];
  let unread = 0;
  
  Object.keys(notifications).forEach(key => {
    if (notifications[key].userId === primaryId) {
      list.push(notifications[key]);
      if (!notifications[key].isRead) unread++;
    }
  });
  
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return { 
    success: true, 
    data: { 
      notifications: list.slice(0, 50), 
      unreadCount: unread 
    } 
  };
}

function markNotificationAsRead(params) {
  const notifId = params.notifId;
  const notifications = firebaseGet(CONFIG.DB.NOTIFICATIONS) || {};
  
  for (let key in notifications) {
    if (notifications[key].notifId === notifId) {
      firebasePatch(`${CONFIG.DB.NOTIFICATIONS}/${key}`, { isRead: true });
      return { success: true, message: 'อัปเดตสำเร็จ' };
    }
  }
  
  return { success: false, message: 'ไม่พบการแจ้งเตือน' };
}

function markAllNotificationsAsRead(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  const notifications = firebaseGet(CONFIG.DB.NOTIFICATIONS) || {};
  
  Object.keys(notifications).forEach(key => {
    if (notifications[key].userId === primaryId && !notifications[key].isRead) {
      firebasePatch(`${CONFIG.DB.NOTIFICATIONS}/${key}`, { isRead: true });
    }
  });
  
  return { success: true, message: 'อัปเดตทั้งหมดแล้ว' };
}

// ========== SETTINGS ==========
function getSettings(params) {
  const settings = firebaseGet(`${CONFIG.DB.SETTINGS}/default`);
  
  if (!settings) {
    const defaultSettings = {
      appName: 'Meeting Room',
      requireApproval: 'true',
      reminderMinutesList: '1440,120,60,30,15', // 1 วัน, 2 ชม., 1 ชม., 30 นาที, 15 นาที
      maxBookingDays: '7',
      maxMultiDayBooking: '7',
      minBookingMinutes: '30',
      maxBookingHours: '4',
      cleanupDays: '30',
      updatedAt: new Date().toISOString()
    };
    firebasePut(`${CONFIG.DB.SETTINGS}/default`, defaultSettings);
    return { success: true, data: defaultSettings };
  }
  
  // migrate ค่าเก่า (reminderMinutes เดี่ยว) มาเป็น list ถ้ายังไม่มี
  if (!settings.reminderMinutesList) {
    settings.reminderMinutesList = settings.reminderMinutes 
      ? settings.reminderMinutes.toString() 
      : '1440,120,60,30,15';
    firebasePatch(`${CONFIG.DB.SETTINGS}/default`, { reminderMinutesList: settings.reminderMinutesList });
  }
  
  if (!settings.maxMultiDayBooking) {
    settings.maxMultiDayBooking = '7';
    firebasePatch(`${CONFIG.DB.SETTINGS}/default`, { maxMultiDayBooking: '7' });
  }
  
  if (!settings.cleanupDays) {
    settings.cleanupDays = '30';
    firebasePatch(`${CONFIG.DB.SETTINGS}/default`, { cleanupDays: '30' });
  }
  
  return { success: true, data: settings };
}

function updateSettings(params) {
  const lineUserId = params.lineUserId;
  const primaryId = getPrimaryUserId(lineUserId);
  
  if (!isAdmin(primaryId)) {
    return { success: false, message: 'ไม่มีสิทธิ์' };
  }
  
  const updates = { updatedAt: new Date().toISOString() };
  if (params.appName) updates.appName = params.appName;
  if (params.requireApproval) updates.requireApproval = params.requireApproval;
  if (params.reminderMinutes !== undefined && params.reminderMinutes !== null) {
    updates.reminderMinutes = String(params.reminderMinutes);
    // ซิงก์ reminderMinutesList ให้ตรงกับค่าที่เลือกเสมอ
    // (โดยเฉพาะ 'none' = ปิดการแจ้งเตือน ต้องล้าง list เดิมที่ค้างอยู่ด้วย)
    if (updates.reminderMinutes === 'none' || updates.reminderMinutes === '') {
      updates.reminderMinutesList = '';
    } else {
      updates.reminderMinutesList = updates.reminderMinutes;
    }
  }
  if (params.maxBookingDays) updates.maxBookingDays = params.maxBookingDays;
  if (params.maxMultiDayBooking) updates.maxMultiDayBooking = params.maxMultiDayBooking;
  if (params.minBookingMinutes) updates.minBookingMinutes = params.minBookingMinutes;
  if (params.maxBookingHours) updates.maxBookingHours = params.maxBookingHours;
  if (params.cleanupDays) updates.cleanupDays = params.cleanupDays;
  
  const updateResult = firebasePatch(`${CONFIG.DB.SETTINGS}/default`, updates);
  
  if (!updateResult) {
    return { success: false, message: 'ไม่สามารถบันทึกการตั้งค่าได้' };
  }
  
  // เมื่อมีการอัปเดตการตั้งค่า ให้ setup triggers ใหม่
  try {
    setupSystemTriggers();
  } catch (e) {
    console.error('Error setting up triggers:', e);
  }
  
  return { success: true, message: 'บันทึกสำเร็จ' };
}

// ========== REMINDER FUNCTION (เฉพาะ Admin/Manager) ==========
function sendMeetingReminders() {
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const now = new Date();
  const settings = firebaseGet(`${CONFIG.DB.SETTINGS}/default`) || {};

  // เคารพการปิดแจ้งเตือน: ถ้าเลือก "ไม่แจ้งเตือน" (none) ไม่ว่าค่าจะอยู่ใน
  // reminderMinutes หรือ reminderMinutesList ให้หยุดส่งทันที
  const reminderMinutesRaw = String(settings.reminderMinutes || '').trim();
  const reminderListRaw = String(settings.reminderMinutesList || '').trim();
  if (reminderMinutesRaw === 'none' || reminderListRaw === 'none') {
    console.log('⏰ ปิดการแจ้งเตือนล่วงหน้า (ไม่ส่ง reminder)');
    return;
  }

  const reminderListStr = reminderListRaw || reminderMinutesRaw || '1440,120,60,30,15';
  const reminderPoints = reminderListStr.toString().split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b); // เรียงจากน้อยไปมาก (ใกล้เวลาสุดก่อน)

  if (reminderPoints.length === 0) {
    console.log('⏰ ไม่มีการตั้งค่าแจ้งเตือนล่วงหน้า');
    return;
  }

  const users = firebaseGet(CONFIG.DB.USERS) || {};
  const adminManagerIds = [];

  Object.keys(users).forEach(key => {
    const user = users[key];
    if ((user.role === 'admin' || user.role === 'manager') && user.lineUserId && user.status === 'active' &&
        userWantsNotifications(user)) {
      adminManagerIds.push(user.lineUserId);
    }
  });

  if (adminManagerIds.length === 0) {
    console.log('⏰ ไม่พบ Admin/Manager ในระบบ');
    return;
  }

  console.log(`⏰ ตรวจสอบ reminder ที่จุด: ${reminderPoints.join(', ')} นาที (Admin/Manager ${adminManagerIds.length} คน)`);

  let totalSent = 0;

  Object.keys(bookings).forEach(key => {
    const booking = bookings[key];
    if (booking.status !== 'confirmed') return;

    // หาเวลาอ้างอิงของการประชุม (รองรับทั้งแบบวันเดียวและ multi-day)
    let referenceTime;
    if (booking.isMultiDay && booking.multiDayDates && booking.multiDayDates.length > 0) {
      const startTimeOfDay = new Date(booking.startTime);
      const timeStr = startTimeOfDay.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
      referenceTime = new Date(`${booking.multiDayDates[0]}T${timeStr}:00`);
    } else {
      referenceTime = new Date(booking.startTime);
    }

    const diffMinutes = Math.round((referenceTime - now) / (1000 * 60));
    if (diffMinutes <= 0) return; // เลยเวลาประชุมไปแล้ว ไม่ต้องแจ้ง

    const remindersSent = booking.remindersSent || {};

    // หาจุดแจ้งเตือนที่ "ใกล้เวลาที่สุดที่ยังไม่เคยส่ง" (เรียงน้อยไปมาก เจอตัวแรกที่ตรงเงื่อนไขคือคำตอบ)
    for (const point of reminderPoints) {
      const alreadySent = remindersSent[point] === true;
      if (!alreadySent && diffMinutes <= point) {
        console.log(`⏰ ส่ง reminder [${point} นาทีก่อน] การจอง ${booking.bookingId} (${booking.title}) - เหลือเวลาจริง ${diffMinutes} นาที`);

        const flexMessage = createBookingFlexMessage(
          { ...booking, reminderPoint: point },
          'reminder'
        );

        let sentCount = 0;
        adminManagerIds.forEach(adminId => {
          try {
            const result = sendFlexMessage(adminId, flexMessage);
            if (result.success) sentCount++;
          } catch (e) {
            console.error(`❌ ส่ง reminder ไปยัง ${adminId} ไม่สำเร็จ:`, e);
          }
        });

        if (sentCount > 0) {
          const updatedRemindersSent = { ...remindersSent, [point]: true };
          firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, {
            remindersSent: updatedRemindersSent,
            lastReminderAt: new Date().toISOString(),
            lastReminderPoint: point
          });
          totalSent++;
          console.log(`✅ ส่ง reminder [${point} นาทีก่อน] การจอง ${booking.bookingId} สำเร็จ ${sentCount}/${adminManagerIds.length} คน`);
        }

        break; // ส่งแค่จุดที่ใกล้ที่สุดต่อการจอง 1 รายการต่อรอบ แล้วหยุด
      }
    }
  });

  console.log(`✅ ส่ง reminder ทั้งหมด ${totalSent} รายการ (รอบนี้)`);
}

// ========== CLEANUP INACTIVE USERS ==========
function cleanupInactiveUsers(params) {
  console.log('🧹 เริ่มลบข้อมูลผู้ใช้ที่ inactive เกินกำหนด');
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  const now = new Date();
  const settings = firebaseGet(`${CONFIG.DB.SETTINGS}/default`) || { cleanupDays: 30 };
  const cleanupDays = parseInt(settings.cleanupDays) || 30;
  const cleanups = [];

  Object.keys(users).forEach(key => {
    const user = users[key];
    
    if (user.status === 'inactive' && user.unfollowedAt) {
      const unfollowDate = new Date(user.unfollowedAt);
      const diffDays = Math.round((now - unfollowDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays >= cleanupDays) {
        console.log(`🗑️ ลบข้อมูลผู้ใช้ inactive: ${user.lineUserId} (inactive ${diffDays} วัน)`);
        
        const primaryId = user.lineUserId;
        const linkedIds = getLinkedUserIds(primaryId);
        
        const deletedRecord = {
          user: user,
          linkedIds: linkedIds,
          deletedAt: new Date().toISOString(),
          reason: 'inactive_cleanup',
          daysInactive: diffDays
        };
        
        firebasePut(`${CONFIG.DB.DELETED_USERS}/cleanup_${key}`, deletedRecord);
        
        const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
        let count = 0;
        
        Object.keys(bookings).forEach(bKey => {
          const booking = bookings[bKey];
          if (linkedIds.includes(booking.userId) && 
              (booking.status === 'pending' || booking.status === 'confirmed')) {
            firebasePatch(`${CONFIG.DB.BOOKINGS}/${bKey}`, {
              status: 'auto_cancelled',
              cancelledAt: new Date().toISOString(),
              cancelledBy: 'system_cleanup',
              cancelledReason: 'ลบผู้ใช้ที่ inactive',
              updatedAt: new Date().toISOString()
            });
            count++;
          }
        });
        
        const userKey = safeFirebaseKey(primaryId);
        firebaseDelete(`${CONFIG.DB.USERS}/${userKey}`);
        
        linkedIds.forEach(id => {
          if (id !== primaryId) {
            firebaseDelete(`${CONFIG.DB.USERS}/${safeFirebaseKey(id)}`);
          }
        });
        
        firebaseDelete(`${CONFIG.DB.USER_TRACKING}/${safeFirebaseKey(primaryId)}`);
        
        cleanups.push({
          userId: primaryId,
          displayName: user.displayName,
          daysInactive: diffDays,
          cancelledBookings: count
        });
      }
    }
  });
  
  console.log(`✅ ทำความสะอาดเสร็จ ลบผู้ใช้ ${cleanups.length} รายการ`);
  
  return {
    success: true,
    data: {
      cleanedCount: cleanups.length,
      cleanups: cleanups,
      cleanupDays: cleanupDays
    },
    message: `ลบผู้ใช้ inactive ที่นานเกิน ${cleanupDays} วัน จำนวน ${cleanups.length} รายการ`
  };
}

function cleanupUnfollowedUsers(params) {
  return cleanupInactiveUsers(params);
}

// ========== LINE WEBHOOK HANDLER ==========
function handleLineWebhook(e) {
  try {
    console.log('Webhook received');
    
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('OK');
    }

    const body = JSON.parse(e.postData.contents);
    
    if (body.events && body.events.length === 0) {
      return ContentService.createTextOutput('OK');
    }

    const events = body.events || [];
    const response = ContentService.createTextOutput('OK');

    for (const event of events) {
      if (event.type === 'follow') {
        const userId = event.source.userId;
        console.log('🎉 New follower:', userId);
        
        showLoadingAnimation(userId, 5);
        
        const user = createOrUpdateUserFromLine(userId, 'bot_follow');
        
        const welcomeFlex = createWelcomeFlex(user);
        sendFlexMessage(userId, welcomeFlex);
        
        const safeKey = safeFirebaseKey(userId);
        firebasePatch(`${CONFIG.DB.USERS}/${safeKey}`, { 
          welcomeSent: true,
          lastInteraction: new Date().toISOString(),
          status: 'active',
          unfollowedAt: null
        });
        
        console.log(`✅ ต้อนรับผู้ใช้ใหม่: ${user.displayName || userId}`);
      }

      if (event.type === 'unfollow') {
        const userId = event.source.userId;
        console.log('👋 User unfollowed:', userId);
        handleUserUnfollow(userId);
      }

      if (event.type === 'postback') {
        const userId = event.source.userId;
        const data = event.postback.data;
        const replyToken = event.replyToken;
        
        console.log(`📌 Postback from ${userId}: ${data}`);
        
        try {
          const parts = data.split('&');
          const params = {};
          parts.forEach(part => {
            const [k, v] = part.split('=');
            params[k] = v;
          });
          const action = params.action;
          const bookingId = params.bookingId;
          
          if (action && bookingId) {
            if (!isAdmin(userId) && !isManager(userId)) {
              // ไม่มีสิทธิ์ → ตอบกลับแบบ Reply (ไม่เสียโควต้า)
              replyMessage(replyToken, [{
                type: 'flex',
                altText: '⛔ ไม่มีสิทธิ์',
                contents: {
                  type: 'bubble',
                  header: {
                    type: 'box', layout: 'vertical',
                    backgroundColor: '#ef4444',
                    contents: [{ type: 'text', text: '⛔ ไม่มีสิทธิ์', weight: 'bold', size: 'lg', color: '#ffffff' }]
                  },
                  body: {
                    type: 'box', layout: 'vertical',
                    contents: [{ type: 'text', text: 'เฉพาะผู้ดูแลระบบ (Admin/Manager) เท่านั้น', wrap: true, color: '#666666' }]
                  }
                }
              }]);
            } else {
              if (action === 'approve') {
                const res = approveBooking({ lineUserId: userId, bookingId: bookingId });
                const bookingData = res.data ? res.data.booking : null;

                // สร้าง Flex ยืนยันสำหรับแอดมิน (Reply → ไม่เสียโควต้า)
                const adminConfirmFlex = {
                  type: 'flex',
                  altText: res.success ? '✅ อนุมัติการจองสำเร็จ' : '❌ เกิดข้อผิดพลาด',
                  contents: {
                    type: 'bubble',
                    header: {
                      type: 'box', layout: 'vertical',
                      backgroundColor: res.success ? '#06c755' : '#ef4444',
                      contents: [{
                        type: 'text',
                        text: res.success ? '✅ อนุมัติการจองสำเร็จ' : '❌ ไม่สำเร็จ',
                        weight: 'bold', size: 'lg', color: '#ffffff'
                      }]
                    },
                    body: {
                      type: 'box', layout: 'vertical', spacing: 'sm',
                      contents: res.success && bookingData ? [
                        { type: 'text', text: bookingData.title || 'การจองห้องประชุม', weight: 'bold', size: 'md', wrap: true },
                        { type: 'separator', margin: 'md' },
                        {
                          type: 'box', layout: 'horizontal', margin: 'md',
                          contents: [
                            { type: 'text', text: 'ผู้จอง', size: 'sm', color: '#aaaaaa', flex: 2 },
                            { type: 'text', text: bookingData.userName || '-', size: 'sm', color: '#333333', flex: 3, wrap: true }
                          ]
                        },
                        {
                          type: 'box', layout: 'horizontal',
                          contents: [
                            { type: 'text', text: 'ห้อง', size: 'sm', color: '#aaaaaa', flex: 2 },
                            { type: 'text', text: bookingData.roomName || '-', size: 'sm', color: '#333333', flex: 3, wrap: true }
                          ]
                        },
                        {
                          type: 'box', layout: 'horizontal',
                          contents: [
                            { type: 'text', text: 'สถานะ', size: 'sm', color: '#aaaaaa', flex: 2 },
                            { type: 'text', text: '✅ อนุมัติแล้ว', size: 'sm', color: '#06c755', flex: 3, weight: 'bold' }
                          ]
                        },
                        { type: 'text', text: '📨 ระบบแจ้ง User แล้ว', size: 'xs', color: '#888888', margin: 'md' }
                      ] : [
                        { type: 'text', text: res.message || 'เกิดข้อผิดพลาด', wrap: true, color: '#ef4444' }
                      ]
                    }
                  }
                };

                replyMessage(replyToken, [adminConfirmFlex]);

              } else if (action === 'cancel') {
                const res = rejectBooking({ lineUserId: userId, bookingId: bookingId, reason: 'ยกเลิกโดยแอดมินผ่านแชท' });
                const bookingData = res.data ? res.data.booking : null;

                const adminCancelFlex = {
                  type: 'flex',
                  altText: res.success ? '❌ ยกเลิกการจองสำเร็จ' : '❌ เกิดข้อผิดพลาด',
                  contents: {
                    type: 'bubble',
                    header: {
                      type: 'box', layout: 'vertical',
                      backgroundColor: res.success ? '#f59e0b' : '#ef4444',
                      contents: [{
                        type: 'text',
                        text: res.success ? '❌ ยกเลิกการจองสำเร็จ' : '❌ ไม่สำเร็จ',
                        weight: 'bold', size: 'lg', color: '#ffffff'
                      }]
                    },
                    body: {
                      type: 'box', layout: 'vertical', spacing: 'sm',
                      contents: res.success && bookingData ? [
                        { type: 'text', text: bookingData.title || 'การจองห้องประชุม', weight: 'bold', size: 'md', wrap: true },
                        { type: 'separator', margin: 'md' },
                        {
                          type: 'box', layout: 'horizontal', margin: 'md',
                          contents: [
                            { type: 'text', text: 'ผู้จอง', size: 'sm', color: '#aaaaaa', flex: 2 },
                            { type: 'text', text: bookingData.userName || '-', size: 'sm', color: '#333333', flex: 3, wrap: true }
                          ]
                        },
                        {
                          type: 'box', layout: 'horizontal',
                          contents: [
                            { type: 'text', text: 'ห้อง', size: 'sm', color: '#aaaaaa', flex: 2 },
                            { type: 'text', text: bookingData.roomName || '-', size: 'sm', color: '#333333', flex: 3, wrap: true }
                          ]
                        },
                        {
                          type: 'box', layout: 'horizontal',
                          contents: [
                            { type: 'text', text: 'สถานะ', size: 'sm', color: '#aaaaaa', flex: 2 },
                            { type: 'text', text: '🔴 ยกเลิกแล้ว', size: 'sm', color: '#ef4444', flex: 3, weight: 'bold' }
                          ]
                        },
                        { type: 'text', text: '📨 ระบบแจ้ง User แล้ว', size: 'xs', color: '#888888', margin: 'md' }
                      ] : [
                        { type: 'text', text: res.message || 'เกิดข้อผิดพลาด', wrap: true, color: '#ef4444' }
                      ]
                    }
                  }
                };

                replyMessage(replyToken, [adminCancelFlex]);
              }
            }
          }
        } catch (err) {
          console.error('Postback error:', err);
        }
      }


      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const userId = event.source.userId;
        const replyToken = event.replyToken;
        console.log('💬 Message from', userId, ':', text);
        
        showLoadingAnimation(userId, 5);
        
        const user = createOrUpdateUserFromLine(userId, 'bot_message');
        
        const safeKey = safeFirebaseKey(userId);
        firebasePatch(`${CONFIG.DB.USERS}/${safeKey}`, { 
          lastInteraction: new Date().toISOString() 
        });

        const lowerText = text.toLowerCase();

        if (lowerText === 'เมนู' || lowerText === 'menu') {
          replyMessage(replyToken, [createMainMenuFlex(user.displayName)]);
        } else if (lowerText === 'help' || lowerText === 'ช่วยเหลือ') {
          replyMessage(replyToken, [createHelpFlex()]);
        } else if (lowerText === 'สรุป') {
          const summaryFlex = createDailySummaryFlex(null, userId);
          replyMessage(replyToken, [summaryFlex]);
        } else if (lowerText.includes('ห้องว่าง')) {
          sendAvailableRoomsToday(userId, replyToken);
        } else if (lowerText.includes('การจอง') || lowerText.includes('จอง') || lowerText === 'กดจอง') {
          sendMyBookings(userId, replyToken);
        } else if (lowerText.includes('รออนุมัติ') || lowerText.includes('ยังไม่ได้อนุมัติ') || lowerText.includes('ยังไม่อนุมัติ')) {
          sendPendingBookings(userId, replyToken);
        } else {
          replyMessage(replyToken, [createMainMenuFlex(user.displayName)]);
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Webhook error:', error.toString());
    return ContentService.createTextOutput('OK');
  }
}

function handleUserUnfollow(userId) {
  console.log(`🔄 กำลังลบข้อมูลผู้ใช้ที่ unfollow: ${userId}`);
  
  try {
    const primaryId = getPrimaryUserId(userId);
    const safeKey = safeFirebaseKey(primaryId);
    const now = new Date().toISOString();
    
    const userData = getUserFromAnyId(primaryId);
    
    if (!userData) {
      console.log(`⚠️ ไม่พบข้อมูลผู้ใช้ ${primaryId} ในระบบ`);
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
    }
    
    const linkedIds = getLinkedUserIds(primaryId);
    
    const deletedRecord = {
      originalUserId: primaryId,
      linkedIds: linkedIds,
      userData: userData,
      deletedBy: 'system_unfollow',
      deletedAt: now,
      reason: 'ผู้ใช้เลิกติดตาม LINE Bot'
    };
    
    const deleteId = generateId('DEL');
    firebasePut(`${CONFIG.DB.DELETED_USERS}/unfollow_${deleteId}`, deletedRecord);
    console.log(`✅ บันทึกข้อมูลผู้ใช้ ${primaryId} ลงใน DeletedUsers แล้ว`);
    
    const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
    let cancelledCount = 0;
    const cancelledBookings = [];
    
    Object.keys(bookings).forEach(key => {
      const booking = bookings[key];
      
      const linkedIdsFull = getLinkedUserIds(primaryId);
      if (!linkedIdsFull.includes(booking.userId)) return;
      
      if (booking.status === 'pending' || booking.status === 'confirmed') {
        const startTime = new Date(booking.startTime);
        const nowDate = new Date();
        
        if (startTime > nowDate) {
          console.log(`🔄 ยกเลิกการจอง ${booking.bookingId} (${booking.title}) เนื่องจากผู้ใช้ unfollow`);
          
          const cancelledBookingRecord = {
            ...booking,
            deletedAt: now,
            deletedBy: 'system_unfollow',
            deletedReason: 'ผู้ใช้เลิกติดตาม LINE Bot'
          };
          firebasePut(`${CONFIG.DB.DELETED_USERS}/bookings_${key}_unfollow`, cancelledBookingRecord);
          
          if (firebaseDelete(`${CONFIG.DB.BOOKINGS}/${key}`)) {
            cancelledCount++;
            cancelledBookings.push({
              bookingId: booking.bookingId,
              title: booking.title,
              roomName: booking.roomName,
              startTime: booking.startTime
            });
          }
        } else {
          console.log(`⏭️ ข้ามการยกเลิกการจอง ${booking.bookingId} (เริ่มแล้วหรือผ่านไปแล้ว)`);
          firebasePatch(`${CONFIG.DB.BOOKINGS}/${key}`, {
            status: 'auto_cancelled',
            cancelledAt: now,
            cancelledBy: 'system_unfollow',
            cancelledReason: 'ผู้ใช้เลิกติดตาม LINE Bot (การจองผ่านไปแล้ว)',
            updatedAt: now
          });
        }
      }
    });
    
    console.log(`✅ ยกเลิกการจองที่ยังไม่เริ่ม ${cancelledCount} รายการ เนื่องจาก user unfollow`);
    
    const links = firebaseGet(CONFIG.DB.USER_LINKS) || {};
    let linksDeleted = 0;
    Object.keys(links).forEach(key => {
      const link = links[key];
      if (link.primaryUserId === primaryId || 
          link.secondaryUserId === primaryId ||
          linkedIds.includes(link.primaryUserId) || 
          linkedIds.includes(link.secondaryUserId)) {
        if (firebaseDelete(`${CONFIG.DB.USER_LINKS}/${key}`)) {
          linksDeleted++;
        }
      }
    });
    console.log(`✅ ลบ User Links ${linksDeleted} รายการ`);
    
    const trackingKey = safeFirebaseKey(primaryId);
    if (firebaseDelete(`${CONFIG.DB.USER_TRACKING}/${trackingKey}`)) {
      console.log(`✅ ลบ User Tracking แล้ว`);
    }
    
    const notifications = firebaseGet(CONFIG.DB.NOTIFICATIONS) || {};
    let notifsDeleted = 0;
    Object.keys(notifications).forEach(key => {
      if (notifications[key].userId === primaryId || linkedIds.includes(notifications[key].userId)) {
        if (firebaseDelete(`${CONFIG.DB.NOTIFICATIONS}/${key}`)) {
          notifsDeleted++;
        }
      }
    });
    console.log(`✅ ลบ Notifications ${notifsDeleted} รายการ`);
    
    const userKey = safeFirebaseKey(primaryId);
    if (firebaseDelete(`${CONFIG.DB.USERS}/${userKey}`)) {
      console.log(`✅ ลบผู้ใช้หลัก ${primaryId} แล้ว`);
    }
    
    linkedIds.forEach(id => {
      if (id !== primaryId) {
        const secondaryKey = safeFirebaseKey(id);
        firebaseDelete(`${CONFIG.DB.USERS}/${secondaryKey}`);
        console.log(`✅ ลบผู้ใช้ที่เชื่อมโยง ${id} แล้ว`);
      }
    });
    
    const logData = {
      userId: primaryId,
      lineUserId: userId,
      action: 'unfollow_permanent_delete',
      timestamp: now,
      cancelledBookings: cancelledBookings,
      cancelledCount: cancelledCount,
      linksDeleted: linksDeleted,
      notifsDeleted: notifsDeleted,
      linkedIds: linkedIds
    };
    firebasePut(`${CONFIG.DB.LOGS}/unfollow_delete_${safeKey}_${now.replace(/[:.]/g, '')}`, logData);
    
    if (cancelledCount > 0 || linkedIds.length > 1) {
      notifyAdminsUserUnfollow(primaryId, cancelledBookings, linkedIds);
    }
    
    console.log(`✅ ลบข้อมูลผู้ใช้ ${primaryId} เรียบร้อยแล้ว (Unfollow Cleanup)`);
    
    return {
      success: true,
      message: `ลบข้อมูลผู้ใช้ ${primaryId} และการจอง ${cancelledCount} รายการเรียบร้อย`,
      data: {
        userId: primaryId,
        deletedAt: now,
        cancelledCount: cancelledCount,
        cancelledBookings: cancelledBookings,
        linkedIds: linkedIds,
        linksDeleted: linksDeleted,
        notifsDeleted: notifsDeleted
      }
    };
    
  } catch (error) {
    console.error(`❌ Error handling unfollow for ${userId}:`, error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการจัดการ unfollow: ' + error.toString()
    };
  }
}

function notifyAdminsUserUnfollow(userId, cancelledBookings, linkedIds) {
  console.log(`📢 แจ้งเตือน admin เกี่ยวกับ user unfollow: ${userId}`);
  
  const users = firebaseGet(CONFIG.DB.USERS) || {};
  const userData = getUserFromAnyId(userId);
  const displayName = userData ? userData.displayName || userId : userId;
  
  const notificationText = `🗑️ ผู้ใช้ ${displayName} ได้เลิกติดตาม LINE Bot\n` +
                           `📅 ยกเลิกการจอง ${cancelledBookings.length} รายการ\n` +
                           `🔗 เชื่อมโยง ${linkedIds.length - 1} บัญชี`;
  
  const flexMessage = {
    type: 'flex',
    altText: notificationText,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🗑️ ลบข้อมูลผู้ใช้', weight: 'bold', size: 'xl', color: '#ef4444' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `👤 ผู้ใช้: ${displayName}`, size: 'md', color: '#666666' },
          { type: 'text', text: `🆔 User ID: ${userId}`, size: 'sm', color: '#888888', margin: 'md' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: `📅 ยกเลิกการจอง ${cancelledBookings.length} รายการ`, size: 'sm', color: '#f59e0b', margin: 'md' },
          { type: 'text', text: `🔗 เชื่อมโยง ${linkedIds.length - 1} บัญชี`, size: 'sm', color: '#3b82f6', margin: 'md' },
          { type: 'text', text: '💾 ข้อมูลถูกบันทึกใน DeletedUsers', size: 'xs', color: '#888888', margin: 'md' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'uri', label: 'ดูรายละเอียด', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' }
        ],
        paddingAll: 'lg'
      }
    }
  };
  
  Object.keys(users).forEach(key => {
    const user = users[key];
    if ((user.role === 'admin' || user.role === 'manager') && user.lineUserId && user.status === 'active' &&
        userWantsNotifications(user)) {
      try {
        sendFlexMessage(user.lineUserId, flexMessage);
        console.log(`📤 ส่งแจ้งเตือน unfollow ไปยัง admin: ${user.lineUserId}`);
      } catch (e) {
        console.error(`Error sending to admin ${user.lineUserId}:`, e);
      }
    }
  });
}

// ========== LINE MESSAGING FUNCTIONS ==========
function sendOrReplyFlexMessage(userId, replyToken, flexMessage) {
  if (replyToken) {
    return replyMessage(replyToken, [flexMessage]);
  } else {
    return sendFlexMessage(userId, flexMessage);
  }
}

function sendAvailableRoomsToday(userId, replyToken = null) {
  const availableResult = getAvailableRooms({});
  
  if (!availableResult.success) {
    sendOrReplyFlexMessage(userId, replyToken, {
      type: 'flex', altText: 'เกิดข้อผิดพลาด',
      contents: {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '❌ เกิดข้อผิดพลาด', weight: 'bold', size: 'xl', color: '#ef4444' }] },
        body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'ไม่สามารถตรวจสอบห้องว่างได้ กรุณาลองอีกครั้ง', size: 'md', color: '#666666', wrap: true }] },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [{ type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888' }],
          paddingAll: 'lg'
        }
      }
    });
    return;
  }
  
  const available = availableResult.data.rooms;
  const totalRooms = availableResult.data.totalRooms;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  if (available.length === 0) {
    const noRoomFlex = {
      type: 'flex', altText: 'ขณะนี้ไม่มีห้องว่าง',
      contents: {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '😢 ไม่มีห้องว่าง', weight: 'bold', size: 'xl', color: '#ef4444' }] },
        body: { 
          type: 'box', layout: 'vertical', 
          contents: [
            { type: 'text', text: `เวลา ${timeStr} น.`, size: 'sm', color: '#888888', align: 'center' },
            { type: 'text', text: 'ขณะนี้ห้องประชุมเต็มทั้งหมด', size: 'md', color: '#666666', wrap: true, margin: 'md' },
            { type: 'text', text: 'ลองจองช่วงเวลาอื่น หรือรอสักครู่', size: 'sm', color: '#888888', wrap: true, margin: 'md' }
          ] 
        },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [
            { type: 'button', action: { type: 'uri', label: '📅 ดูช่วงเวลาอื่น', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' },
            { type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888', margin: 'md' }
          ],
          paddingAll: 'lg'
        }
      }
    };
    sendOrReplyFlexMessage(userId, replyToken, noRoomFlex);
    return;
  }

  const roomList = available.slice(0, 10).map(r => ({
    type: 'box', layout: 'horizontal',
    contents: [
      { type: 'text', text: `• ${r.name}`, size: 'sm', color: '#06c755', flex: 3, wrap: true },
      { type: 'text', text: `${r.capacity} ที่นั่ง`, size: 'sm', color: '#888888', flex: 1, align: 'end' }
    ],
    margin: 'md'
  }));

  if (available.length > 10) {
    roomList.push({ type: 'text', text: `และอีก ${available.length - 10} ห้อง...`, size: 'xs', color: '#888888', align: 'end', margin: 'md' });
  }

  sendOrReplyFlexMessage(userId, replyToken, {
    type: 'flex', altText: `✅ ขณะนี้มี ${available.length} ห้องว่าง`,
    contents: {
      type: 'bubble',
      header: { 
        type: 'box', layout: 'vertical', 
        contents: [
          { type: 'text', text: '✅ ห้องว่างขณะนี้', weight: 'bold', size: 'xl', color: '#06c755' },
          { type: 'text', text: `เวลา ${timeStr} น.`, size: 'sm', color: '#888888', margin: 'md' },
          { type: 'text', text: `พบ ${available.length} ห้องว่าง จากทั้งหมด ${totalRooms} ห้อง`, size: 'sm', color: '#666666', margin: 'md' }
        ] 
      },
      body: { type: 'box', layout: 'vertical', contents: roomList },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'uri', label: '📅 จองเลย', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' },
          { type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888', margin: 'md' }
        ],
        paddingAll: 'lg'
      }
    }
  });
}

function sendMyBookings(userId, replyToken = null) {
  console.log(`📋 sendMyBookings สำหรับผู้ใช้: ${userId}`);

  const primaryId = getPrimaryUserId(userId);
  const linkedIds = getLinkedUserIds(primaryId);
  
  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const myBookings = [];

  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    if (linkedIds.includes(b.userId)) {
      myBookings.push(b);
    }
  });

  if (myBookings.length === 0) {
    sendOrReplyFlexMessage(userId, replyToken, {
      type: 'flex', altText: 'คุณยังไม่มีการจอง',
      contents: {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '📅 ไม่มีการจอง', weight: 'bold', size: 'xl', color: '#888888' }] },
        body: { type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: 'คุณยังไม่มีการจองห้องประชุม\nลองจองผ่านแอปได้เลยค่ะ', size: 'md', color: '#666666', wrap: true }
        ] },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [
            { type: 'button', action: { type: 'uri', label: '📅 จองเลย', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' },
            { type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888', margin: 'md' }
          ],
          paddingAll: 'lg'
        }
      }
    });
    return;
  }

  myBookings.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const bookingList = myBookings.slice(0, 10).map(b => {
    const date = new Date(b.startTime);
    const endTime = new Date(b.endTime);
    const now = new Date();
    
    let dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    
    if (b.isMultiDay && b.multiDayDates && b.multiDayDates.length > 1) {
      const firstDate = new Date(b.multiDayDates[0] + 'T00:00:00');
      const lastDate = new Date(b.multiDayDates[b.multiDayDates.length - 1] + 'T00:00:00');
      dateStr = firstDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + 
                ' - ' + 
                lastDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    
    const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    let statusIcon = '⏳';
    let statusColor = '#f59e0b';
    
    if (endTime < now && b.status === 'confirmed') {
      statusIcon = '✅';
      statusColor = '#888888';
    } else if (b.status === 'confirmed') {
      statusIcon = '✅';
      statusColor = '#06c755';
    } else if (b.status === 'rejected') {
      statusIcon = '❌';
      statusColor = '#ef4444';
    } else if (b.status === 'cancelled' && b.cancelledBy === 'admin') {
      statusIcon = '🔴';
      statusColor = '#ef4444';
    } else if (b.status === 'cancelled') {
      statusIcon = '🚫';
      statusColor = '#888888';
    } else if (b.status === 'auto_cancelled') {
      statusIcon = '🤖';
      statusColor = '#f59e0b';
    }

    return {
      type: 'box', layout: 'horizontal',
      contents: [
        { type: 'text', text: statusIcon, size: 'sm', flex: 1, color: statusColor },
        { type: 'text', text: b.roomName || '-', size: 'sm', color: '#06c755', weight: 'bold', flex: 3, wrap: true },
        { type: 'text', text: `${dateStr} ${timeStr}${b.isMultiDay ? ' (ต่อเนื่อง)' : ''}`, size: 'sm', color: '#666666', flex: 4, align: 'end', wrap: true }
      ],
      margin: 'md'
    };
  });

  if (myBookings.length > 10) {
    bookingList.push({ type: 'text', text: `และอีก ${myBookings.length - 10} รายการ...`, size: 'xs', color: '#888888', align: 'end', margin: 'md' });
  }

  const pendingCount = myBookings.filter(b => b.status === 'pending').length;
  const confirmedCount = myBookings.filter(b => b.status === 'confirmed').length;
  const rejectedCount = myBookings.filter(b => b.status === 'rejected').length;
  const cancelledCount = myBookings.filter(b => b.status === 'cancelled').length;
  const autoCancelledCount = myBookings.filter(b => b.status === 'auto_cancelled').length;
  const multiDayCount = myBookings.filter(b => b.isMultiDay).length;

  sendOrReplyFlexMessage(userId, replyToken, {
    type: 'flex', altText: `📅 คุณมี ${myBookings.length} รายการจอง`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: '📅 การจองของฉัน', weight: 'bold', size: 'xl', color: '#06c755' },
          { type: 'text', text: `ทั้งหมด ${myBookings.length} รายการ${multiDayCount > 0 ? ` (ต่อเนื่อง ${multiDayCount} รายการ)` : ''}`, size: 'sm', color: '#888888', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: `✅ ${confirmedCount}`, size: 'xs', color: '#06c755', flex: 1 },
              { type: 'text', text: `⏳ ${pendingCount}`, size: 'xs', color: '#f59e0b', flex: 1 },
              { type: 'text', text: `❌ ${rejectedCount}`, size: 'xs', color: '#ef4444', flex: 1 },
              { type: 'text', text: `🚫 ${cancelledCount}`, size: 'xs', color: '#888888', flex: 1 },
              { type: 'text', text: `🤖 ${autoCancelledCount}`, size: 'xs', color: '#f59e0b', flex: 1 }
            ]
          }
        ]
      },
      body: { type: 'box', layout: 'vertical', contents: bookingList },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'uri', label: '📋 ดูทั้งหมดในแอป', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' },
          { type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888', margin: 'md' }
        ],
        paddingAll: 'lg'
      }
    }
  });
}

function sendPendingBookings(userId, replyToken = null) {
  const primaryId = getPrimaryUserId(userId);
  if (!isManager(primaryId)) {
    const errorFlex = {
      type: 'flex', altText: '⛔ ไม่มีสิทธิ์',
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical', backgroundColor: '#ef4444',
          contents: [{ type: 'text', text: '⛔ ไม่มีสิทธิ์', weight: 'bold', size: 'lg', color: '#ffffff' }]
        },
        body: {
          type: 'box', layout: 'vertical',
          contents: [{ type: 'text', text: 'เฉพาะผู้ดูแลระบบ (Admin/Manager) เท่านั้น', wrap: true, color: '#666666' }]
        }
      }
    };
    sendOrReplyFlexMessage(userId, replyToken, errorFlex);
    return;
  }

  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const pending = [];
  
  Object.keys(bookings).forEach(key => {
    if (bookings[key].status === 'pending') {
      pending.push(bookings[key]);
    }
  });

  pending.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  if (pending.length === 0) {
    const noPendingFlex = {
      type: 'flex', altText: 'ไม่มีรายการรออนุมัติ',
      contents: {
        type: 'bubble',
        body: {
          type: 'box', layout: 'vertical', paddingAll: 'xl',
          contents: [
            {
              type: 'text',
              text: '🎉 ไม่มีรายการรออนุมัติ',
              weight: 'bold',
              size: 'md',
              color: '#06c755',
              align: 'center'
            },
            {
              type: 'text',
              text: 'ขณะนี้ไม่มีรายการจองห้องประชุมที่รอการอนุมัติค่ะ',
              size: 'xs',
              color: '#666666',
              align: 'center',
              margin: 'xs',
              wrap: true
            }
          ]
        }
      }
    };
    sendOrReplyFlexMessage(userId, replyToken, noPendingFlex);
    return;
  }

  const bookingItems = pending.slice(0, 15).map(b => {
    const startTime = new Date(b.startTime);
    const endTime = new Date(b.endTime);
    
    const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    const timeStr = startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + 
                   ' - ' + 
                   endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    
    let dateStr = startTime.toLocaleDateString('th-TH', dateOptions);
    if (b.isMultiDay && b.multiDayDates && b.multiDayDates.length > 1) {
      const firstDate = new Date(b.multiDayDates[0] + 'T00:00:00');
      const lastDate = new Date(b.multiDayDates[b.multiDayDates.length - 1] + 'T00:00:00');
      dateStr = firstDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + 
                ' - ' + 
                lastDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const itemContents = [
      {
        type: 'box', layout: 'horizontal',
        contents: [
          { type: 'text', text: `⏳ รออนุมัติ`, size: 'xs', color: '#f59e0b', weight: 'bold', flex: 1 }
        ]
      },
      {
        type: 'box', layout: 'horizontal', margin: 'xs',
        contents: [
          { type: 'text', text: `${b.roomName || ''}`, size: 'sm', color: '#06c755', weight: 'bold', flex: 1 }
        ]
      },
      {
        type: 'box', layout: 'horizontal', margin: 'xs',
        contents: [
          { type: 'text', text: `📅 ${dateStr} (⏰ ${timeStr})`, size: 'xs', color: '#333333', weight: 'bold', flex: 1 }
        ]
      },
      {
        type: 'box', layout: 'horizontal', margin: 'xs',
        contents: [
          { type: 'text', text: `👤 ผู้จอง: ${b.userName || '-'} (${b.title || '-'})`, size: 'xs', color: '#666666', wrap: true, flex: 1 }
        ]
      },
      {
        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'md',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: 'อนุมัติ', data: `action=approve&bookingId=${b.bookingId}`, displayText: 'อนุมัติการจอง' },
            style: 'primary',
            color: '#06c755',
            height: 'sm',
            flex: 1
          },
          {
            type: 'button',
            action: { type: 'postback', label: 'ยกเลิก', data: `action=cancel&bookingId=${b.bookingId}`, displayText: 'ยกเลิกการจอง' },
            style: 'primary',
            color: '#ef4444',
            height: 'sm',
            flex: 1
          }
        ]
      },
      { type: 'separator', margin: 'md' }
    ];

    return {
      type: 'box', layout: 'vertical',
      contents: itemContents,
      margin: 'md'
    };
  });

  if (pending.length > 15) {
    bookingItems.push({
      type: 'text',
      text: `และอีก ${pending.length - 15} รายการ...`,
      size: 'xs', color: '#888888', align: 'end', margin: 'md'
    });
  }

  const pendingFlex = {
    type: 'flex',
    altText: `⏳ มี ${pending.length} รายการรออนุมัติ`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: '⏳ รายการรออนุมัติทั้งหมด', weight: 'bold', size: 'xl', color: '#f59e0b' },
          { type: 'text', text: `พบทั้งหมด ${pending.length} รายการที่ต้องดำเนินการ`, size: 'sm', color: '#888888', margin: 'md' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: bookingItems
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'message', label: '📋 แสดงเมนู', text: 'เมนู' }, style: 'secondary', color: '#888888' }
        ],
        paddingAll: 'lg'
      }
    }
  };

  sendOrReplyFlexMessage(userId, replyToken, pendingFlex);
}

function notifyAdminsNewBooking(booking) {
  console.log('📢 แจ้งเตือน admin/manager สำหรับการจองใหม่:', booking.bookingId);

  const users = firebaseGet(CONFIG.DB.USERS) || {};
  let quotaExceeded = false;
  const failedAdmins = [];

  Object.keys(users).forEach(key => {
    const user = users[key];
    if ((user.role === 'admin' || user.role === 'manager') && user.lineUserId && user.status === 'active' &&
        userWantsNotifications(user)) {
      console.log(`📤 ส่งถึง: ${user.lineUserId} (role: ${user.role})`);
      try {
        const isAdminRole = user.role === 'admin';
        const flexMessage = createBookingFlexMessage(booking, 'new', isAdminRole);
        const result = sendFlexMessage(user.lineUserId, flexMessage);
        if (result && result.isQuotaError) {
          quotaExceeded = true;
          failedAdmins.push(user);
        }
      } catch (e) {
        console.error(`Error sending to ${user.lineUserId}:`, e);
      }
    }
  });

  // ถ้า quota เกิน → ส่ง email แจ้ง admin ที่มีอีเมล
  if (quotaExceeded) {
    try {
      sendQuotaAlertEmail(booking, failedAdmins, users);
    } catch (e) {
      console.error('❌ ส่ง email แจ้งเตือน quota ไม่สำเร็จ:', e);
    }
  }

  return { quotaExceeded };
}

// ========== SEND EMAIL WHEN LINE PUSH QUOTA EXCEEDED ==========
function sendQuotaAlertEmail(booking, failedAdmins, allUsers) {
  const emailSet = new Set();

  failedAdmins.forEach(u => { if (u.email) emailSet.add(u.email); });

  if (allUsers) {
    Object.keys(allUsers).forEach(key => {
      const u = allUsers[key];
      if ((u.role === 'admin' || u.role === 'manager') && u.status === 'active' && u.email) {
        emailSet.add(u.email);
      }
    });
  }

  const recipients = [...emailSet];
  if (recipients.length === 0) {
    console.warn('⚠️ ไม่พบอีเมล admin/manager ในระบบ ไม่สามารถส่ง email แจ้งเตือนได้');
    return;
  }

  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  const dateStr = startDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const startStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const endStr = endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const subject = `[แจ้งเตือน] มีการจองห้องประชุมใหม่ (LINE โควต้าหมด) - ${booking.roomName}`;

  const body = `แจ้งเตือน: มีการจองห้องประชุมใหม่ แต่ไม่สามารถแจ้งเตือนผ่าน LINE ได้เนื่องจากโควต้าการส่งข้อความ (Push Message) เดือนนี้ครบ 300 ข้อความแล้ว

รายละเอียดการจอง
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• รหัสการจอง   : ${booking.bookingId}
• ชื่อการประชุม : ${booking.title}
• ห้อง          : ${booking.roomName}
• ผู้จอง        : ${booking.userName || '-'}
• วันที่         : ${dateStr}
• เวลา          : ${startStr} - ${endStr} น.
• ผู้เข้าร่วม   : ${booking.attendees || '-'} คน
• สถานะ        : รอการอนุมัติ

กรุณาเข้าสู่ระบบเพื่ออนุมัติหรือปฏิเสธการจอง:
https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
หมายเหตุ: โควต้าการส่งข้อความ LINE Push Message จะรีเซ็ตในวันที่ 1 ของเดือนถัดไป
อีเมลนี้จะถูกส่งแทน LINE สำหรับการจองทุกรายการในเดือนนี้จนกว่าจะรีเซ็ต

ระบบจองห้องประชุม CM Frozen`;

  recipients.forEach(email => {
    try {
      MailApp.sendEmail(email, subject, body);
      console.log(`📧 ส่ง email แจ้งเตือน quota ไปยัง: ${email}`);
    } catch (e) {
      console.error(`❌ ส่ง email ไปยัง ${email} ไม่สำเร็จ:`, e);
    }
  });
}

// ========== FORCE CREATE COLLECTIONS ==========
function forceCreateCollections() {
  const results = { created: [], failed: [] };
  const now = new Date().toISOString();
  
  try {
    const settingsData = {
      appName: 'Meeting Room',
      requireApproval: 'true',
      reminderMinutes: '30',
      maxBookingDays: '7',
      maxMultiDayBooking: '7',
      minBookingMinutes: '30',
      maxBookingHours: '4',
      cleanupDays: '30',
      updatedAt: now
    };
    
    if (firebasePut(`${CONFIG.DB.SETTINGS}/default`, settingsData)) {
      results.created.push('Settings');
    }
    
    const rooms = [
      { roomId: 'RM001', name: 'ห้องประชุมใหญ่', capacity: 20, location: 'ชั้น 2', description: 'ห้องประชุมขนาดใหญ่', facilities: 'โปรเจคเตอร์, จอ', imageUrl: '', status: 'active', createdAt: now, updatedAt: now },
      { roomId: 'RM002', name: 'ห้องประชุมเล็ก', capacity: 6, location: 'ชั้น 3', description: 'เหมาะสำหรับประชุมกลุ่มย่อย', facilities: 'ทีวี, ไวท์บอร์ด', imageUrl: '', status: 'active', createdAt: now, updatedAt: now }
    ];
    
    let roomsCreated = 0;
    rooms.forEach(room => {
      if (firebasePut(`${CONFIG.DB.ROOMS}/${safeFirebaseKey(room.roomId)}`, room)) {
        roomsCreated++;
      }
    });
    if (roomsCreated > 0) results.created.push(`Rooms (${roomsCreated})`);
    
    if (firebasePut(`${CONFIG.DB.USER_LINKS}/_init`, { initialized: true, createdAt: now })) {
      results.created.push('UserLinks');
    }
    
    if (firebasePut(`${CONFIG.DB.DELETED_USERS}/_init`, { initialized: true, createdAt: now })) {
      results.created.push('DeletedUsers');
    }
    
    // สร้าง System Triggers ทันที
    try {
      setupSystemTriggers();
      results.created.push('SystemTriggers');
    } catch (e) {
      console.error('Error setting up triggers:', e);
      results.failed.push('SystemTriggers');
    }
    
    return {
      success: true,
      data: {
        message: '✅ สร้าง collections และ triggers เรียบร้อย',
        created: results.created,
        failed: results.failed
      }
    };
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ========== TEST FUNCTIONS ==========
function testLineConnection() {
  if (!CONFIG.LINE.CHANNEL_ACCESS_TOKEN) {
    return { success: false, message: '❌ ไม่พบ Channel Access Token' };
  }
  try {
    const url = 'https://api.line.me/v2/bot/info';
    const options = {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + CONFIG.LINE.CHANNEL_ACCESS_TOKEN },
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      const botInfo = JSON.parse(response.getContentText());
      return { success: true, message: '✅ เชื่อมต่อ LINE API สำเร็จ', data: botInfo };
    } else {
      return { success: false, message: `❌ LINE API ตอบกลับด้วยรหัส ${responseCode}` };
    }
  } catch (e) {
    return { success: false, message: '❌ ไม่สามารถเชื่อมต่อ LINE API: ' + e.toString() };
  }
}

// ========== MONTHLY BOOKING SUMMARY ==========
function getMonthlyBookingSummary(params) {
  params = params || {};

  const now = new Date();
  let targetMonth = params.month ? parseInt(params.month) : null;
  let targetYear = params.year ? parseInt(params.year) : null;

  if (!targetMonth || !targetYear) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    targetMonth = prev.getMonth() + 1;
    targetYear = prev.getFullYear();
  }

  const monthStart = new Date(targetYear, targetMonth - 1, 1);
  const monthEnd = new Date(targetYear, targetMonth, 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const monthEndStr = monthEnd.toISOString().split('T')[0];

  console.log(`📊 สรุปข้อมูลการจองเดือน ${targetMonth}/${targetYear}`);

  const bookings = firebaseGet(CONFIG.DB.BOOKINGS) || {};
  const rooms = firebaseGet(CONFIG.DB.ROOMS) || {};
  const users = firebaseGet(CONFIG.DB.USERS) || {};

  const userNameMap = {};
  Object.keys(users).forEach(key => {
    const u = users[key];
    if (u.lineUserId) userNameMap[u.lineUserId] = u.displayName || u.lineUserId;
  });

  const monthBookings = [];
  const seenBookingIds = new Set();

  function isInMonth(dateStr) {
    return dateStr >= monthStartStr && dateStr < monthEndStr;
  }

  Object.keys(bookings).forEach(key => {
    const b = bookings[key];
    if (!b || !b.startTime) return;
    if (seenBookingIds.has(b.bookingId)) return;

    const startDateStr = b.startTime.split('T')[0];
    let included = isInMonth(startDateStr);

    if (!included && b.isMultiDay && Array.isArray(b.multiDayDates)) {
      included = b.multiDayDates.some(d => isInMonth(d));
    }

    if (included) {
      monthBookings.push(b);
      seenBookingIds.add(b.bookingId);
    }
  });

  const stats = {
    total: monthBookings.length,
    confirmed: 0,
    pending: 0,
    rejected: 0,
    cancelled: 0,
    autoCancelled: 0,
    adminCancelled: 0,
    multiDay: 0
  };

  const roomUsageCount = {};
  const roomNameMap = {};
  const userUsageCount = {};

  monthBookings.forEach(b => {
    if (b.status === 'confirmed') stats.confirmed++;
    else if (b.status === 'pending') stats.pending++;
    else if (b.status === 'rejected') stats.rejected++;
    else if (b.status === 'auto_cancelled') stats.autoCancelled++;
    else if (b.status === 'cancelled') {
      if (b.cancelledBy === 'admin') stats.adminCancelled++;
      stats.cancelled++;
    }
    if (b.isMultiDay) stats.multiDay++;

    const isRealUsage = b.status === 'confirmed' || b.status === 'completed';
    if (isRealUsage) {
      roomUsageCount[b.roomId] = (roomUsageCount[b.roomId] || 0) + 1;
      roomNameMap[b.roomId] = b.roomName || roomNameMap[b.roomId] || b.roomId;

      const uId = b.userId || b.originalUserId;
      if (uId) {
        userUsageCount[uId] = (userUsageCount[uId] || 0) + 1;
      }
    }
  });

  Object.keys(rooms).forEach(key => {
    const r = rooms[key];
    if (r.roomId && !(r.roomId in roomUsageCount)) {
      roomUsageCount[r.roomId] = 0;
      roomNameMap[r.roomId] = r.name;
    }
  });

  const roomRanking = Object.keys(roomUsageCount)
    .map(roomId => ({
      roomId,
      roomName: roomNameMap[roomId] || roomId,
      count: roomUsageCount[roomId]
    }))
    .sort((a, b) => b.count - a.count);

  const userRanking = Object.keys(userUsageCount)
    .map(userId => ({
      userId,
      displayName: userNameMap[userId] || userId,
      count: userUsageCount[userId]
    }))
    .sort((a, b) => b.count - a.count);

  const totalRooms = Object.keys(rooms).length;
  const roomsUsed = roomRanking.filter(r => r.count > 0).length;

  const thaiMonthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const thaiMonthLabel = `${thaiMonthNames[targetMonth - 1]} ${targetYear + 543}`;

  return {
    month: targetMonth,
    year: targetYear,
    thaiMonthLabel,
    stats,
    totalRooms,
    roomsUsed,
    roomsNeverUsed: totalRooms - roomsUsed,
    roomRanking,
    userRanking,
    usageRate: totalRooms > 0 ? Math.round((roomsUsed / totalRooms) * 100) : 0
  };
}

function sendMonthlySummaryBroadcast(params) {
  params = params || {};
  const callerId = params.lineUserId;
  const callerPrimary = getPrimaryUserId(callerId);

  if (!isAdmin(callerPrimary)) {
    return { success: false, message: 'ไม่มีสิทธิ์ส่งสรุปรายเดือน (ต้องเป็น Admin เท่านั้น)' };
  }

  const summary = getMonthlyBookingSummary({ month: params.month, year: params.year });
  
  const flexMessage = {
    type: 'flex',
    altText: `📊 สรุปการจองเดือน ${summary.thaiMonthLabel}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#06c755', paddingAll: 'lg',
        contents: [
          { type: 'text', text: '📊 สรุปการจองรายเดือน', weight: 'bold', size: 'xl', color: '#ffffff' },
          { type: 'text', text: summary.thaiMonthLabel, size: 'md', color: '#e6fff2', margin: 'md' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#f0fdf4', cornerRadius: 'md', paddingAll: 'md',
                contents: [
                  { type: 'text', text: `${summary.stats.total}`, size: 'xxl', weight: 'bold', color: '#06c755', align: 'center' },
                  { type: 'text', text: 'การจองทั้งหมด', size: 'xs', color: '#666666', align: 'center' }
                ]
              },
              {
                type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#eff6ff', cornerRadius: 'md', paddingAll: 'md', margin: 'md',
                contents: [
                  { type: 'text', text: `${summary.usageRate}%`, size: 'xxl', weight: 'bold', color: '#3b82f6', align: 'center' },
                  { type: 'text', text: 'อัตราใช้ห้อง', size: 'xs', color: '#666666', align: 'center' }
                ]
              }
            ]
          },
          { type: 'separator', margin: 'xl' },
          {
            type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '✅ อนุมัติแล้ว', size: 'sm', color: '#666666', flex: 3 }, { type: 'text', text: `${summary.stats.confirmed} รายการ`, size: 'sm', color: '#06c755', flex: 2, align: 'end' }]},
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '⏳ รออนุมัติ', size: 'sm', color: '#666666', flex: 3 }, { type: 'text', text: `${summary.stats.pending} รายการ`, size: 'sm', color: '#f59e0b', flex: 2, align: 'end' }]},
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '❌ ปฏิเสธ', size: 'sm', color: '#666666', flex: 3 }, { type: 'text', text: `${summary.stats.rejected} รายการ`, size: 'sm', color: '#ef4444', flex: 2, align: 'end' }]},
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '🚫 ยกเลิก (รวม admin)', size: 'sm', color: '#666666', flex: 3 }, { type: 'text', text: `${summary.stats.cancelled} รายการ`, size: 'sm', color: '#888888', flex: 2, align: 'end' }]},
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '🤖 ระบบยกเลิกอัตโนมัติ', size: 'sm', color: '#666666', flex: 3 }, { type: 'text', text: `${summary.stats.autoCancelled} รายการ`, size: 'sm', color: '#f59e0b', flex: 2, align: 'end' }]},
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: '📆 จองต่อเนื่อง', size: 'sm', color: '#666666', flex: 3 }, { type: 'text', text: `${summary.stats.multiDay} รายการ`, size: 'sm', color: '#3b82f6', flex: 2, align: 'end' }]}
            ]
          },
          { type: 'separator', margin: 'xl' },
          { type: 'text', text: `🏢 ห้องที่ถูกใช้มากที่สุด (Top 3)`, weight: 'bold', size: 'md', color: '#444444', margin: 'lg' }
        ].concat(summary.roomRanking.slice(0, 3).map((r, i) => ({
          type: 'box', layout: 'horizontal', margin: 'sm',
          contents: [
            { type: 'text', text: `${i + 1}. ${r.roomName}`, size: 'sm', color: '#666666', flex: 3 },
            { type: 'text', text: `${r.count} ครั้ง`, size: 'sm', color: '#06c755', flex: 1, align: 'end' }
          ]
        }))).concat([
          { type: 'text', text: `📌 สรุปจาก ${summary.totalRooms} ห้อง ใช้จริง ${summary.roomsUsed} ห้อง (${summary.usageRate}%)`, size: 'xs', color: '#888888', margin: 'lg', wrap: true }
        ])
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', action: { type: 'uri', label: '📅 เปิดแอปจองห้อง', uri: `https://miniapp.line.me/${CONFIG.LINE.LIFF_ID}` }, style: 'primary', color: '#06c755' }
        ],
        paddingAll: 'lg'
      }
    }
  };

  const users = firebaseGet(CONFIG.DB.USERS) || {};
  let sentCount = 0;
  let failedCount = 0;
  const targetRole = params.targetRole || 'all';

  Object.keys(users).forEach(key => {
    const u = users[key];
    if (!u.lineUserId || u.status !== 'active') return;
    // ข้ามผู้ใช้ที่ปิดการแจ้งเตือน LINE
    if (!userWantsNotifications(u)) return;

    if (targetRole === 'admin_manager' && !(u.role === 'admin' || u.role === 'manager')) {
      return;
    }

    const result = sendFlexMessage(u.lineUserId, flexMessage);
    if (result && result.success) sentCount++;
    else failedCount++;
  });

  console.log(`📢 ส่งสรุปการจองรายเดือนสำเร็จ ${sentCount} คน, ล้มเหลว ${failedCount} คน`);

  return {
    success: true,
    data: { sentCount, failedCount, targetRole },
    message: `ส่งสรุปการจองรายเดือนสำเร็จ ${sentCount} คน`
  };
}

function checkAndRunEndOfMonthSummary() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isLastDayOfMonth = tomorrow.getMonth() !== today.getMonth();

  if (!isLastDayOfMonth) {
    console.log(`ℹ️ วันนี้ (${today.toISOString().split('T')[0]}) ยังไม่ใช่วันสุดท้ายของเดือน ข้ามการส่งสรุป`);
    return { success: true, message: 'ยังไม่ถึงวันสุดท้ายของเดือน ข้ามการส่ง' };
  }

  console.log(`📅 วันนี้ (${today.toISOString().split('T')[0]}) เป็นวันสุดท้ายของเดือน กำลังส่งสรุปประจำเดือน...`);

  const users = firebaseGet(CONFIG.DB.USERS) || {};
  let adminId = null;
  Object.keys(users).forEach(key => {
    if (!adminId && users[key].role === 'admin' && users[key].lineUserId) {
      adminId = users[key].lineUserId;
    }
  });

  if (!adminId) {
    console.error('❌ ไม่พบ Admin ในระบบ ไม่สามารถส่งสรุปรายเดือนอัตโนมัติได้');
    return { success: false, message: 'ไม่พบ Admin ในระบบ' };
  }

  return sendMonthlySummaryBroadcast({ lineUserId: adminId, targetRole: 'all', month: today.getMonth() + 1, year: today.getFullYear() });
}

// ========== UTILITY FUNCTIONS ==========
function getWebhookUrl() {
  const url = ScriptApp.getService().getUrl();
  return { success: true, data: { webhookUrl: url } };
}

function setupDatabase() {
  return forceCreateCollections();
}

function checkSystem() {
  const lineTest = testLineConnection();
  const firebaseTest = firebaseGet('_test') || { success: true };
  const triggerStatus = getTriggerStatus();
  
  return {
    lineConnection: lineTest,
    firebaseConnection: firebaseTest ? '✅ เชื่อมต่อได้' : '❌ ไม่สามารถเชื่อมต่อ',
    channelToken: CONFIG.LINE.CHANNEL_ACCESS_TOKEN ? '✅ มีค่า' : '❌ ไม่มีค่า',
    liffId: CONFIG.LINE.LIFF_ID ? '✅ มีค่า' : '❌ ไม่มีค่า',
    firebaseUrl: CONFIG.FIREBASE.URL ? '✅ มีค่า' : '❌ ไม่มีค่า',
    driveFolderId: CONFIG.DRIVE_FOLDER_ID ? '✅ มีค่า' : '❌ ไม่มีค่า',
    webhookUrl: ScriptApp.getService().getUrl(),
    triggers: triggerStatus.data,
    timestamp: new Date().toISOString()
  };
}

// ========== END OF CODE ==========