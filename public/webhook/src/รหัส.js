// ==================== การตั้งค่าเบื้องต้น ====================
const SHEET_NAME = "LineBotHistory";
const CONFIG_SHEET = "BotConfig";

// ==================== ตั้งค่า Main Bot (บอทหลัก) โดยตรงในโค้ด ====================
const MAIN_BOT_CONFIG = {
  name: "ทดสอบบอท",
  token: "RA3XHFAk0E16MpeUMSFYqEyS0a8EPwWH4dQKHdhbaSnY40tHMsnsNigLJCVqKgSB/zZ8TS+7hQRz8a5XTGgyBCSh5aoFyMKbSdcIuII47cvzGQsL9kNpWLN1gnRaMYNVekLIJbsUTx21Evn3uepWgAdB04t89/1O/w1cDnyilFU=",
  isMainBot: true
};

// ==================== ตัวแปรและการประมวลผล Webhook หลายบอท ====================
let currentBotToken = null;
let mainBotIdCache = null;
let reqEvent = null;

function getMainBotId() {
  if (mainBotIdCache) return mainBotIdCache;
  const props = PropertiesService.getScriptProperties();
  let botId = props.getProperty("main_bot_id");
  if (!botId) {
    const mainBot = getMainBot();
    if (mainBot) {
      const profile = getBotProfile(mainBot.token);
      if (profile && profile.userId) {
        botId = profile.userId;
        props.setProperty("main_bot_id", botId);
      }
    }
  }
  mainBotIdCache = botId;
  return botId;
}

function getBotToken(destination) {
  if (!destination) {
    const mainBot = getMainBot();
    return mainBot ? mainBot.token : null;
  }
  
  const mainBotId = getMainBotId();
  if (destination === mainBotId) {
    const mainBot = getMainBot();
    return mainBot ? mainBot.token : null;
  }
  
  const bots = getAllBots();
  const bot = bots.find(b => b.botId === destination);
  if (bot) {
    return bot.token;
  }
  
  // Default to main bot
  const mainBot = getMainBot();
  return mainBot ? mainBot.token : null;
}

// ==================== ฟังก์ชันหลัก Webhook ====================
function doPost(e) {
  try {
    if (!e || !e.postData) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "Error", 
        message: "No post data" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const webhookData = JSON.parse(e.postData.contents);
    const events = webhookData.events;
    const destination = webhookData.destination;
    
    // ตั้งค่า Token ของบอทที่ได้รับ Webhook Event สำหรับคำขอนี้
    currentBotToken = getBotToken(destination);
    
    if (!events || events.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "No events" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    for (const event of events) {
      handleEvent(event);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "Success", 
      message: "Events processed" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("Webhook Error:", error);
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "Error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== จัดการ Event ทั้งหมด ====================
function handleEvent(event) {
  reqEvent = event;
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  
  console.log("Event received:", JSON.stringify(event));
  
  switch(event.type) {
    case "message":
      handleMessageEvent(event, userId, replyToken);
      break;
    case "follow":
      handleFollowEvent(userId, replyToken);
      break;
    case "unfollow":
      handleUnfollowEvent(userId);
      break;
    case "join":
      handleJoinEvent(event, userId, replyToken);
      break;
    case "leave":
      handleLeaveEvent(event, userId);
      break;
    case "postback":
      handlePostbackEvent(event, userId, replyToken);
      break;
    default:
      console.log("Unhandled event type:", event.type);
  }
}

// ==================== จัดการ Message Event ====================
function handleMessageEvent(event, userId, replyToken) {
  const message = event.message;
  
  // เรียกใช้ Loading Animation เมื่อมีการเริ่มถามตอบบอท
  const token = currentBotToken || getMainBot()?.token;
  const chatId = event.source.userId || event.source.groupId || event.source.roomId || userId;
  startLoadingAnimation(chatId, token);
  
  if (message.type === "text") {
    const userMessage = message.text.trim();
    console.log(`Message from ${userId}: "${userMessage}"`);
    
    if (userMessage === "/start" || userMessage === "เริ่มต้น" || userMessage === "start") {
      showMainMenu(userId, replyToken);
      return;
    }
    
    const userState = getUserState(userId);
    console.log(`User state for ${userId}: "${userState}"`);
    
    if (!userState || userState === "main" || userState === "menu") {
      handleMainMenu(userId, userMessage, replyToken);
    } else {
      handleSubMenu(userId, userMessage, userState, replyToken);
    }
  } else {
    replyTextMessage(replyToken, `📎 รับข้อความประเภท: ${message.type}\nแต่บอทรองรับเฉพาะข้อความเท่านั้น`);
  }
}

// ==================== แสดงเมนูหลัก ====================
function showMainMenu(userId, replyToken) {
  const quickReply = createMainMenuFlexMessage();
  quickReply.quickReply = {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "📤 ส่ง Push",
          text: "ส่ง Push"
        }
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "📢 Broadcast",
          text: "ส่ง Broadcast"
        }
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "📊 ตรวจโควต้า",
          text: "ตรวจสอบโควต้า"
        }
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "📜 ประวัติ",
          text: "ดูประวัติ"
        }
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "⚙️ จัดการบอท",
          text: "จัดการบอท"
        }
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "ℹ️ ช่วยเหลือ",
          text: "ช่วยเหลือ"
        }
      }
    ]
  };
  
  if (replyToken) {
    replyMessage(replyToken, quickReply);
  } else {
    sendMessageToUser(userId, quickReply);
  }
  setUserState(userId, "main");
}

// ==================== จัดการเมนูหลัก ====================
function handleMainMenu(userId, message, replyToken) {
  switch(message) {
    case "ส่ง Push":
    case "ส่ง Broadcast":
      showBotSelection(userId, message, replyToken);
      break;
    case "ตรวจสอบโควต้า":
      showBotSelectionForQuota(userId, replyToken);
      break;
    case "ดูประวัติ":
      showBotSelectionForHistory(userId, replyToken);
      break;
    case "จัดการบอท":
      showBotManagement(userId, replyToken);
      break;
    case "ช่วยเหลือ":
      showHelp(userId, replyToken);
      break;
    default:
      replyTextMessage(replyToken, "❌ ไม่รู้จักคำสั่งนี้\nกรุณาเลือกจากเมนูด้านล่าง");
      showMainMenu(userId, replyToken);
  }
}

// ==================== จัดการ Postback Event ====================
function handlePostbackEvent(event, userId, replyToken) {
  const data = event.postback.data;
  console.log("Postback data:", data);
  
  const params = new URLSearchParams(data);
  const action = params.get('action');
  const botName = params.get('bot');
  const target = params.get('target');
  
  switch(action) {
    case 'select_bot': {
      const bot = getAllBots().find(b => b.name === botName);
      if (!bot) {
        replyTextMessage(replyToken, "❌ ไม่พบบอทนี้");
        showMainMenu(userId, replyToken);
        return;
      }
      showMessageTypeSelection(userId, bot, target, replyToken);
      break;
    }
    case 'delete_bot':
      deleteBot(userId, botName, replyToken);
      break;
    case 'edit_bot':
      editBot(userId, botName, replyToken);
      break;
    default:
      replyTextMessage(replyToken, "❌ ไม่รู้จัก Action นี้");
      showMainMenu(userId, replyToken);
  }
}

// ==================== แสดงตัวเลือก Bot ====================
function showBotSelection(userId, actionType, replyToken) {
  const bots = getAllBots();
  
  if (bots.length === 0) {
    replyTextMessage(replyToken, "❌ ไม่พบบอทที่กำหนดค่าไว้\nกรุณาตั้งค่าใน Sheet BotConfig หรือเพิ่มบอทผ่านเมนูจัดการบอท");
    showMainMenu(userId, replyToken);
    return;
  }
  
  const items = bots.map(bot => ({
    type: "action",
    action: {
      type: "message",
      label: bot.isMainBot ? `⭐ ${bot.name}` : bot.name,
      text: `เลือกบอท:${bot.name}`
    }
  }));
  
  items.push({
    type: "action",
    action: {
      type: "message",
      label: "🔙 กลับ",
      text: "กลับ"
    }
  });
  
  const quickReply = {
    type: "text",
    text: `🤖 เลือกบอทที่ต้องการ${actionType === "ส่ง Broadcast" ? " (Broadcast)" : ""}:\n⭐ = บอทหลัก`,
    quickReply: {
      items: items
    }
  };
  
  replyMessage(replyToken, quickReply);
  setUserState(userId, `bot_selection:${actionType}`);
}

// ==================== แสดงตัวเลือก Bot สำหรับโควต้า ====================
function showBotSelectionForQuota(userId, replyToken) {
  const bots = getAllBots();
  
  if (bots.length === 0) {
    replyTextMessage(replyToken, "❌ ไม่พบบอทที่กำหนดค่าไว้");
    showMainMenu(userId, replyToken);
    return;
  }
  
  const items = bots.map(bot => ({
    type: "action",
    action: {
      type: "message",
      label: bot.isMainBot ? `⭐ ${bot.name}` : bot.name,
      text: `โควต้า:${bot.name}`
    }
  }));
  
  items.push({
    type: "action",
    action: {
      type: "message",
      label: "🔙 กลับ",
      text: "กลับ"
    }
  });
  
  const quickReply = {
    type: "text",
    text: "📊 เลือกบอทที่ต้องการตรวจสอบโควต้า:",
    quickReply: {
      items: items
    }
  };
  
  replyMessage(replyToken, quickReply);
  setUserState(userId, "quota_selection");
}

