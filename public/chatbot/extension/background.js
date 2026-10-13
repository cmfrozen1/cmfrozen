// LINE BOT MCP — background service worker (MV3)
// ทำหน้าที่ poll inbox แม้ปิด popup และแจ้ง notification เมื่อมีข้อความใหม่ (เคารพโหมดหลับ)

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzeKGBmX3uQh_4Q1xO_Y7udZGj6tbfipoCjxrytst43QK-dAb3hNKKHloVUbCfyR5fn/exec';
const POLL_MINUTES = 1; // ต่อให้ popup poll ทุก 6 วิ, background poll ทุก 1 นาทีพอ
const ALARM_NAME = 'lineBotPoll';

let lastNotifiedKey = '';

async function callGas(action, payload = {}) {
  try {
    const r = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    const t = await r.text();
    return JSON.parse(t);
  } catch (e) { return null; }
}

async function pollAndNotify() {
  const store = await chrome.storage.local.get(['lineBotSleep', 'lineBotLastKey']);
  if (store.lineBotSleep === true) return; // โหมดหลับ พักแจ้งเตือน
  const data = await callGas('getConversations');
  if (!data || !data.success || !data.conversations) return;
  // หาห้องที่มี unreadCount >0 และ timestamp ใหม่สุด
  const unreadConvs = data.conversations.filter(c => (c.unreadCount || 0) > 0);
  if (unreadConvs.length === 0) return;
  // เรียงใหม่สุดก่อน
  unreadConvs.sort((a,b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
  const top = unreadConvs[0];
  const key = top.userId + '|' + top.lastTimestamp + '|' + top.unreadCount;
  if (key === store.lineBotLastKey || key === lastNotifiedKey) return;
  lastNotifiedKey = key;
  await chrome.storage.local.set({ lineBotLastKey: key });

  const totalUnread = data.totalUnread || unreadConvs.reduce((s,c)=>s+(c.unreadCount||0),0);
  const title = `💬 ข้อความใหม่ ${totalUnread} ข้อความ`;
  const msg = `${top.displayName}: ${(top.lastText||'').slice(0,80)}` + (top.unreadCount>1 ? ` (+${top.unreadCount})` : '');

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message: msg,
    priority: 2
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  pollAndNotify();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollAndNotify();
});

chrome.notifications.onClicked.addListener(() => {
  // คลิก notification แล้วเปิด popup ไม่ได้ตรงๆ — เปิดหน้า options หรือ focus extension
  chrome.action.openPopup?.();
});

// ให้ popup เรียก poll ทันทีได้
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'pollNow') {
    pollAndNotify().then(()=>sendResponse({ok:true}));
    return true;
  }
  if (msg && msg.type === 'getSleep') {
    chrome.storage.local.get(['lineBotSleep'], (v)=> sendResponse(v));
    return true;
  }
});