// ==================== แสดงตัวเลือก Bot สำหรับประวัติ ====================
function showBotSelectionForHistory(userId, replyToken) {
  const bots = getAllBots();
  
  if (bots.length === 0) {
    replyTextMessage(replyToken, "❌ ไม่พบบอทที่กำหนดค่าไว้");
    showMainMenu(userId, replyToken);
    return;
  }
  
  const items = bots.map(bot => ({
    type: "action",
    action: {
      type: "message",
      label: bot.isMainBot ? `⭐ ${bot.name}` : bot.name,
      text: `ประวัติ:${bot.name}`
    }
  }));
  
  items.push({
    type: "action",
    action: {
      type: "message",
      label: "🔙 กลับ",
      text: "กลับ"
    }
  });
  
  const quickReply = {
    type: "text",
    text: "📜 เลือกบอทที่ต้องการดูประวัติ:",
    quickReply: {
      items: items
    }
  };
  
  replyMessage(replyToken, quickReply);
  setUserState(userId, "history_selection");
}

// ==================== จัดการเมนูย่อย ====================
function handleSubMenu(userId, message, state, replyToken) {
  console.log(`handleSubMenu - User: ${userId}, Message: "${message}", State: "${state}"`);
  
  // ถ้าผู้ใช้พิมพ์ "กลับ" หรือ "🔙 กลับ" ให้กลับไปเมนูหลัก
  if (message === "กลับ" || message === "🔙 กลับ") {
    showMainMenu(userId, replyToken);
    return;
  }
  
  if (state.startsWith("bot_selection:")) {
    const actionType = state.split(":")[1];
    const botNameMatch = message.match(/^เลือกบอท:(.+)/);
    
    if (!botNameMatch) {
      replyTextMessage(replyToken, "❌ กรุณาเลือกบอทจากปุ่ม");
      return;
    }
    
    const botName = botNameMatch[1];
    const bot = getAllBots().find(b => b.name === botName);
    
    if (!bot) {
      replyTextMessage(replyToken, "❌ ไม่พบบอทนี้");
      showMainMenu(userId, replyToken);
      return;
    }
    
    showMessageTypeSelection(userId, bot, actionType, replyToken);
    
  } else if (state === "quota_selection") {
    const botNameMatch = message.match(/^โควต้า:(.+)/);
    
    if (!botNameMatch) {
      replyTextMessage(replyToken, "❌ กรุณาเลือกบอทจากปุ่ม");
      return;
    }
    
    const botName = botNameMatch[1];
    checkQuota(userId, botName, replyToken);
    
  } else if (state === "history_selection") {
    const botNameMatch = message.match(/^ประวัติ:(.+)/);
    
    if (!botNameMatch) {
      replyTextMessage(replyToken, "❌ กรุณาเลือกบอทจากปุ่ม");
      return;
    }
    
    const botName = botNameMatch[1];
    showHistory(userId, botName, replyToken);
    
  } else if (state.startsWith("message_type:")) {
    const parts = state.split(":");
    const botName = parts[1];
    const actionType = parts[2];
    
    handleMessageTypeSelection(userId, botName, actionType, message, replyToken);
    
  } else if (state.startsWith("sending:")) {
    const parts = state.split(":");
    const botName = parts[1];
    const actionType = parts[2];
    const messageType = parts[3];
    
    handleMessageSending(userId, botName, actionType, messageType, message, replyToken);
    
  } else if (state.startsWith("bot_management:")) {
    handleBotManagementAction(userId, message, state, replyToken);
    
  } else {
    replyTextMessage(replyToken, "❌ ไม่รู้จักสถานะนี้ กรุณาเริ่มใหม่");
    showMainMenu(userId, replyToken);
  }
}

// ==================== แสดงประเภทข้อความ ====================
function showMessageTypeSelection(userId, bot, actionType, replyToken) {
  const quickReply = {
    type: "text",
    text: `✏️ เลือกประเภทข้อความที่ต้องการส่ง (${bot.isMainBot ? "⭐ " : ""}${bot.name} - ${actionType}):\n\n💡 คำแนะนำ:\n• Text: พิมพ์ข้อความธรรมดา\n• Image: ส่ง URL รูปภาพ\n• Flex: ส่ง JSON Flex Message`,
    quickReply: {
      items: [
        {
          type: "action",
          action: {
            type: "message",
            label: "📝 ข้อความ",
            text: "text"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "🖼️ รูปภาพ",
            text: "image"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "🎬 วิดีโอ",
            text: "video"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "🎵 เสียง",
            text: "audio"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "📄 ไฟล์",
            text: "file"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "🎨 Flex",
            text: "flex"
          }
        },
        {
          type: "action",
          action: {
            type: "message",
            label: "🔙 กลับ",
            text: "กลับ"
          }
        }
      ]
    }
  };
  
  replyMessage(replyToken, quickReply);
  setUserState(userId, `message_type:${bot.name}:${actionType}`);
}

// ==================== จัดการประเภทข้อความ ====================
function handleMessageTypeSelection(userId, botName, actionType, messageType, replyToken) {
  if (messageType === "กลับ") {
    showMainMenu(userId, replyToken);
    return;
  }
  
  if (actionType === "ส่ง Push") {
    replyTextMessage(replyToken, `📌 กรุณาระบุ User ID หรือ Group ID\n\nรูปแบบ: ID|ข้อความ\n\nตัวอย่าง: U4af4980629...|สวัสดีครับ`);
    setUserState(userId, `sending:${botName}:${actionType}:${messageType}`);
    return;
  }
  
  const instructions = getMessageTypeInstructions(messageType);
  replyTextMessage(replyToken, instructions);
  setUserState(userId, `sending:${botName}:${actionType}:${messageType}`);
}

// ==================== รับคำแนะนำตามประเภทข้อความ ====================
function getMessageTypeInstructions(type) {
  const instructions = {
    "text": "📝 กรุณาส่งข้อความที่ต้องการ (ข้อความเดียว):",
    "image": "🖼️ กรุณาส่ง URL รูปภาพ (ต้องเป็น HTTPS):",
    "video": "🎬 กรุณาส่ง URL วิดีโอ (ต้องเป็น HTTPS):",
    "audio": "🎵 กรุณาส่ง URL เสียง (ต้องเป็น HTTPS):",
    "file": "📄 กรุณาส่ง URL ไฟล์ (ต้องเป็น HTTPS):",
    "flex": "🎨 กรุณาส่ง JSON Flex Message (ทั้งออบเจ็กต์):\n\nตัวอย่าง:\n{\n  \"type\": \"flex\",\n  \"altText\": \"Hello\",\n  \"contents\": {...}\n}"
  };
  return instructions[type] || "กรุณาส่งข้อมูลที่ต้องการ";
}

// ==================== จัดการการส่งข้อความ ====================
function handleMessageSending(userId, botName, actionType, messageType, content, replyToken) {
  try {
    const bot = getAllBots().find(b => b.name === botName);
    if (!bot) {
      replyTextMessage(replyToken, "❌ ไม่พบบอทนี้");
      showMainMenu(userId, replyToken);
      return;
    }
    
    let messageData;
    let targetId = null;
    
    if (content.includes("|") && actionType === "ส่ง Push") {
      const parts = content.split("|");
      targetId = parts[0];
      content = parts.slice(1).join("|");
    }
    
    messageData = createMessageObject(messageType, content);
    
    if (!messageData) {
      replyTextMessage(replyToken, "❌ ไม่สามารถสร้างข้อความได้ กรุณาตรวจสอบข้อมูล");
      return;
    }
    
    let response;
    
    if (actionType === "ส่ง Push") {
      if (!targetId) {
        replyTextMessage(replyToken, "❌ ไม่พบ Target ID กรุณาระบุ ID|ข้อความ");
        return;
      }
      response = pushMessage(bot.token, targetId, messageData);
    } else {
      response = broadcastMessage(bot.token, messageData);
    }
    
    saveHistory({
      botName: botName,
      actionType: actionType,
      messageType: messageType,
      content: content,
      targetId: targetId,
      response: response,
      userId: userId,
      timestamp: new Date().toISOString()
    });
    
    const resultFlex = createSendResultFlexMessage(actionType, botName, messageType, response);
    replyMessage(replyToken, resultFlex);
    
    if (response && response.status === "success") {
      checkQuota(userId, botName, null);
    }
    
    showMainMenu(userId, null);
    
  } catch (error) {
    console.error("Error sending message:", error);
    replyTextMessage(replyToken, `❌ เกิดข้อผิดพลาด: ${error.message}`);
    showMainMenu(userId, replyToken);
  }
}

// ==================== สร้าง Object ข้อความ ====================
function createMessageObject(messageType, content) {
  try {
    switch(messageType) {
      case "text":
        return { type: "text", text: content };
      case "image":
        return { 
          type: "image", 
          originalContentUrl: content, 
          previewImageUrl: content 
        };
      case "video":
        return { 
          type: "video", 
          originalContentUrl: content, 
          previewImageUrl: content 
        };
      case "audio":
        return { 
          type: "audio", 
          originalContentUrl: content, 
          duration: 60000 
        };
      case "file":
        return { 
          type: "file", 
          originalContentUrl: content, 
          fileName: "file" 
        };
      case "flex":
        const flexData = JSON.parse(content);
        return flexData;
      default:
        return null;
    }
  } catch (e) {
    console.error("Error creating message object:", e);
    return null;
  }
}

// ==================== ส่งข้อความ Push ====================
function pushMessage(channelToken, to, message) {
  try {
    const url = "https://api.line.me/v2/bot/message/push";
    const payload = {
      to: to,
      messages: Array.isArray(message) ? message : [message]
    };
    
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + channelToken
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      return { status: "success", code: responseCode };
    } else {
      return { 
        status: "error", 
        code: responseCode, 
        message: response.getContentText() 
      };
    }
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}

// ==================== ส่งข้อความ Broadcast ====================
function broadcastMessage(channelToken, message) {
  try {
    const url = "https://api.line.me/v2/bot/message/broadcast";
    const payload = {
      messages: Array.isArray(message) ? message : [message]
    };
    
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + channelToken
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      return { status: "success", code: responseCode };
    } else {
      return { 
        status: "error", 
        code: responseCode, 
        message: response.getContentText() 
      };
    }
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}

// ==================== Reply Message ====================
function replyMessage(replyToken, message) {
  try {
    if (!replyToken) return;
    
    const url = "https://api.line.me/v2/bot/message/reply";
    
    let messages = Array.isArray(message) ? message : [message];
    
    // เมื่อมีการตอบเป็น TypeText ให้เพิ่ม 'quoteToken': reqEvent.message.quoteToken
    if (reqEvent && reqEvent.message && reqEvent.message.quoteToken) {
      messages = messages.map(msg => {
        if (msg && msg.type === "text") {
          return {
            ...msg,
            quoteToken: reqEvent.message.quoteToken
          };
        }
        return msg;
      });
    }
    
    const payload = {
      replyToken: replyToken,
      messages: messages
    };
    
    const token = currentBotToken || getMainBot()?.token;
    if (!token) {
      console.error("Bot token not found in configuration");
      return;
    }
    
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    UrlFetchApp.fetch(url, options);
    
  } catch (error) {
    console.error("Error replying message:", error);
  }
}

// ==================== เรียกใช้ Loading Indicator ====================
function startLoadingAnimation(chatId, token) {
  try {
    if (!chatId || !token) return;
    
    const url = "https://api.line.me/v2/bot/chat/loading/start";
    const payload = {
      chatId: chatId,
      loadingSeconds: 5
    };
    
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    UrlFetchApp.fetch(url, options);
  } catch (error) {
    console.error("Error starting loading animation:", error);
  }
}

// ==================== Reply Text Message ====================
function replyTextMessage(replyToken, text) {
  if (!replyToken) return;
  
  const message = {
    type: "text",
    text: text
  };
  
  replyMessage(replyToken, message);
}

// ==================== ส่งข้อความไปยัง User โดยตรง ====================
function sendMessageToUser(userId, message) {
  try {
    const token = currentBotToken || getMainBot()?.token;
    if (!token) {
      console.error("Bot token not found");
      return;
    }
    
    pushMessage(token, userId, message);
    
  } catch (error) {
    console.error("Error sending message to user:", error);
  }
}

// ==================== ดึงข้อมูลโปรไฟล์บอท ====================
function getBotProfile(channelToken) {
  try {
    const url = "https://api.line.me/v2/bot/info";
    const options = {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + channelToken
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      console.error("Bot info API error:", response.getContentText());
      return null;
    }
    
    const data = JSON.parse(response.getContentText());
    
    return {
      displayName: data.displayName || "Unknown Bot",
      userId: data.userId || "",
      pictureUrl: data.pictureUrl || ""
    };
  } catch (error) {
    console.error("Error getting bot profile:", error);
    return null;
  }
}

// ==================== สร้าง Flex Message ทั้งหมด ====================
const UI = {
  ink: "#0F172A",
  muted: "#475569",
  subtle: "#64748B",
  line: "#E2E8F0",
  panel: "#FFFFFF",
  canvas: "#F8FAFC",
  dark: "#0F172A",
  primary: "#4F46E5",
  accent: "#0EA5E9",
  warning: "#D97706",
  danger: "#E11D48",
  success: "#10B981"
};

function uiHeader(kicker, title, accentColor) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: UI.dark,
    paddingAll: "20px",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: kicker,
        weight: "bold",
        size: "xxs",
        color: accentColor || UI.primary
      },
      {
        type: "text",
        text: title,
        weight: "bold",
        size: "xl",
        color: "#FFFFFF",
        wrap: true
      }
    ]
  };
}

function uiStatCard(label, value, valueColor) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: UI.panel,
    borderColor: UI.line,
    borderWidth: "1px",
    cornerRadius: "8px",
    paddingAll: "12px",
    flex: 1,
    contents: [
      { type: "text", text: label, size: "xxs", color: UI.muted, align: "center", weight: "bold" },
      { type: "text", text: value, size: "md", weight: "bold", color: valueColor || UI.ink, align: "center", margin: "xs" }
    ]
  };
}

function createMainMenuFlexMessage() {
  const features = [
    ["Push", "ส่งข้อความแบบเจาะจงผู้รับ", UI.primary],
    ["Broadcast", "กระจายข้อความด้วยบอทที่เลือก", UI.accent],
    ["Quota", "ดูสถานะการใช้งานรายเดือน", UI.warning],
    ["Bots", "เพิ่ม แก้ไข และดูแลหลายบอท", UI.success]
  ].map(item => ({
    type: "box",
    layout: "horizontal",
    backgroundColor: UI.panel,
    borderColor: UI.line,
    borderWidth: "1px",
    cornerRadius: "8px",
    paddingAll: "12px",
    margin: "sm",
    contents: [
      {
        type: "text",
        text: "┃",
        size: "lg",
        color: item[2],
        flex: 0,
        gravity: "center"
      },
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        margin: "md",
        contents: [
          { type: "text", text: item[0], size: "sm", weight: "bold", color: UI.ink },
          { type: "text", text: item[1], size: "xxs", color: UI.muted, wrap: true, margin: "xs" }
        ]
      }
    ]
  }));

  return {
    type: "flex",
    altText: "LINE Bot Manager - เมนูหลัก",
    contents: {
      type: "bubble",
      size: "mega",
      header: uiHeader("ENTERPRISE BOT OPERATIONS", "LINE Bot Manager", UI.primary),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        paddingAll: "20px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "ศูนย์ควบคุมและบริหารจัดการระบบบอทสำหรับองค์กร เพื่อความรวดเร็วและความถูกต้องในการสื่อสาร",
            size: "sm",
            color: UI.muted,
            wrap: true
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              uiStatCard("SYSTEM MODE", "LIVE", UI.success),
              uiStatCard("CONNECTION", "READY", UI.accent)
            ]
          },
          {
            type: "box",
            layout: "vertical",
            contents: features
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.panel,
        borderColor: UI.line,
        borderWidth: "1px",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            action: { type: "message", label: "เปิดแผงควบคุม", text: "/start" },
            style: "primary",
            color: UI.primary
          }
        ]
      }
    }
  };
}

function createWelcomeFlexMessage() {
  return {
    type: "flex",
    altText: "ยินดีต้อนรับสู่ LINE Bot Management System",
    contents: {
      type: "bubble",
      header: uiHeader("SYSTEM PORTAL", "LINE Bot Manager", UI.accent),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "ระบบบริหารจัดการบอทระดับองค์กร",
            weight: "bold",
            size: "md",
            color: UI.ink,
            align: "center"
          },
          {
            type: "text",
            text: "ควบคุมและจัดการระบบบอททั้งหมดของคุณจากศูนย์กลางเดียว",
            size: "xs",
            color: UI.muted,
            align: "center"
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "14px",
            margin: "md",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "คุณสมบัติเด่นของระบบ",
                weight: "bold",
                size: "xs",
                color: UI.accent
              },
              {
                type: "text",
                text: "• ส่ง Push และ Broadcast แบบเรียลไทม์\n• ตรวจสอบสถานะการใช้งานโควต้าบอท\n• บันทึกประวัติและสถานะการส่งข้อมูล\n• ควบคุมและสลับการทำงานระหว่างบอทตัวแทน",
                size: "xs",
                color: UI.ink,
                wrap: true,
                lineSpacing: "3px"
              }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            contents: [
              {
                type: "text",
                text: "┃",
                size: "md",
                color: UI.warning,
                flex: 0,
                gravity: "center"
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                margin: "md",
                contents: [
                  {
                    type: "text",
                    text: "คำแนะนำการใช้งาน",
                    weight: "bold",
                    size: "xs",
                    color: UI.ink
                  },
                  {
                    type: "text",
                    text: "พิมพ์ข้อความ /start เพื่อเรียกใช้งานแผงควบคุมระบบ",
                    size: "xxs",
                    color: UI.muted,
                    margin: "xs",
                    wrap: true
                  }
                ]
              }
            ]
          }
        ],
        paddingAll: "20px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.dark,
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "เริ่มต้นใช้งานระบบ",
              text: "/start"
            },
            style: "primary",
            color: UI.primary
          }
        ],
        paddingAll: "20px"
      }
    }
  };
}

function createBotManagementFlexMessage(mainBot, otherBots) {
  let botList = [];
  
  if (mainBot) {
    botList.push({
      type: "box",
      layout: "horizontal",
      backgroundColor: UI.panel,
      borderColor: UI.line,
      borderWidth: "1px",
      cornerRadius: "8px",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: "┃",
          size: "md",
          color: UI.success,
          flex: 0,
          gravity: "center"
        },
        {
          type: "text",
          text: mainBot.name,
          size: "sm",
          color: UI.ink,
          weight: "bold",
          flex: 5,
          margin: "md",
          gravity: "center"
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: UI.success,
          cornerRadius: "4px",
          paddingAll: "4px",
          paddingStart: "8px",
          paddingEnd: "8px",
          flex: 2,
          contents: [
            {
              type: "text",
              text: "MAIN",
              size: "xxs",
              color: "#FFFFFF",
              align: "center",
              weight: "bold",
              gravity: "center"
            }
          ]
        }
      ]
    });
  }
  
  if (otherBots.length > 0) {
    otherBots.forEach((bot, index) => {
      botList.push({
        type: "box",
        layout: "horizontal",
        backgroundColor: UI.panel,
        borderColor: UI.line,
        borderWidth: "1px",
        cornerRadius: "8px",
        paddingAll: "12px",
        margin: "sm",
        contents: [
          {
            type: "text",
            text: "┃",
            size: "md",
            color: UI.accent,
            flex: 0,
            gravity: "center"
          },
          {
            type: "text",
            text: bot.name,
            size: "sm",
            color: UI.ink,
            flex: 5,
            margin: "md",
            gravity: "center"
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.accent,
            cornerRadius: "4px",
            paddingAll: "4px",
            paddingStart: "8px",
            paddingEnd: "8px",
            flex: 2,
            contents: [
              {
                type: "text",
                text: "AGENT",
                size: "xxs",
                color: "#FFFFFF",
                align: "center",
                weight: "bold",
                gravity: "center"
              }
            ]
          }
        ]
      });
    });
  }
  
  let actionButtons = [];
  
  actionButtons.push({
    type: "button",
    action: {
      type: "message",
      label: "ลงทะเบียนบอทใหม่",
      text: "เพิ่มบอท"
    },
    style: "primary",
    color: UI.success,
    margin: "sm"
  });
  
  if (otherBots.length > 0) {
    actionButtons.push({
      type: "button",
      action: {
        type: "message",
        label: "ลบข้อมูลบอท",
        text: "ลบบอท"
      },
      style: "secondary",
      color: UI.danger,
      margin: "sm"
    });
    
    actionButtons.push({
      type: "button",
      action: {
        type: "message",
        label: "ปรับปรุงโทเค็นบอท",
        text: "แก้ไขบอท"
      },
      style: "secondary",
      color: UI.warning,
      margin: "sm"
    });
  }
  
  actionButtons.push({
    type: "button",
    action: {
      type: "message",
      label: "กลับหน้าเมนูหลัก",
      text: "/start"
    },
    style: "link",
    color: UI.muted,
    margin: "sm"
  });
  
  return {
    type: "flex",
    altText: "การบริหารจัดการบอทตัวแทน",
    contents: {
      type: "bubble",
      header: uiHeader("ORCHESTRATION PANEL", "การจัดการระบบบอท", UI.accent),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `บอทที่ลงทะเบียนไว้ (${(mainBot ? 1 : 0) + otherBots.length} ตัว)`,
            weight: "bold",
            size: "sm",
            color: UI.muted
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: botList
          }
        ],
        paddingAll: "20px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.dark,
        contents: actionButtons,
        paddingAll: "20px"
      }
    }
  };
}

function createBotAddedFlexMessage(botName, botId) {
  return {
    type: "flex",
    altText: `ลงทะเบียนบอท ${botName} สำเร็จแล้ว`,
    contents: {
      type: "bubble",
      header: uiHeader("CONNECTION ESTABLISHED", "ลงทะเบียนบอทสำเร็จ", UI.success),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "16px",
            contents: [
              {
                type: "text",
                text: "รายละเอียดระบบ",
                size: "xs",
                color: UI.primary,
                weight: "bold"
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                contents: [
                  { type: "text", text: "ชื่อบอท", size: "xs", color: UI.muted, flex: 2 },
                  { type: "text", text: botName, size: "xs", color: UI.ink, weight: "bold", flex: 3, align: "end" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  { type: "text", text: "รหัสผู้ใช้ (User ID)", size: "xs", color: UI.muted, flex: 2 },
                  { type: "text", text: botId || "ไม่ระบุ", size: "xs", color: UI.ink, flex: 3, align: "end", wrap: true }
                ]
              }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            contents: [
              {
                type: "text",
                text: "สถานะการเชื่อมต่อ",
                size: "xs",
                color: UI.muted,
                gravity: "center"
              },
              {
                type: "text",
                text: "ONLINE",
                size: "xs",
                color: UI.success,
                weight: "bold",
                align: "end",
                gravity: "center"
              }
            ]
          }
        ],
        paddingAll: "20px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.dark,
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "กลับไปที่แผงควบคุม",
              text: "จัดการบอท"
            },
            style: "primary",
            color: UI.success
          }
        ],
        paddingAll: "20px"
      }
    }
  };
}

function createQuotaFlexMessage(bot, data) {
  const total = data.total || 300;
  const used = data.used || 0;
  const remaining = Math.max(0, total - used);
  const percentUsed = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  
  // กำหนดสีตามเปอร์เซ็นต์การใช้งาน
  let themeColor, statusText;
  if (percentUsed >= 90) {
    themeColor = UI.danger; // แดงสด (โควต้าหมด/ใกล้หมดมาก)
    statusText = "โควต้าการใช้งานอยู่ในระดับวิกฤต";
  } else if (percentUsed >= 70) {
    themeColor = UI.warning; // เหลืองทอง (เตือน)
    statusText = "โควต้าการใช้งานต่ำกว่าเกณฑ์";
  } else {
    themeColor = UI.success; // เขียวมรกต (ปกติ)
    statusText = "สถานะโควต้าการใช้งานปกติ";
  }
  
  return {
    type: "flex",
    altText: `รายงานการใช้งานโควต้า - ${bot.name}`,
    contents: {
      type: "bubble",
      header: uiHeader("SYSTEM REPORT", `ปริมาณการใช้งานโควต้า: ${bot.name}`, UI.accent),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        spacing: "md",
        contents: [
          // ส่วนเปอร์เซ็นต์
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "ปริมาณการส่งประจำเดือน",
                size: "xs",
                color: UI.muted,
                gravity: "center"
              },
              {
                type: "text",
                text: `${percentUsed}%`,
                size: "sm",
                weight: "bold",
                color: themeColor,
                align: "end"
              }
            ]
          },
          // แถบหลอดแก้วความคืบหน้า
          {
            type: "box",
            layout: "horizontal",
            height: "12px",
            backgroundColor: UI.line,
            cornerRadius: "6px",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: themeColor,
                width: `${percentUsed}%`,
                cornerRadius: "6px",
                contents: [{ type: "filler" }]
              },
              {
                type: "box",
                layout: "vertical",
                backgroundColor: UI.line,
                width: `${100 - percentUsed}%`,
                cornerRadius: "6px",
                contents: [{ type: "filler" }]
              }
            ]
          },
          {
            type: "text",
            text: `ใช้งานไปแล้ว ${percentUsed}%`,
            size: "xxs",
            color: UI.muted,
            align: "end"
          },
          {
            type: "separator",
            color: UI.line,
            margin: "sm"
          },
          // แถวที่ 1: การจำแนกค่าแบบคู่ (ใช้ไป / คงเหลือ)
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: UI.panel,
                borderColor: UI.line,
                borderWidth: "1px",
                cornerRadius: "8px",
                paddingAll: "10px",
                flex: 1,
                contents: [
                  {
                    type: "text",
                    text: "ปริมาณที่ใช้ไป",
                    size: "xxs",
                    color: UI.muted,
                    align: "center"
                  },
                  {
                    type: "text",
                    text: `${used.toLocaleString()}`,
                    size: "md",
                    weight: "bold",
                    color: UI.ink,
                    align: "center",
                    margin: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                backgroundColor: UI.panel,
                borderColor: UI.line,
                borderWidth: "1px",
                cornerRadius: "8px",
                paddingAll: "10px",
                flex: 1,
                contents: [
                  {
                    type: "text",
                    text: "คงเหลือ",
                    size: "xxs",
                    color: UI.muted,
                    align: "center"
                  },
                  {
                    type: "text",
                    text: `${remaining.toLocaleString()}`,
                    size: "md",
                    weight: "bold",
                    color: themeColor,
                    align: "center",
                    margin: "xs"
                  }
                ]
              }
            ]
          },
          // แถวที่ 2: โควต้าทั้งหมด
          {
            type: "box",
            layout: "horizontal",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "10px",
            contents: [
              {
                type: "text",
                text: "โควต้าสูงสุดต่อเดือน",
                size: "xs",
                color: UI.muted,
                gravity: "center"
              },
              {
                type: "text",
                text: `${total.toLocaleString()} ข้อความ`,
                size: "sm",
                weight: "bold",
                color: UI.ink,
                align: "end",
                gravity: "center"
              }
            ]
          }
        ],
        paddingAll: "16px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.dark,
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: statusText,
            size: "xs",
            color: themeColor,
            weight: "bold",
            align: "center"
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "กลับหน้าเมนูหลัก",
              text: "/start"
            },
            style: "link",
            color: UI.muted,
            margin: "sm"
          }
        ],
        paddingAll: "12px"
      }
    }
  };
}

function createHistoryFlexMessage(botName, recent, totalCount) {
  const rows = [];
  recent.forEach((item, index) => {
    const isSuccess = String(item.status).toLowerCase() === "success";
    const preview = item.content.length > 35 ? item.content.substring(0, 35) + "..." : item.content;
    const indicatorColor = isSuccess ? UI.success : UI.danger;
    
    rows.push({
      type: "box",
      layout: "horizontal",
      backgroundColor: UI.panel,
      borderColor: UI.line,
      borderWidth: "1px",
      cornerRadius: "8px",
      paddingAll: "12px",
      margin: index > 0 ? "sm" : "none",
      contents: [
        {
          type: "text",
          text: "┃",
          size: "md",
          color: indicatorColor,
          flex: 0,
          gravity: "center"
        },
        {
          type: "box",
          layout: "vertical",
          flex: 1,
          margin: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: item.action, size: "xs", weight: "bold", color: UI.ink, flex: 3 },
                { type: "text", text: isSuccess ? "SUCCESS" : "FAILED", size: "xxs", color: indicatorColor, weight: "bold", flex: 1, align: "end" }
              ]
            },
            { type: "text", text: `${item.type || "system"} • ${item.time}`, size: "xxs", color: UI.muted, margin: "xs" },
            { type: "text", text: preview, size: "xs", color: UI.ink, margin: "xs", wrap: true }
          ]
        }
      ]
    });
  });
  
  const footerContents = [];
  if (totalCount > recent.length) {
    footerContents.push({
      type: "text",
      text: `แสดง ${recent.length} จากทั้งหมด ${totalCount} รายการล่าสุด`,
      size: "xxs",
      color: UI.muted,
      align: "center",
      margin: "none"
    });
  }
  
  footerContents.push({
    type: "button",
    action: { type: "message", label: "กลับหน้าเมนูหลัก", text: "/start" },
    style: "primary",
    color: UI.accent,
    margin: "sm"
  });
  
  return {
    type: "flex",
    altText: `ประวัติการทำรายการ (${botName})`,
    contents: {
      type: "bubble",
      header: uiHeader("TRANSACTION LOGS", `ประวัติการส่ง: ${botName}`, UI.accent),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        spacing: "xs",
        contents: rows.length > 0 ? rows : [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "20px",
            contents: [
              { type: "text", text: "ไม่มีประวัติการส่งข้อมูลในระบบ", size: "sm", color: UI.muted, align: "center" }
            ]
          }
        ],
        paddingAll: "20px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.dark,
        contents: footerContents,
        paddingAll: "20px"
      }
    }
  };
}

function createHelpFlexMessage() {
  return {
    type: "flex",
    altText: "คู่มือการใช้งานระบบ LINE Bot Manager",
    contents: {
      type: "bubble",
      header: uiHeader("DOCUMENTATION", "คู่มือการใช้งานระบบ", UI.accent),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            spacing: "xs",
            contents: [
              { type: "text", text: "คำสั่งพื้นฐาน (Commands)", weight: "bold", size: "sm", color: UI.accent },
              { type: "text", text: "• พิมพ์ /start หรือ เริ่มต้น : แสดงหน้าเมนูหลัก\n• พิมพ์ กลับ : ย้อนกลับไปเมนูก่อนหน้า", size: "xs", color: UI.ink, wrap: true, lineSpacing: "3px" }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            spacing: "xs",
            contents: [
              { type: "text", text: "การส่งข้อความ (Message Dispatching)", weight: "bold", size: "sm", color: UI.accent },
              { type: "text", text: "1. เลือก \"ส่ง Push\" หรือ \"ส่ง Broadcast\"\n2. เลือกบอทและเลือกประเภทข้อความ\n3. กรอกข้อมูลตามโครงสร้างที่ระบบแสดงแนะนำ", size: "xs", color: UI.ink, wrap: true, lineSpacing: "3px" }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            spacing: "xs",
            contents: [
              { type: "text", text: "การตรวจสอบสถานะและประวัติการส่ง", weight: "bold", size: "sm", color: UI.accent },
              { type: "text", text: "เลือกบอทที่ต้องการดูจากเมนู เพื่อดึงข้อมูลโควต้าแบบเรียลไทม์ และรายงานสถิติการใช้งานย้อนหลัง", size: "xs", color: UI.ink, wrap: true, lineSpacing: "3px" }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            spacing: "xs",
            contents: [
              { type: "text", text: "ระบบการจัดการบอท (Bot Management)", weight: "bold", size: "sm", color: UI.accent },
              { type: "text", text: "• เพิ่มบอท: ส่ง LINE Channel Access Token เพื่อลงทะเบียนบอทตัวใหม่เข้าระบบ\n• แก้ไขบอท: เปลี่ยน Token เดิมที่ลงทะเบียนไว้\n• ลบบอท: ตัดการเชื่อมต่อของบอทออกจากระบบ", size: "xs", color: UI.ink, wrap: true, lineSpacing: "3px" }
            ]
          }
        ],
        paddingAll: "20px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.dark,
        contents: [
          { type: "button", action: { type: "message", label: "เข้าสู่หน้าเมนูหลัก", text: "/start" }, style: "primary", color: UI.success }
        ],
        paddingAll: "20px"
      }
    }
  };
}

function createSendResultFlexMessage(actionType, botName, messageType, response) {
  const success = !!(response && response.status === "success");
  const color = success ? UI.success : UI.danger;
  const title = success ? "การส่งข้อความสำเร็จ" : "การส่งข้อความล้มเหลว";
  
  const bodyContents = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ผู้ส่งข้อความ (Sender)", size: "sm", color: UI.muted, flex: 2 },
        { type: "text", text: botName, size: "sm", color: UI.ink, weight: "bold", flex: 3, align: "end", wrap: true }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: "รูปแบบการส่ง (Method)", size: "sm", color: UI.muted, flex: 2 },
        { type: "text", text: `${actionType} (${messageType})`, size: "sm", color: UI.ink, flex: 3, align: "end", wrap: true }
      ]
    }
  ];
  
  if (!success && response?.message) {
    bodyContents.push({ type: "separator", color: UI.line, margin: "md" });
    bodyContents.push({
      type: "text",
      text: response.message.substring(0, 200),
      size: "xs",
      color: UI.danger,
      margin: "md",
      wrap: true
    });
  }
  
  return {
    type: "flex",
    altText: `ผลการส่งข้อความ: ${title} (${botName})`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: uiHeader("TRANSMISSION REPORT", title, color),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: UI.canvas,
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: UI.panel,
            borderColor: UI.line,
            borderWidth: "1px",
            cornerRadius: "8px",
            paddingAll: "12px",
            contents: bodyContents
          }
        ]
      }
    }
  };
}
// ==================== จัดการบอท (ปรับปรุงใหม่ทั้งหมด) ====================
function showBotManagement(userId, replyToken) {
  const mainBot = getMainBot();
  const otherBots = getBotConfigsFromSheet();
  
  const flexMessage = createBotManagementFlexMessage(mainBot, otherBots);
  replyMessage(replyToken, flexMessage);
  setUserState(userId, "bot_management:main");
  console.log(`showBotManagement - User: ${userId}, State set to: bot_management:main`);
}

function handleBotManagementAction(userId, message, state, replyToken) {
  console.log(`handleBotManagementAction - User: ${userId}, Message: "${message}", State: "${state}"`);
  
  // ตรวจสอบคำสั่งพิเศษก่อน
  if (message === "/start") {
    showMainMenu(userId, replyToken);
    return;
  }
  
  if (message === "กลับ" || message === "จัดการบอท") {
    showBotManagement(userId, replyToken);
    return;
  }
  
  // จัดการตาม state
  if (state.startsWith("bot_management:edit_token:")) {
    saveEditBot(userId, message, state, replyToken);
    return;
  }
  
  switch(state) {
    case "bot_management:main":
      // อยู่ในหน้าเมนูจัดการบอทหลัก
      if (message === "เพิ่มบอท") {
        replyTextMessage(replyToken, "📝 กรุณาส่ง Channel Access Token ของบอทที่ต้องการเพิ่ม\n\n💡 วิธีรับ Token:\n1. ไปที่ LINE Developers Console\n2. เลือก Provider และ Channel\n3. ไปที่แท็บ Messaging API\n4. คลิก Issue Channel Access Token\n\n⚠️ ส่งเฉพาะ Token เท่านั้น");
        setUserState(userId, "bot_management:add_token");
        console.log(`State changed to: bot_management:add_token`);
      } else if (message === "ลบบอท") {
        showBotListForDeletion(userId, replyToken);
      } else if (message === "แก้ไขบอท") {
        showBotListForEdit(userId, replyToken);
      } else {
        replyTextMessage(replyToken, "❌ กรุณาเลือกจากเมนูจัดการบอท\n\n➕ เพิ่มบอท\n🗑️ ลบบอท\n📝 แก้ไขบอท");
        showBotManagement(userId, replyToken);
      }
      break;
      
    case "bot_management:add_token":
      // รอรับ Token สำหรับเพิ่มบอท
      addBot(userId, message, replyToken);
      break;
      
    case "bot_management:delete":
      // รอเลือกบอทที่จะลบ
      handleDeleteBotSelection(userId, message, replyToken);
      break;
      
    case "bot_management:edit":
      // รอเลือกบอทที่จะแก้ไข
      handleEditBotSelection(userId, message, replyToken);
      break;
      
    case "bot_management:edit_token":
      // รอรับ Token ใหม่สำหรับแก้ไขบอท
      saveEditBot(userId, message, state, replyToken);
      break;
      
    default:
      replyTextMessage(replyToken, "❌ สถานะไม่ถูกต้อง กรุณาเริ่มใหม่");
      showBotManagement(userId, replyToken);
  }
}

// ==================== แสดงรายการบอทเพื่อลบ ====================
function showBotListForDeletion(userId, replyToken) {
  const bots = getBotConfigsFromSheet();
  if (bots.length === 0) {
    replyTextMessage(replyToken, "❌ ไม่มีบอทให้ลบ\n(Main Bot ไม่สามารถลบผ่านเมนูนี้ได้)");
    showBotManagement(userId, replyToken);
    return;
  }
  
  const items = bots.map(bot => ({
    type: "action",
    action: {
      type: "message",
      label: `🗑️ ${bot.name}`,
      text: `ลบบอท:${bot.name}`
    }
  }));
  
  items.push({
    type: "action",
    action: {
      type: "message",
      label: "🔙 กลับ",
      text: "กลับ"
    }
  });
  
  // แบ่งเป็นกลุ่มละ 13 ปุ่ม (maximum quick reply buttons)
  const chunkedItems = chunkArray(items, 13);
  
  chunkedItems.forEach((chunk, index) => {
    if (index === 0) {
      const quickReply = {
        type: "text",
        text: `🗑️ เลือกบอทที่ต้องการลบ (มี ${bots.length} บอท):\n\n⚠️ Main Bot ไม่สามารถลบได้`,
        quickReply: {
          items: chunk
        }
      };
      replyMessage(replyToken, quickReply);
    } else {
      // ถ้ามีมากกว่า 13 ปุ่ม ส่งเพิ่มเติมผ่าน push
      sendMessageToUser(userId, {
        type: "text",
        text: "🗑️ เลือกบอทที่ต้องการลบ (ต่อ):",
        quickReply: {
          items: chunk
        }
      });
    }
  });
  
  setUserState(userId, "bot_management:delete");
  console.log(`State set to: bot_management:delete`);
}

// ==================== จัดการการเลือกลบบอท ====================
function handleDeleteBotSelection(userId, message, replyToken) {
  // ตรวจสอบรูปแบบข้อความ
  if (message.startsWith("ลบบอท:")) {
    const botName = message.substring("ลบบอท:".length);
    deleteBot(userId, botName, replyToken);
  } else {
    replyTextMessage(replyToken, "❌ กรุณาเลือกบอทจากปุ่มที่แสดง");
  }
}

// ==================== แสดงรายการบอทเพื่อแก้ไข ====================
function showBotListForEdit(userId, replyToken) {
  const bots = getBotConfigsFromSheet();
  if (bots.length === 0) {
    replyTextMessage(replyToken, "❌ ไม่มีบอทให้แก้ไข\n(Main Bot แก้ไขผ่านโค้ดเท่านั้น)");
    showBotManagement(userId, replyToken);
    return;
  }
  
  const items = bots.map(bot => ({
    type: "action",
    action: {
      type: "message",
      label: `📝 ${bot.name}`,
      text: `แก้ไขบอท:${bot.name}`
    }
  }));
  
  items.push({
    type: "action",
    action: {
      type: "message",
      label: "🔙 กลับ",
      text: "กลับ"
    }
  });
  
  // แบ่งเป็นกลุ่มละ 13 ปุ่ม
  const chunkedItems = chunkArray(items, 13);
  
  chunkedItems.forEach((chunk, index) => {
    if (index === 0) {
      const quickReply = {
        type: "text",
        text: `📝 เลือกบอทที่ต้องการแก้ไข (มี ${bots.length} บอท):\n\n⚠️ Main Bot แก้ไขผ่านโค้ดเท่านั้น`,
        quickReply: {
          items: chunk
        }
      };
      replyMessage(replyToken, quickReply);
    } else {
      sendMessageToUser(userId, {
        type: "text",
        text: "📝 เลือกบอทที่ต้องการแก้ไข (ต่อ):",
        quickReply: {
          items: chunk
        }
      });
    }
  });
  
  setUserState(userId, "bot_management:edit");
  console.log(`State set to: bot_management:edit`);
}

// ==================== จัดการการเลือกแก้ไขบอท ====================
function handleEditBotSelection(userId, message, replyToken) {
  if (message.startsWith("แก้ไขบอท:")) {
    const botName = message.substring("แก้ไขบอท:".length);
    editBot(userId, botName, replyToken);
  } else {
    replyTextMessage(replyToken, "❌ กรุณาเลือกบอทจากปุ่มที่แสดง");
  }
}

// ==================== เพิ่มบอท ====================
function addBot(userId, token, replyToken) {
  try {
    const token_trim = token.trim();
    
    if (!token_trim) {
      replyTextMessage(replyToken, "❌ กรุณาส่ง Channel Access Token");
      return;
    }
    
    // ตรวจสอบว่า token ดูเหมือน Channel Access Token
    if (token_trim.length < 50) {
      replyTextMessage(replyToken, "⚠️ Token ดูสั้นเกินไป\nChannel Access Token มักจะมีความยาวมากกว่า 50 ตัวอักษร\n\nกรุณาตรวจสอบและส่งใหม่");
      return;
    }
    
    // ทดสอบ token โดยดึงข้อมูลบอท
    const botProfile = getBotProfile(token_trim);
    if (!botProfile) {
      replyTextMessage(replyToken, "❌ Token ไม่ถูกต้อง หรือไม่สามารถเชื่อมต่อได้\n\n💡 วิธีรับ Token:\n1. ไปที่ LINE Developers Console\n2. เลือก Provider และ Channel\n3. ไปที่แท็บ Messaging API\n4. คลิก Issue Channel Access Token\n\n⚠️ ตรวจสอบว่า Token ยังไม่หมดอายุ");
      return;
    }
    
    const botName = botProfile.displayName;
    
    // ตรวจสอบว่ามีบอทชื่อนี้อยู่แล้วหรือไม่
    const existingBots = getAllBots();
    if (existingBots.find(b => b.name === botName)) {
      replyTextMessage(replyToken, `❌ มีบอทชื่อ "${botName}" อยู่แล้ว\n\nหากต้องการเปลี่ยน Token ให้ใช้เมนู "แก้ไขบอท" แทน`);
      showBotManagement(userId, replyToken);
      return;
    }
    
    // เตรียม Sheet
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) {
      createConfigSheet();
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    }
    
    // เพิ่มข้อมูลบอทใหม่
    const newRow = [
      botName, 
      token_trim, 
      false, 
      `เพิ่มเมื่อ ${new Date().toLocaleString('th-TH')}`,
      botProfile.userId || ""
    ];
    sheet.appendRow(newRow);
    
    // ส่งข้อความยืนยัน
    const successFlex = createBotAddedFlexMessage(botName, botProfile.userId);
    replyMessage(replyToken, successFlex);
    
    // บันทึกประวัติ
    saveHistory({
      botName: botName,
      actionType: "เพิ่มบอท",
      content: `เพิ่มบอท "${botName}" สำเร็จ`,
      userId: userId,
      timestamp: new Date().toISOString()
    });
    
    // กลับไปหน้าเมนูจัดการบอท
    showBotManagement(userId, null);
    
    console.log(`Bot added successfully: ${botName}`);
    
  } catch (error) {
    console.error("Error adding bot:", error);
    replyTextMessage(replyToken, `❌ เกิดข้อผิดพลาด: ${error.message}\n\nกรุณาลองใหม่อีกครั้ง`);
    showBotManagement(userId, replyToken);
  }
}

// ==================== ลบบอท ====================
function deleteBot(userId, botName, replyToken) {
  try {
    if (!botName) {
      replyTextMessage(replyToken, "❌ ไม่พบชื่อบอทที่ต้องการลบ");
      showBotManagement(userId, replyToken);
      return;
    }
    
    // ตรวจสอบว่าไม่ใช่ Main Bot
    if (botName === MAIN_BOT_CONFIG.name) {
      replyTextMessage(replyToken, `❌ ไม่สามารถลบ "${botName}" ได้\nเพราะเป็น Main Bot ที่กำหนดในโค้ด`);
      showBotManagement(userId, replyToken);
      return;
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) {
      replyTextMessage(replyToken, "❌ ไม่พบ Sheet Config");
      showBotManagement(userId, replyToken);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    let deletedBotName = "";
    
    // ค้นหาและลบบอท
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === botName) {
        deletedBotName = data[i][0];
        sheet.deleteRow(i + 1);
        found = true;
        break;
      }
    }
    
    if (found) {
      replyTextMessage(replyToken, `✅ ลบบอท "${deletedBotName}" เรียบร้อยแล้ว`);
      
      // บันทึกประวัติ
      saveHistory({
        botName: deletedBotName,
        actionType: "ลบบอท",
        content: `ลบบอท "${deletedBotName}" สำเร็จ`,
        userId: userId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Bot deleted: ${deletedBotName}`);
    } else {
      replyTextMessage(replyToken, `❌ ไม่พบบอทชื่อ "${botName}" ในระบบ`);
    }
    
    // กลับไปหน้าเมนูจัดการบอท
    showBotManagement(userId, replyToken);
    
  } catch (error) {
    console.error("Error deleting bot:", error);
    replyTextMessage(replyToken, `❌ เกิดข้อผิดพลาด: ${error.message}`);
    showBotManagement(userId, replyToken);
  }
}

// ==================== แก้ไขบอท ====================
function editBot(userId, botName, replyToken) {
  try {
    if (!botName) {
      replyTextMessage(replyToken, "❌ ไม่พบชื่อบอทที่ต้องการแก้ไข");
      showBotManagement(userId, replyToken);
      return;
    }
    
    // ตรวจสอบว่าไม่ใช่ Main Bot
    if (botName === MAIN_BOT_CONFIG.name) {
      replyTextMessage(replyToken, `❌ ไม่สามารถแก้ไข "${botName}" ผ่านเมนูนี้ได้\nเพราะเป็น Main Bot ที่กำหนดในโค้ด\n\nหากต้องการเปลี่ยน Token ของ Main Bot ให้แก้ไขโดยตรงในโค้ด`);
      showBotManagement(userId, replyToken);
      return;
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) {
      replyTextMessage(replyToken, "❌ ไม่พบ Sheet Config");
      showBotManagement(userId, replyToken);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    let rowNum = -1;
    let oldToken = "";
    
    // ค้นหาบอท
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === botName) {
        rowNum = i + 1;
        oldToken = String(data[i][1]);
        found = true;
        break;
      }
    }
    
    if (!found) {
      replyTextMessage(replyToken, `❌ ไม่พบบอทชื่อ "${botName}" ในระบบ`);
      showBotManagement(userId, replyToken);
      return;
    }
    
    // เปลี่ยน state เพื่อรอรับ token ใหม่
    const editState = `bot_management:edit_token:${rowNum}:${botName}`;
    setUserState(userId, editState);
    console.log(`State set to: ${editState}`);
    
    replyTextMessage(replyToken, `📝 แก้ไข Token สำหรับบอท "${botName}"\n\nกรุณาส่ง Channel Access Token ใหม่\n\n🔑 Token เดิม: ${oldToken.substring(0, 15)}...\n\n⚠️ ส่งเฉพาะ Token ใหม่เท่านั้น`);
    
  } catch (error) {
    console.error("Error preparing edit bot:", error);
    replyTextMessage(replyToken, `❌ เกิดข้อผิดพลาด: ${error.message}`);
    showBotManagement(userId, replyToken);
  }
}

// ==================== บันทึกการแก้ไขบอท ====================
function saveEditBot(userId, token, state, replyToken) {
  try {
    // แยกข้อมูลจาก state
    // state คือ: bot_management:edit_token:${rowNum}:${botName}
    const parts = state.split(":");
    const rowNum = parseInt(parts[2]);
    const oldBotName = parts[3];
    
    const token_trim = token.trim();
    
    if (!token_trim) {
      replyTextMessage(replyToken, "❌ กรุณาส่ง Channel Access Token");
      return;
    }
    
    if (token_trim.length < 50) {
      replyTextMessage(replyToken, "⚠️ Token ดูสั้นเกินไป\nChannel Access Token มักจะมีความยาวมากกว่า 50 ตัวอักษร\n\nกรุณาตรวจสอบและส่งใหม่");
      return;
    }
    
    // ทดสอบ token ใหม่
    const botProfile = getBotProfile(token_trim);
    if (!botProfile) {
      replyTextMessage(replyToken, "❌ Token ไม่ถูกต้อง หรือไม่สามารถเชื่อมต่อได้\n\nกรุณาตรวจสอบ Token และลองใหม่");
      return;
    }
    
    const newBotName = botProfile.displayName;
    
    // ตรวจสอบชื่อซ้ำ (ยกเว้นชื่อเดิม)
    if (newBotName !== oldBotName) {
      const existingBots = getAllBots();
      if (existingBots.find(b => b.name === newBotName && b.name !== oldBotName)) {
        replyTextMessage(replyToken, `❌ มีบอทชื่อ "${newBotName}" อยู่แล้ว\nกรุณาลบบอทเดิมก่อน แล้วค่อยเพิ่มใหม่`);
        showBotManagement(userId, replyToken);
        return;
      }
    }
    
    // อัพเดทข้อมูลใน Sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) {
      replyTextMessage(replyToken, "❌ ไม่พบ Sheet Config");
      showBotManagement(userId, replyToken);
      return;
    }
    
    sheet.getRange(rowNum, 1).setValue(newBotName);
    sheet.getRange(rowNum, 2).setValue(token_trim);
    sheet.getRange(rowNum, 5).setValue(botProfile.userId || "");
    
    replyTextMessage(replyToken, `✅ แก้ไขบอทสำเร็จ!\n\nบอท "${newBotName}" พร้อมใช้งานแล้ว`);
    
    // บันทึกประวัติ
    saveHistory({
      botName: newBotName,
      actionType: "แก้ไขบอท",
      content: `แก้ไขบอทจาก "${oldBotName}" เป็น "${newBotName}"`,
      userId: userId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Bot edited: ${oldBotName} -> ${newBotName}`);
    
    // กลับไปหน้าเมนูจัดการบอท
    showBotManagement(userId, replyToken);
    
  } catch (error) {
    console.error("Error saving edit bot:", error);
    replyTextMessage(replyToken, `❌ เกิดข้อผิดพลาด: ${error.message}`);
    showBotManagement(userId, replyToken);
  }
}

// ==================== ดึง Main Bot ====================
function getMainBot() {
  if (MAIN_BOT_CONFIG.token && MAIN_BOT_CONFIG.token !== "YOUR_MAIN_BOT_CHANNEL_ACCESS_TOKEN") {
    return MAIN_BOT_CONFIG;
  }
  
  console.error("Main bot token not configured in code");
  return null;
}

// ==================== ดึงข้อมูลบอททั้งหมด ====================
function getAllBots() {
  const bots = [];
  
  const mainBot = getMainBot();
  if (mainBot) {
    bots.push(mainBot);
  }
  
  const sheetBots = getBotConfigsFromSheet();
  for (const bot of sheetBots) {
    if (!bots.find(b => b.name === bot.name)) {
      bots.push(bot);
    }
  }
  
  return bots;
}

// ==================== ดึงค่ากำหนด Bot จาก Sheet ====================
function getBotConfigsFromSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) {
      createConfigSheet();
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return [];
    }
    
    const headers = data[0];
    const nameIndex = headers.indexOf("BotName");
    const tokenIndex = headers.indexOf("ChannelToken");
    const mainIndex = headers.indexOf("IsMainBot");
    const botIdIndex = headers.indexOf("BotId");
    
    const bots = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[nameIndex] && row[tokenIndex]) {
        const name = String(row[nameIndex]);
        // ข้าม Main Bot ที่อาจมีใน Sheet
        if (name === "Main Bot" || row[mainIndex] === true || String(row[mainIndex]).toUpperCase() === "TRUE") {
          continue;
        }
        bots.push({
          name: name,
          token: String(row[tokenIndex]),
          isMainBot: false,
          botId: row[botIdIndex] || ""
        });
      }
    }
    
    return bots;
    
  } catch (error) {
    console.error("Error getting bot configs from sheet:", error);
    return [];
  }
}

// ==================== ตรวจสอบโควต้า ====================
function checkQuota(userId, botName, replyToken) {
  try {
    const bot = getAllBots().find(b => b.name === botName);
    if (!bot) {
      const errorMsg = "❌ ไม่พบบอทนี้";
      if (replyToken) {
        replyTextMessage(replyToken, errorMsg);
      } else {
        sendMessageToUser(userId, { type: "text", text: errorMsg });
      }
      return;
    }
    
    const options = {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + bot.token
      },
      muteHttpExceptions: true
    };
    
    // ดึงข้อมูลการจำกัดโควต้า
    const responseLimit = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/quota", options);
    const limitData = JSON.parse(responseLimit.getContentText());
    let total = 0;
    if (limitData.type === "limit") {
      total = limitData.value || 0;
    } else {
      total = 300; // ค่าเริ่มต้นฟรีแอปสูงสุด 300 ข้อความ/เดือน
    }
    
    // ดึงข้อมูลจำนวนโควต้าที่ใช้ไปแล้ว
    const responseUsed = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/quota/consumption", options);
    const usedData = JSON.parse(responseUsed.getContentText());
    const used = usedData.totalUsage || 0;
    
    const remaining = Math.max(0, total - used);
    
    const quotaFlex = createQuotaFlexMessage(bot, { total, used, remaining });
    
    if (replyToken) {
      replyMessage(replyToken, quotaFlex);
    } else {
      sendMessageToUser(userId, quotaFlex);
    }
    
    saveHistory({
      botName: botName,
      actionType: "ตรวจสอบโควต้า",
      content: `Total: ${total}, Used: ${used}, Remaining: ${remaining}`,
      userId: userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error checking quota:", error);
    const errorMsg = `❌ ไม่สามารถตรวจสอบโควต้า: ${error.message}`;
    if (replyToken) {
      replyTextMessage(replyToken, errorMsg);
    } else {
      sendMessageToUser(userId, { type: "text", text: errorMsg });
    }
  }
}

// ==================== ดูประวัติ ====================
function showHistory(userId, botName, replyToken) {
  try {
    const sheet = getSheet();
    if (!sheet) {
      replyTextMessage(replyToken, "❌ ไม่พบ Sheet");
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      replyTextMessage(replyToken, "📜 ไม่มีประวัติการส่ง");
      return;
    }
    
    const headers = data[0];
    const botIndex = headers.indexOf("BotName");
    const timeIndex = headers.indexOf("Timestamp");
    const actionIndex = headers.indexOf("ActionType");
    const typeIndex = headers.indexOf("MessageType");
    const contentIndex = headers.indexOf("Content");
    const statusIndex = headers.indexOf("Status");
    
    let history = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (row[botIndex] === botName) {
        history.push({
          time: row[timeIndex],
          action: row[actionIndex],
          type: row[typeIndex],
          content: String(row[contentIndex] || ""),
          status: row[statusIndex]
        });
      }
    }
    
    if (history.length === 0) {
      replyTextMessage(replyToken, `📜 ไม่มีประวัติการส่งสำหรับบอท ${botName}`);
      return;
    }
    
    const recent = history.slice(0, 5);
    const historyFlex = createHistoryFlexMessage(botName, recent, history.length);
    replyMessage(replyToken, historyFlex);
    
  } catch (error) {
    console.error("Error showing history:", error);
    replyTextMessage(replyToken, `❌ ไม่สามารถแสดงประวัติ: ${error.message}`);
  }
}

// ==================== แสดง Help ====================
function showHelp(userId, replyToken) {
  const helpFlex = createHelpFlexMessage();
  replyMessage(replyToken, helpFlex);
}

// ==================== Follow Event ====================
function handleFollowEvent(userId, replyToken) {
  const welcomeFlex = createWelcomeFlexMessage();
  replyMessage(replyToken, welcomeFlex);
  
  saveHistory({
    botName: "System",
    actionType: "Follow",
    content: "User followed bot",
    userId: userId,
    timestamp: new Date().toISOString()
  });
}

// ==================== Unfollow Event ====================
function handleUnfollowEvent(userId) {
  console.log(`User ${userId} unfollowed bot`);
  
  saveHistory({
    botName: "System",
    actionType: "Unfollow",
    content: "User unfollowed bot",
    userId: userId,
    timestamp: new Date().toISOString()
  });
}

// ==================== Join Event ====================
function handleJoinEvent(event, userId, replyToken) {
  const groupId = event.source.groupId || event.source.roomId;
  replyTextMessage(replyToken, `👋 สวัสดีทุกคน!\n\n🤖 ฉันถูกเพิ่มเข้ามาในกลุ่มนี้แล้ว\nพิมพ์ "/start" เพื่อเริ่มใช้งาน`);
  
  saveHistory({
    botName: "System",
    actionType: "Join",
    content: `Bot joined group: ${groupId}`,
    userId: userId,
    timestamp: new Date().toISOString()
  });
}

// ==================== Leave Event ====================
function handleLeaveEvent(event, userId) {
  const groupId = event.source.groupId || event.source.roomId;
  console.log(`Bot left group: ${groupId}`);
  
  saveHistory({
    botName: "System",
    actionType: "Leave",
    content: `Bot left group: ${groupId}`,
    userId: userId,
    timestamp: new Date().toISOString()
  });
}

// ==================== บันทึกประวัติ ====================
function saveHistory(record) {
  try {
    const sheet = getSheet();
    if (!sheet) return;
    
    const row = [
      record.timestamp || new Date().toISOString(),
      record.botName || "",
      record.actionType || "",
      record.messageType || "",
      typeof record.content === "string" ? record.content : JSON.stringify(record.content),
      record.response?.status || "unknown",
      record.userId || "",
      record.targetId || ""
    ];
    
    sheet.appendRow(row);
    
  } catch (error) {
    console.error("Error saving history:", error);
  }
}

// ==================== สร้าง Sheet กำหนดค่า ====================
function createConfigSheet() {
  try {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CONFIG_SHEET);
      const headers = ["BotName", "ChannelToken", "IsMainBot", "Description", "BotId"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  } catch (error) {
    console.error("Error creating config sheet:", error);
  }
}

// ==================== ดึงหรือสร้าง Sheet ประวัติ ====================
function getSheet() {
  try {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
      const headers = ["Timestamp", "BotName", "ActionType", "MessageType", "Content", "Status", "UserId", "TargetId"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    return sheet;
  } catch (error) {
    console.error("Error getting sheet:", error);
    return null;
  }
}

// ==================== จัดการสถานะผู้ใช้ ====================
function getUserState(userId) {
  const props = PropertiesService.getScriptProperties();
  const key = `user_state_${userId}`;
  const timerKey = `user_timer_${userId}`;
  
  const state = props.getProperty(key);
  const timer = props.getProperty(timerKey);
  
  if (state && timer) {
    const now = new Date().getTime();
    if (now > parseInt(timer)) {
      // หมดเวลาเซสชัน (Timeout)
      props.deleteProperty(key);
      props.deleteProperty(timerKey);
      return null;
    }
  }
  return state;
}

function setUserState(userId, state) {
  const props = PropertiesService.getScriptProperties();
  const key = `user_state_${userId}`;
  const timerKey = `user_timer_${userId}`;
  
  if (state) {
    props.setProperty(key, state);
    props.setProperty(timerKey, String(new Date().getTime() + 30 * 60 * 1000));
  } else {
    props.deleteProperty(key);
    props.deleteProperty(timerKey);
  }
  
  console.log(`User state for ${userId} set to: ${state}`);
}

// ==================== ฟังก์ชันช่วยเหลือ ====================
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ==================== ทดสอบ Webhook ====================
function doGet() {
  return ContentService.createTextOutput("LINE Bot Webhook is running! Use POST method for webhook.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ==================== ฟังก์ชันสำหรับทดสอบ ====================
function testPush() {
  const mainBot = getMainBot();
  if (!mainBot) {
    console.error("Main bot not found");
    return;
  }
  
  const testMessage = {
    type: "text",
    text: "🧪 ทดสอบการส่งข้อความจาก Bot Management System"
  };
  
  const result = pushMessage(mainBot.token, "YOUR_USER_ID", testMessage);
  console.log("Test result:", result);
}

function testBroadcast() {
  const mainBot = getMainBot();
  if (!mainBot) {
    console.error("Main bot not found");
    return;
  }
  
  const testMessage = {
    type: "text",
    text: "📢 ทดสอบ Broadcast จาก Bot Management System"
  };
  
  const result = broadcastMessage(mainBot.token, testMessage);
  console.log("Broadcast result:", result);
}

function testGetAllBots() {
  const bots = getAllBots();
  console.log("All bots:", JSON.stringify(bots, null, 2));
}

function testGetBotProfile() {
  const mainBot = getMainBot();
  if (!mainBot) {
    console.error("Main bot not found");
    return;
  }
  
  const profile = getBotProfile(mainBot.token);
  console.log("Bot profile:", JSON.stringify(profile, null, 2));
}

// ==================== ตั้งค่าเริ่มต้น ====================
function initializeSystem() {
  createConfigSheet();
  getSheet();
  
  const mainBot = getMainBot();
  if (mainBot) {
    const profile = getBotProfile(mainBot.token);
    if (profile) {
      console.log("✅ Main Bot Profile:", profile.displayName);
    } else {
      console.log("⚠️ Cannot verify Main Bot profile");
    }
  }
  
  console.log("✅ System initialized successfully!");
  console.log("Main Bot:", MAIN_BOT_CONFIG.name);
}

// ==================== ตรวจสอบการตั้งค่า ====================
function checkConfiguration() {
  const mainBot = getMainBot();
  if (!mainBot) {
    console.error("❌ Main Bot not configured!");
    return;
  }
  
  console.log("✅ Main Bot configured:", mainBot.name);
  
  const profile = getBotProfile(mainBot.token);
  if (profile) {
    console.log("✅ Bot profile verified:", profile.displayName);
  } else {
    console.log("⚠️ Cannot verify bot profile");
  }
  
  const otherBots = getBotConfigsFromSheet();
  console.log(`✅ ${otherBots.length} other bot(s) configured in sheet`);
  
  otherBots.forEach(bot => {
    console.log("  -", bot.name);
  });
}

// ==================== เริ่มต้นระบบ ====================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📱 LINE Bot Manager')
    .addItem('🔄 เริ่มต้นระบบ', 'initializeSystem')
    .addItem('✅ ตรวจสอบการตั้งค่า', 'checkConfiguration')
    .addItem('🧪 ทดสอบ Push', 'testPush')
    .addItem('📢 ทดสอบ Broadcast', 'testBroadcast')
    .addItem('📋 ดูบอททั้งหมด', 'testGetAllBots')
    .addItem('👤 ดูโปรไฟล์บอท', 'testGetBotProfile')
    .addSeparator()
    .addItem('📊 ดูประวัติ', 'showHistoryMenu')
    .addToUi();
}

function showHistoryMenu() {
  const sheet = getSheet();
  if (sheet) {
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  }
}