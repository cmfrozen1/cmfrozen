/**
 * LINE Bot MCP - Google Apps Script Backend (Web App /exec mode)
 * ---------------------------------------------------------
 * 🆕 เวอร์ชันนี้: รองรับ AI หลายผู้ให้บริการ (multi-provider) และหลายรุ่น
 *    - Gemini (Google)
 *    - OpenAI (GPT)
 *    - Anthropic (Claude)
 *    เลือกได้จากเมนู LINE โดยตรง (พิมพ์ "model" หรือ "โมเดล")
 *    ทุกผู้ให้บริการรองรับ Tool Use / Function Calling (MCP-style) เหมือนเดิม
 *    เพิ่มผู้ให้บริการใหม่ได้โดยเพิ่ม entry ใน AI_PROVIDERS_ และเขียนฟังก์ชัน
 *    runXxxAgentLoop_() หนึ่งตัว
 *
 * ⚠️ รายชื่อรุ่น (models) ด้านล่างเป็นรายชื่อ ณ เวลาที่เขียนโค้ดนี้ ผู้ให้บริการ
 *    AI เปลี่ยน/เลิกใช้รุ่นกันบ่อยมาก แนะนำให้ตรวจสอบรุ่นล่าสุดจากเอกสารทางการ
 *    ก่อนใช้งานจริงเสมอ:
 *      - Gemini:    https://ai.google.dev/gemini-api/docs/models
 *      - OpenAI:    https://platform.openai.com/docs/models
 *      - Anthropic: https://docs.claude.com/en/docs/about-claude/models
 *
 * ตั้งค่าที่ต้องมีใน Script Properties:
 *  - CHANNEL_ACCESS_TOKEN     (บังคับ)
 *  - TARGET_USER_ID           (บังคับสำหรับ push/แอดมิน)
 *  - GEMINI_API_KEY           (บังคับถ้าจะใช้ Gemini)
 *  - OPENAI_API_KEY           (บังคับถ้าจะใช้ OpenAI)
 *  - ANTHROPIC_API_KEY        (บังคับถ้าจะใช้ Claude)
 *  - AI_PROVIDER              (ไม่บังคับ ค่าเริ่มต้น 'gemini' — เปลี่ยนได้จากเมนู LINE)
 *  - AI_MODEL                 (ไม่บังคับ ใช้ defaultModel ของ provider ถ้าไม่ตั้ง)
 *  - AI_IMAGE_PROVIDER        (ไม่บังคับ 'gemini' หรือ 'openai' สำหรับ generate_image)
 *  - GEMINI_IMAGE_MODEL       (ไม่บังคับ ค่าเริ่มต้น gemini-3.1-flash-image-preview)
 *  - OPENAI_IMAGE_MODEL       (ไม่บังคับ ค่าเริ่มต้น gpt-image-1)
 *  - AUTO_AI_REPLY            ('true'/'false' เปิด/ปิดให้ AI ตอบอัตโนมัติ)
 *  - AI_IMAGE_FOLDER_ID       (ระบบสร้างให้อัตโนมัติ ไม่ต้องตั้งเอง)
 */
const LINE_API_BASE = 'https://api.line.me/v2/bot';
const INBOX_IMAGE_FOLDER_ID = '10ycPVa0Z5M7T-Lrg7HDN63hijhtOth7r'; // โฟลเดอร์สำหรับเก็บรูปตอบกลับ inbox

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'status';
  return jsonOutput_(routeAction_(action, e.parameter));
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ success: false, error: 'Invalid JSON body' });
  }

  if (body.events && Array.isArray(body.events)) {
    const result = jsonOutput_({ success: true, processing: 'started' });
    try {
      handleLineWebhook_(body);
    } catch (err) {
      Logger.log('❌ handleLineWebhook_ error: ' + err.message);
    }
    return result;
  }

  return jsonOutput_(routeAction_(body.action, body.payload || {}));
}

function handleLineWebhook_(body) {
  const events = body.events || [];
  Logger.log('📨 Webhook received: ' + events.length + ' events');

  events.forEach(function (event) {
    try {
      const senderId = event.source && event.source.userId;
      Logger.log('📝 Processing event: type=' + event.type + ' userId=' + senderId);

      if (event.type === 'follow') {
        Logger.log('👋 Follow event from: ' + senderId);
        replyWithMenu_(event.replyToken, true, isAdmin_(senderId));
        const followProfile = fetchUserProfileCached_(senderId);
        logMessage_(senderId, followProfile.displayName, followProfile.pictureUrl, 'out', '[ระบบ] ส่งเมนูต้อนรับ', '', '');
        return;
      }

      if (event.type === 'unfollow') {
        Logger.log('👋 Unfollow event from: ' + senderId);
        const unfollowProfile = fetchUserProfileCached_(senderId);
        logMessage_(senderId, unfollowProfile.displayName, unfollowProfile.pictureUrl, 'in', '[ระบบ] ผู้ใช้บล็อกบอท', '', '');
        return;
      }

      if (event.type === 'message') {
        const profile = fetchUserProfileCached_(senderId);
        const quoteToken = event.message.quoteToken || '';
        const messageId = event.message.id || '';
        const markAsReadToken = event.message.markAsReadToken || '';
        let messageText = '';

        Logger.log('💬 Message type: ' + event.message.type + ' from: ' + senderId);

        switch (event.message.type) {
          case 'text':
            messageText = event.message.text;
            Logger.log('📝 Text message: ' + messageText.substring(0, 100));
            break;
          case 'image':
            messageText = '[รูปภาพ]';
            break;
          case 'video':
            messageText = '[วิดีโอ]';
            break;
          case 'audio':
            messageText = '[ข้อความเสียง]';
            break;
          case 'file':
            messageText = '[ไฟล์: ' + (event.message.fileName || 'ไม่ทราบชื่อ') + ']';
            break;
          case 'location':
            messageText = '[ตำแหน่งที่ตั้ง: ' + (event.message.address || 'ไม่ทราบที่อยู่') + ']';
            break;
          case 'sticker':
            messageText = '[สติกเกอร์: ' + (event.message.stickerId || '') + ']';
            break;
          default:
            messageText = '[ข้อความประเภท: ' + event.message.type + ']';
        }

        Logger.log('📥 กำลังบันทึกข้อความขาเข้า: userId=' + senderId + ' text=' + messageText.substring(0, 50) + ' markToken=' + (markAsReadToken ? 'yes' : 'no'));
        logMessage_(senderId, profile.displayName, profile.pictureUrl, 'in', messageText, quoteToken, messageId, markAsReadToken);
        Logger.log('✅ บันทึกข้อความขาเข้าเรียบร้อย');

        if (event.message.type === 'text') {
          const text = event.message.text.trim();
          const handled = handleMenuCommand_(text, senderId, event.replyToken, profile);
          if (handled) {
            Logger.log('✅ จัดการคำสั่งเมนู: ' + text);
            return;
          }

          const autoAiReply = (PropertiesService.getScriptProperties().getProperty('AUTO_AI_REPLY') || 'false').toLowerCase() === 'true';
          if (!autoAiReply) {
            Logger.log('⏸️ AUTO_AI_REPLY=false — รอแอดมินตอบ');
            return;
          }

          Logger.log('🤖 กำลังให้ AI ตอบอัตโนมัติ...');
          const aiCfg = getAIProviderConfig_();

          const aiContext = { replyToken: event.replyToken, userId: senderId };
          const result = generateAIAnswer_(text, aiCfg.provider, aiCfg.model, aiContext);

          if (!aiContext.messageSent) {
            const replyText = result.success ? result.answer : result.error;
            replyToLine_(event.replyToken, replyText);
          }
          const logText = result.success ? result.answer : result.error;
          logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', logText, '', '');
          Logger.log('✅ AI ตอบแล้ว (' + (result.kind || 'error') + '): ' + logText.substring(0, 100));
        }
      }
    } catch (err) {
      Logger.log('❌ Event processing error: ' + err.message + ' | stack: ' + err.stack);
      if (event.replyToken) {
        try {
          replyToLine_(event.replyToken, '❌ เกิดข้อผิดพลาด: ' + err.message);
        } catch (e2) { /* no-op */ }
      }
    }
  });

  Logger.log('✅ Webhook processing complete');
  return { success: true };
}

function isAdmin_(senderId) {
  const cfg = getConfig_();
  return !!cfg.targetUserId && senderId === cfg.targetUserId;
}

// ============================================================
// เมนูคำสั่ง (Quick Reply / ข้อความคำสั่ง)
// ============================================================

function handleMenuCommand_(text, senderId, replyToken, profile) {
  const command = text.toLowerCase();
  const admin = isAdmin_(senderId);

  function replyAndLog_(msg) {
    replyToLine_(replyToken, msg);
    logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', msg, '', '');
  }

  Logger.log('🔍 handleMenuCommand_: command=' + command + ' admin=' + admin);

  // 🆕 คำสั่งเปลี่ยน provider/model แบบไดนามิก เช่น
  //    "model:openai" -> เปลี่ยนไปใช้ OpenAI (ใช้ default model ของค่ายนั้น)
  //    "model:openai:gpt-5.5" -> เปลี่ยนไปใช้ OpenAI รุ่น gpt-5.5 โดยตรง
  if (command.indexOf('model:') === 0) {
    if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
    const parts = text.split(':'); // เก็บ case เดิมไว้เผื่อชื่อรุ่นมีตัวพิมพ์ใหญ่
    const provider = (parts[1] || '').trim().toLowerCase();
    const modelName = (parts[2] || '').trim();
    handleModelSwitchCommand_(provider, modelName, replyToken, senderId, profile);
    return true;
  }

  switch (command) {
    case 'เมนู':
    case 'menu':
      replyWithMenu_(replyToken, false, admin);
      logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', '[ระบบ] ส่งเมนู Quick Reply', '', '');
      return true;

    case 'model':
    case 'โมเดล':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      replyModelPickerProviders_(replyToken, senderId, profile);
      return true;

    case 'quota':
    case 'โควต้า':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      try {
        const quota = lineApiGet_('/message/quota');
        const consumption = lineApiGet_('/message/quota/consumption');
        const limit = quota.value, used = consumption.totalUsage;
        replyAndLog_('📊 Message Quota\nLimit: ' + limit + '\nUsed: ' + used + '\nRemaining: ' + (limit - used));
      } catch (e) {
        replyAndLog_('❌ ' + e.message);
      }
      return true;

    case 'profile':
    case 'โปรไฟล์':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      try {
        const cfg = getConfig_();
        const targetProfile = lineApiGet_('/profile/' + cfg.targetUserId);
        replyAndLog_('👤 Profile\nชื่อ: ' + (targetProfile.displayName || 'N/A') + '\nสถานะ: ' + (targetProfile.statusMessage || '-'));
      } catch (e) {
        replyAndLog_('❌ ' + e.message);
      }
      return true;

    case 'followers':
    case 'ผู้ติดตาม':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      try {
        const data = lineApiGet_('/followers/ids?limit=20');
        const count = (data.userIds || []).length;
        replyAndLog_('👥 Followers\nพบผู้ติดตาม: ' + count + ' คน');
      } catch (e) {
        replyAndLog_('❌ ' + e.message);
      }
      return true;

    case 'flex':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      try {
        const sampleFlex = {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '🎉 Flex Message!', weight: 'bold', size: 'xl', color: '#06C755' },
              { type: 'text', text: 'ส่งจากเมนู LINE', size: 'sm', color: '#666666', margin: 'md' },
              { type: 'separator', margin: 'md' },
              { type: 'text', text: '✅ ทำงานสำเร็จ!', size: 'sm', color: '#333333', margin: 'md' }
            ]
          }
        };
        replyFlexToLine_(replyToken, 'Flex Message', sampleFlex);
        logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', '[Flex Message: Flex Message]', '', '');
      } catch (e) {
        replyAndLog_('❌ ' + e.message);
      }
      return true;

    case 'broadcast':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      replyAndLog_('📢 เพื่อความปลอดภัย กรุณาใช้ปุ่ม Broadcast บนหน้าเว็บ (มี prompt ยืนยันข้อความก่อนส่ง)');
      return true;

    case 'ai':
    case 'เอไอ':
      if (!admin) { replyAndLog_('⚠️ คำสั่งนี้ใช้ได้เฉพาะแอดมิน'); return true; }
      const aiCfg = getAIProviderConfig_();
      replyAndLog_(
        '🤖 กำลังใช้: ' + AI_PROVIDERS_[aiCfg.provider].label + ' (' + aiCfg.model + ')\n' +
        'พิมพ์ "model" เพื่อเปลี่ยนผู้ให้บริการ/รุ่น\n\n' +
        'ลองพิมพ์คุยกับ AI ได้เลย เช่น\n' +
        '• "ราคาน้ำมันวันนี้เท่าไหร่ ส่งเป็นการ์ดแจ้งเตือนหน่อย"\n' +
        '• "วาดรูปแมวใส่หมวกให้หน่อย"\n' +
        '(ต้องเปิด AUTO_AI_REPLY=true ใน Script Properties ก่อน)'
      );
      return true;

    default:
      return false;
  }
}

/**
 * 🆕 ขั้นที่ 1 ของการเลือกโมเดล: แสดงรายชื่อผู้ให้บริการเป็น Quick Reply
 */
function replyModelPickerProviders_(replyToken, senderId, profile) {
  const aiCfg = getAIProviderConfig_();
  const items = Object.keys(AI_PROVIDERS_).map(function (key) {
    const label = (key === aiCfg.provider ? '✅ ' : '') + AI_PROVIDERS_[key].label;
    return quickReplyItem_(label.substring(0, 20), 'model:' + key);
  });
  items.push(quickReplyItem_('เมนู', 'เมนู'));

  const cfg = getConfig_();
  if (!cfg.channelAccessToken) return;
  const text = '🧠 ตอนนี้ใช้: ' + AI_PROVIDERS_[aiCfg.provider].label + ' (' + aiCfg.model + ')\nเลือกผู้ให้บริการที่ต้องการ:';
  UrlFetchApp.fetch(LINE_API_BASE + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text, quickReply: { items: items } }]
    }),
    muteHttpExceptions: true
  });
  logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', '[ระบบ] แสดงตัวเลือกผู้ให้บริการ AI', '', '');
}

/**
 * 🆕 ขั้นที่ 2: แสดงรายชื่อรุ่นของผู้ให้บริการที่เลือก เป็น Quick Reply
 */
function replyModelPickerModels_(replyToken, provider, senderId, profile) {
  const providerCfg = AI_PROVIDERS_[provider];
  const aiCfg = getAIProviderConfig_();
  const items = providerCfg.models.map(function (m) {
    const label = (provider === aiCfg.provider && m === aiCfg.model ? '✅ ' : '') + m;
    return quickReplyItem_(label.substring(0, 20), 'model:' + provider + ':' + m);
  });
  items.push(quickReplyItem_('« ย้อนกลับ', 'model'));

  const cfg = getConfig_();
  if (!cfg.channelAccessToken) return;
  const text = '🧠 ' + providerCfg.label + ' — เลือกรุ่น:';
  UrlFetchApp.fetch(LINE_API_BASE + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text, quickReply: { items: items } }]
    }),
    muteHttpExceptions: true
  });
  logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', '[ระบบ] แสดงตัวเลือกรุ่น ' + providerCfg.label, '', '');
}

function handleModelSwitchCommand_(provider, modelName, replyToken, senderId, profile) {
  const providerCfg = AI_PROVIDERS_[provider];
  if (!providerCfg) {
    replyToLine_(replyToken, '❌ ไม่รู้จักผู้ให้บริการ "' + provider + '"');
    return;
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty(providerCfg.apiKeyProp);
  if (!apiKey) {
    replyToLine_(replyToken, '⚠️ ยังไม่ได้ตั้งค่า ' + providerCfg.apiKeyProp + ' ใน Script Properties — ตั้งค่าก่อนถึงจะใช้ ' + providerCfg.label + ' ได้');
    return;
  }

  if (!modelName) {
    // ยังไม่เลือกรุ่น -> ตั้ง provider ไว้ก่อน (ใช้ default model) แล้วโชว์รายชื่อรุ่นให้เลือกต่อ
    PropertiesService.getScriptProperties().setProperty('AI_PROVIDER', provider);
    if (providerCfg.models.indexOf(PropertiesService.getScriptProperties().getProperty('AI_MODEL')) === -1) {
      PropertiesService.getScriptProperties().setProperty('AI_MODEL', providerCfg.defaultModel);
    }
    replyModelPickerModels_(replyToken, provider, senderId, profile);
    return;
  }

  PropertiesService.getScriptProperties().setProperty('AI_PROVIDER', provider);
  PropertiesService.getScriptProperties().setProperty('AI_MODEL', modelName);
  const msg = '✅ เปลี่ยนเป็น ' + providerCfg.label + ' รุ่น "' + modelName + '" เรียบร้อยแล้ว';
  replyToLine_(replyToken, msg);
  logMessage_(senderId, profile.displayName, profile.pictureUrl, 'out', msg, '', '');
}

function replyWithMenu_(replyToken, welcome, isAdminUser) {
  const items = [quickReplyItem_('เมนู', 'เมนู')];
  if (isAdminUser) {
    items.push(quickReplyItem_('📊 Quota', 'quota'));
    items.push(quickReplyItem_('👤 Profile', 'profile'));
    items.push(quickReplyItem_('👥 Followers', 'followers'));
    items.push(quickReplyItem_('📊 Flex', 'flex'));
    items.push(quickReplyItem_('📢 Broadcast', 'broadcast'));
    items.push(quickReplyItem_('🧠 Model', 'model'));
    items.push(quickReplyItem_('🤖 AI', 'ai'));
  }

  const text = welcome
    ? '👋 ยินดีต้อนรับ! พิมพ์คำถามได้เลย แอดมินจะตอบกลับให้ หรือเลือกจากเมนูด้านล่าง' + (isAdminUser ? '' : '\n(เมนูฝั่งแอดมินซ่อนอยู่ — ใช้ได้เฉพาะแอดมิน)')
    : '📋 เมนู — เลือกได้เลย';

  const cfg = getConfig_();
  if (!cfg.channelAccessToken) return;
  UrlFetchApp.fetch(LINE_API_BASE + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: text,
        quickReply: { items: items }
      }]
    }),
    muteHttpExceptions: true
  });
}

function quickReplyItem_(label, text) {
  return { type: 'action', action: { type: 'message', label: label, text: text } };
}

function replyFlexToLine_(replyToken, altText, contents) {
  const cfg = getConfig_();
  if (!cfg.channelAccessToken) return;
  UrlFetchApp.fetch(LINE_API_BASE + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'flex', altText: altText, contents: contents }]
    }),
    muteHttpExceptions: true
  });
}

function replyToLine_(replyToken, text) {
  const cfg = getConfig_();
  if (!cfg.channelAccessToken) return;
  UrlFetchApp.fetch(LINE_API_BASE + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }]
    }),
    muteHttpExceptions: true
  });
}

function replyImageToLine_(replyToken, imageUrl, previewUrl) {
  const cfg = getConfig_();
  if (!cfg.channelAccessToken) return;
  UrlFetchApp.fetch(LINE_API_BASE + '/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'image', originalContentUrl: imageUrl, previewImageUrl: previewUrl || imageUrl }]
    }),
    muteHttpExceptions: true
  });
}

function pushImageToUser_(userId, imageUrl, previewUrl) {
  lineApiPost_('/message/push', {
    to: userId,
    messages: [{ type: 'image', originalContentUrl: imageUrl, previewImageUrl: previewUrl || imageUrl }]
  });
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function routeAction_(action, payload) {
  try {
    switch (action) {
      case 'status':
        return checkStatus();
      case 'sendText':
        return sendTextMessage(payload.message);
      case 'getProfile':
        return getUserProfile();
      case 'getFollowers':
        return getFollowerIds(payload.limit);
      case 'broadcast':
        return broadcastMessage(payload.message);
      case 'sendFlex':
        return sendFlexMessageToUser(payload.altText, payload.contents);
      case 'getQuota':
        return getMessageQuota();
      case 'askAI':
        return askAI(payload.question, payload.provider, payload.model);
      case 'suggestAI':
        return generateAIAnswer_(payload.question, payload.provider, payload.model, { dryRun: true });
      case 'getAIProviders':
        return { success: true, providers: AI_PROVIDERS_, current: getAIProviderConfig_() };
      case 'setAIProvider':
        PropertiesService.getScriptProperties().setProperty('AI_PROVIDER', payload.provider);
        if (payload.model) PropertiesService.getScriptProperties().setProperty('AI_MODEL', payload.model);
        return { success: true, current: getAIProviderConfig_() };
      case 'getConversations':
        return getConversations();
      case 'getMessages':
        return getMessagesForUser(payload.userId);
      case 'markAsRead':
        return markMessagesAsRead_(payload.userId);
      case 'replyToUser':
        return replyToUser(payload.userId, payload.message, payload.quoteToken, payload.imageUrl);
      case 'uploadToDrive':
        return uploadToDrive(payload);
      case 'sendImage':
        return sendImageMessage(payload.imageUrl, payload.message, payload.userId);
      case 'syncChatHistory':
        return syncChatHistoryAllUsers_();
      default:
        return { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    channelAccessToken: props.getProperty('CHANNEL_ACCESS_TOKEN'),
    targetUserId: props.getProperty('TARGET_USER_ID')
  };
}

function lineApiPost_(path, payload) {
  const cfg = getConfig_();
  if (!cfg.channelAccessToken) {
    throw new Error('CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่าใน Script Properties');
  }
  const response = UrlFetchApp.fetch(LINE_API_BASE + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 400) {
    throw new Error('LINE API error (' + code + '): ' + text);
  }
  return text ? JSON.parse(text) : {};
}

function lineApiGet_(path) {
  const cfg = getConfig_();
  if (!cfg.channelAccessToken) {
    throw new Error('CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่าใน Script Properties');
  }
  const response = UrlFetchApp.fetch(LINE_API_BASE + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + cfg.channelAccessToken },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 400) {
    throw new Error('LINE API error (' + code + '): ' + text);
  }
  return text ? JSON.parse(text) : {};
}

function pushToUser_(text) {
  const cfg = getConfig_();
  if (!cfg.targetUserId) {
    return { lineSent: false, lineError: 'TARGET_USER_ID ยังไม่ได้ตั้งค่า จึงไม่ได้ส่งเข้า LINE' };
  }
  try {
    lineApiPost_('/message/push', {
      to: cfg.targetUserId,
      messages: [{ type: 'text', text: text }]
    });
    const profile = fetchUserProfileCached_(cfg.targetUserId);
    logMessage_(cfg.targetUserId, profile.displayName, profile.pictureUrl, 'out', text, '', '');
    return { lineSent: true, lineError: null };
  } catch (e) {
    return { lineSent: false, lineError: e.message };
  }
}

function checkStatus() {
  const cfg = getConfig_();
  const props = PropertiesService.getScriptProperties();
  const chatHistoryEnabled = props.getProperty('ENABLE_CHAT_HISTORY_SYNC') === 'true';
  const aiCfg = getAIProviderConfig_();

  const providerStatus = {};
  Object.keys(AI_PROVIDERS_).forEach(function (key) {
    providerStatus[key] = !!props.getProperty(AI_PROVIDERS_[key].apiKeyProp);
  });

  let sheetTest = 'not tested';
  try {
    const sheet = getInboxSheet_();
    sheetTest = 'ok - ' + sheet.getParent().getUrl();
  } catch (e) {
    sheetTest = 'error: ' + e.message;
  }

  return {
    success: true,
    status: 'online',
    channelTokenConfigured: !!cfg.channelAccessToken,
    targetUserConfigured: !!cfg.targetUserId,
    chatHistorySyncEnabled: chatHistoryEnabled,
    aiProvider: aiCfg.provider,
    aiModel: aiCfg.model,
    aiProvidersConfigured: providerStatus,
    sheetTest: sheetTest
  };
}

function sendTextMessage(message) {
  const cfg = getConfig_();
  if (!cfg.targetUserId) {
    return { success: false, error: 'TARGET_USER_ID ยังไม่ได้ตั้งค่าใน Script Properties' };
  }
  if (!message) {
    return { success: false, error: 'message is required' };
  }
  const pushResult = pushToUser_(message);
  if (!pushResult.lineSent) {
    return { success: false, error: pushResult.lineError };
  }
  return { success: true };
}

function getUserProfile() {
  const cfg = getConfig_();
  if (!cfg.targetUserId) {
    return { success: false, error: 'TARGET_USER_ID ยังไม่ได้ตั้งค่าใน Script Properties' };
  }
  try {
    const profile = lineApiGet_('/profile/' + cfg.targetUserId);
    const summary = '👤 Profile\nชื่อ: ' + (profile.displayName || 'N/A') +
      '\nสถานะ: ' + (profile.statusMessage || '-');
    const pushResult = pushToUser_(summary);
    return { success: true, profile: profile, lineSent: pushResult.lineSent, lineError: pushResult.lineError };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getFollowerIds(limit) {
  try {
    const path = '/followers/ids' + (limit ? '?limit=' + limit : '');
    const data = lineApiGet_(path);
    const count = (data.userIds || []).length;
    const summary = '👥 Followers\nพบผู้ติดตาม: ' + count + ' คน';
    const pushResult = pushToUser_(summary);
    return { success: true, data: data, lineSent: pushResult.lineSent, lineError: pushResult.lineError };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function broadcastMessage(message) {
  if (!message) {
    return { success: false, error: 'message is required' };
  }
  try {
    lineApiPost_('/message/broadcast', {
      messages: [{ type: 'text', text: message }]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function sendFlexMessageToUser(altText, contents) {
  const cfg = getConfig_();
  if (!cfg.targetUserId) {
    return { success: false, error: 'TARGET_USER_ID ยังไม่ได้ตั้งค่าใน Script Properties' };
  }
  if (!altText || !contents) {
    return { success: false, error: 'altText and contents are required' };
  }
  try {
    const parsedContents = typeof contents === 'string' ? JSON.parse(contents) : contents;
    lineApiPost_('/message/push', {
      to: cfg.targetUserId,
      messages: [{ type: 'flex', altText: altText, contents: parsedContents }]
    });
    const profile = fetchUserProfileCached_(cfg.targetUserId);
    logMessage_(cfg.targetUserId, profile.displayName, profile.pictureUrl, 'out', '[Flex Message: ' + altText + ']', '', '');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// 🆕 Multi-provider AI — Text + Tool Use (Function Calling / MCP-style)
// ============================================================

/**
 * ตั้งค่าผู้ให้บริการ + รุ่นที่มีให้เลือก
 * เพิ่มผู้ให้บริการใหม่: เพิ่ม entry ที่นี่ + เขียน runXxxAgentLoop_() หนึ่งฟังก์ชัน
 * แล้วเพิ่ม case ใน generateAIAnswer_()
 */
const AI_PROVIDERS_ = {
  gemini: {
    label: 'Gemini (Google)',
    apiKeyProp: 'GEMINI_API_KEY',
    defaultModel: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash-lite']
  },
  openai: {
    label: 'OpenAI (GPT)',
    apiKeyProp: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.5',
    models: ['gpt-5.5', 'gpt-5.4-mini', 'gpt-4o-mini']
  },
  anthropic: {
    label: 'Claude (Anthropic)',
    apiKeyProp: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-4-8']
  }
};

function getAIProviderConfig_() {
  const props = PropertiesService.getScriptProperties();
  const provider = (props.getProperty('AI_PROVIDER') || 'gemini').toLowerCase();
  const providerCfg = AI_PROVIDERS_[provider] || AI_PROVIDERS_.gemini;
  const model = props.getProperty('AI_MODEL') || providerCfg.defaultModel;
  return { provider: AI_PROVIDERS_[provider] ? provider : 'gemini', model: model };
}

/**
 * รายการ "เครื่องมือ" ที่ AI เรียกใช้ได้จริง เขียนแบบ JSON Schema มาตรฐาน (lowercase types)
 * แล้วแปลงเป็นฟอร์แมตเฉพาะของแต่ละผู้ให้บริการตอนเรียก API จริง
 */
const AI_TOOLS_DECLARATION_ = [
  {
    name: 'get_oil_price',
    description: 'ดึงราคาน้ำมันล่าสุดในประเทศไทย (ปั๊ม ปตท และบางจาก) หน่วยบาทต่อลิตร ใช้เมื่อผู้ใช้ถามราคาน้ำมันวันนี้ ไม่ต้องใส่พารามิเตอร์',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'generate_image',
    description: 'สร้างรูปภาพด้วย AI จากคำอธิบาย แล้วส่งรูปเข้า LINE ให้ผู้ใช้ทันที ใช้เมื่อผู้ใช้ขอให้วาดรูป/สร้างภาพ/generate image',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'คำอธิบายภาพที่ต้องการสร้าง อธิบายเป็นภาษาอังกฤษจะได้ผลลัพธ์ดีที่สุด' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'send_flex_notification',
    description: 'ส่งการ์ดแจ้งเตือนแบบ Flex Message เข้า LINE ให้ผู้ใช้ทันที ใช้เมื่อผู้ใช้ขอให้ "ส่งแจ้งเตือน" หรือ "ทำเป็นการ์ด/flex" หรือใช้สรุปผลลัพธ์จากเครื่องมืออื่น (เช่นราคาน้ำมัน) ให้ส่งเป็นการ์ดสวยๆ',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'หัวข้อของการ์ดแจ้งเตือน' },
        message: { type: 'string', description: 'เนื้อหารายละเอียด ขึ้นบรรทัดใหม่ด้วย \\n ได้' }
      },
      required: ['title', 'message']
    }
  }
];

const MAX_TOOL_STEPS_ = 4;

/**
 * ✅ HTTP POST พร้อม retry แบบ exponential backoff สำหรับ error ชั่วคราว (429/503)
 * ใช้ร่วมกันได้ทั้ง 3 ผู้ให้บริการ
 */
function httpPostWithRetry_(url, options) {
  const MAX_RETRIES = 3;
  let lastCode = 0;
  let lastRaw = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options));
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code < 400) {
      try {
        return { ok: true, code: code, data: JSON.parse(text) };
      } catch (e) {
        return { ok: false, code: code, raw: text };
      }
    }

    lastCode = code;
    lastRaw = text;

    const isRetryable = (code === 503 || code === 429);
    if (!isRetryable || attempt === MAX_RETRIES) break;

    const waitMs = Math.pow(2, attempt) * 1000;
    Logger.log('⏳ HTTP ' + code + ' — retry รอบที่ ' + (attempt + 1) + '/' + MAX_RETRIES + ' อีก ' + waitMs + 'ms...');
    Utilities.sleep(waitMs);
  }

  return { ok: false, code: lastCode, raw: lastRaw };
}

/**
 * แปลง error ดิบจาก AI API ให้เป็นข้อความสั้นๆ อ่านง่าย (ภาษาไทย)
 */
function friendlyAIError_(providerLabel, code, rawText, modelName) {
  let parsed = null;
  try { parsed = JSON.parse(rawText); } catch (e) { /* ignore parse error */ }
  const apiMsg = (parsed && parsed.error && parsed.error.message) || (parsed && parsed.message) || '';

  if (code === 429) {
    const retryMatch = apiMsg.match(/retry in ([\d.]+)s/i);
    const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
    return '⏳ โควต้า ' + providerLabel + ' รุ่น "' + modelName + '" เต็มชั่วคราว' +
      (waitSec ? ' (รออีก ~' + waitSec + ' วินาที)' : '') +
      ' — ลองเปลี่ยนไปใช้โมเดล/ผู้ให้บริการอื่นในเมนู หรือรอสักครู่แล้วลองใหม่';
  }
  if (code === 404) {
    return '❌ ไม่พบโมเดล "' + modelName + '" ของ ' + providerLabel + ' — กรุณาเลือกรุ่นอื่นจากเมนู "model"';
  }
  if (code === 400) {
    return '❌ คำขอไม่ถูกต้อง (400) จาก ' + providerLabel + ' — ' + (apiMsg || 'กรุณาลองใหม่หรือเปลี่ยนคำถาม');
  }
  if (code === 401 || code === 403) {
    return '❌ ไม่มีสิทธิ์เรียกใช้ ' + providerLabel + ' (' + code + ') — ตรวจสอบ API key ใน Script Properties';
  }
  if (code === 503) {
    return '⏳ ' + providerLabel + ' รุ่น "' + modelName + '" กำลังโอเวอร์โหลดชั่วคราว (503) — ระบบลองใหม่ให้อัตโนมัติแล้วแต่ยังไม่ผ่าน กรุณาลองอีกครั้งใน 1-2 นาที';
  }
  if (code === 500 || code === 502) {
    return '❌ เซิร์ฟเวอร์ ' + providerLabel + ' มีปัญหาชั่วคราว (HTTP ' + code + ') — กรุณาลองใหม่อีกครั้ง';
  }
  return '❌ ' + providerLabel + ' ตอบไม่สำเร็จ (HTTP ' + code + ')';
}

/**
 * จุดเข้าหลักในการคุยกับ AI (ทุกผู้ให้บริการ) พร้อม Tool Use loop
 * @param {string} question
 * @param {string} provider  'gemini' | 'openai' | 'anthropic' (ไม่ระบุ = ใช้ค่าที่ตั้งไว้)
 * @param {string} model     ไม่ระบุ = ใช้ default ของ provider หรือค่าที่ตั้งไว้
 * @param {object} context   { replyToken, userId, dryRun }
 */
function generateAIAnswer_(question, provider, model, context) {
  if (!question) {
    return { success: false, error: 'question is required' };
  }
  const current = getAIProviderConfig_();
  const providerKey = (provider || current.provider || 'gemini').toLowerCase();
  const providerCfg = AI_PROVIDERS_[providerKey];
  if (!providerCfg) {
    return { success: false, error: 'ไม่รู้จักผู้ให้บริการ AI: ' + providerKey };
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty(providerCfg.apiKeyProp);
  if (!apiKey) {
    return { success: false, error: providerCfg.apiKeyProp + ' ยังไม่ได้ตั้งค่าใน Script Properties' };
  }

  const modelName = model || (providerKey === current.provider ? current.model : providerCfg.defaultModel);
  context = context || {};

  try {
    let loopResult;
    switch (providerKey) {
      case 'gemini':
        loopResult = runGeminiAgentLoop_(modelName, apiKey, question, context);
        break;
      case 'openai':
        loopResult = runOpenAIAgentLoop_(modelName, apiKey, question, context);
        break;
      case 'anthropic':
        loopResult = runAnthropicAgentLoop_(modelName, apiKey, question, context);
        break;
      default:
        return { success: false, error: 'unsupported provider: ' + providerKey };
    }

    if (!loopResult.ok) {
      Logger.log('❌ AI API error (' + loopResult.code + ') provider=' + providerKey + ' model=' + modelName + ': ' + loopResult.raw);
      return { success: false, error: friendlyAIError_(providerCfg.label, loopResult.code, loopResult.raw, modelName) };
    }

    return {
      success: true,
      kind: loopResult.actionsUsed.length > 0 ? 'action' : 'text',
      actions: loopResult.actionsUsed,
      answer: loopResult.finalText,
      provider: providerKey,
      model: modelName
    };
  } catch (e) {
    Logger.log('❌ generateAIAnswer_ exception: ' + e.message);
    return { success: false, error: 'เชื่อมต่อ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (' + e.message + ')' };
  }
}

// ---- Gemini ----

function toGeminiSchema_(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const k in schema) {
    if (k === 'type') {
      out.type = String(schema.type).toUpperCase();
    } else if (k === 'properties') {
      out.properties = {};
      for (const p in schema.properties) {
        out.properties[p] = toGeminiSchema_(schema.properties[p]);
      }
    } else {
      out[k] = schema[k];
    }
  }
  return out;
}

function runGeminiAgentLoop_(model, apiKey, question, context) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  const toolsDecl = AI_TOOLS_DECLARATION_.map(function (t) {
    return { name: t.name, description: t.description, parameters: toGeminiSchema_(t.parameters) };
  });

  const contents = [{ role: 'user', parts: [{ text: question }] }];
  const actionsUsed = [];
  let finalText = null;

  for (let step = 0; step < MAX_TOOL_STEPS_; step++) {
    const res = httpPostWithRetry_(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ contents: contents, tools: [{ functionDeclarations: toolsDecl }] })
    });
    if (!res.ok) return res;

    const candidate = res.data.candidates && res.data.candidates[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];
    const fnParts = parts.filter(function (p) { return !!p.functionCall; });

    if (fnParts.length === 0) {
      finalText = parts.map(function (p) { return p.text || ''; }).join('').trim();
      break;
    }

    contents.push({ role: 'model', parts: parts });

    const fnResponseParts = [];
    fnParts.forEach(function (p) {
      const fnName = p.functionCall.name;
      const fnArgs = p.functionCall.args || {};
      Logger.log('🛠️ [Gemini] เรียก tool: ' + fnName + ' args=' + JSON.stringify(fnArgs));
      const result = executeAiTool_(fnName, fnArgs, context);
      if (result.sent) actionsUsed.push(fnName);
      fnResponseParts.push({ functionResponse: { name: fnName, response: result.forModel || {} } });
    });
    contents.push({ role: 'user', parts: fnResponseParts });
  }

  if (!finalText) {
    finalText = actionsUsed.length > 0 ? '✅ ดำเนินการเรียบร้อยแล้วครับ' : 'ไม่มีคำตอบจาก AI';
  }

  return { ok: true, actionsUsed: actionsUsed, finalText: finalText };
}

// ---- OpenAI ----

function runOpenAIAgentLoop_(model, apiKey, question, context) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const toolsDecl = AI_TOOLS_DECLARATION_.map(function (t) {
    return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } };
  });

  const messages = [{ role: 'user', content: question }];
  const actionsUsed = [];
  let finalText = null;

  for (let step = 0; step < MAX_TOOL_STEPS_; step++) {
    const res = httpPostWithRetry_(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify({ model: model, messages: messages, tools: toolsDecl })
    });
    if (!res.ok) return res;

    const message = res.data.choices && res.data.choices[0] && res.data.choices[0].message;
    const toolCalls = (message && message.tool_calls) || [];

    if (toolCalls.length === 0) {
      finalText = (message && message.content) || '';
      break;
    }

    messages.push({ role: 'assistant', content: message.content || null, tool_calls: toolCalls });

    toolCalls.forEach(function (tc) {
      const fnName = tc.function.name;
      let fnArgs = {};
      try { fnArgs = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* ignore */ }
      Logger.log('🛠️ [OpenAI] เรียก tool: ' + fnName + ' args=' + JSON.stringify(fnArgs));
      const result = executeAiTool_(fnName, fnArgs, context);
      if (result.sent) actionsUsed.push(fnName);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result.forModel || {})
      });
    });
  }

  if (!finalText) {
    finalText = actionsUsed.length > 0 ? '✅ ดำเนินการเรียบร้อยแล้วครับ' : 'ไม่มีคำตอบจาก AI';
  }

  return { ok: true, actionsUsed: actionsUsed, finalText: finalText };
}

// ---- Anthropic (Claude) ----

function runAnthropicAgentLoop_(model, apiKey, question, context) {
  const url = 'https://api.anthropic.com/v1/messages';
  const toolsDecl = AI_TOOLS_DECLARATION_.map(function (t) {
    return { name: t.name, description: t.description, input_schema: t.parameters };
  });

  const messages = [{ role: 'user', content: question }];
  const actionsUsed = [];
  let finalText = null;

  for (let step = 0; step < MAX_TOOL_STEPS_; step++) {
    const res = httpPostWithRetry_(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: model, max_tokens: 2048, messages: messages, tools: toolsDecl })
    });
    if (!res.ok) return res;

    const contentBlocks = res.data.content || [];
    const toolUseBlocks = contentBlocks.filter(function (b) { return b.type === 'tool_use'; });

    if (toolUseBlocks.length === 0) {
      finalText = contentBlocks
        .filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text; })
        .join('')
        .trim();
      break;
    }

    messages.push({ role: 'assistant', content: contentBlocks });

    const toolResults = [];
    toolUseBlocks.forEach(function (b) {
      Logger.log('🛠️ [Claude] เรียก tool: ' + b.name + ' args=' + JSON.stringify(b.input));
      const result = executeAiTool_(b.name, b.input || {}, context);
      if (result.sent) actionsUsed.push(b.name);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: b.id,
        content: JSON.stringify(result.forModel || {})
      });
    });
    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) {
    finalText = actionsUsed.length > 0 ? '✅ ดำเนินการเรียบร้อยแล้วครับ' : 'ไม่มีคำตอบจาก AI';
  }

  return { ok: true, actionsUsed: actionsUsed, finalText: finalText };
}

// ---- เครื่องมือจริง (ใช้ร่วมกันทุกผู้ให้บริการ) ----

function executeAiTool_(name, args, context) {
  switch (name) {
    case 'get_oil_price':
      return toolGetOilPrice_();
    case 'generate_image':
      return toolGenerateImage_(args.prompt, context);
    case 'send_flex_notification':
      return toolSendFlexNotification_(args.title, args.message, context);
    default:
      return { forModel: { error: 'unknown tool: ' + name }, summary: '❌ ไม่รู้จักเครื่องมือ ' + name, sent: false };
  }
}

function toolGetOilPrice_() {
  try {
    const response = UrlFetchApp.fetch('https://api.chnwt.dev/thai-oil-api/latest', { muteHttpExceptions: true });
    const code = response.getResponseCode();
    if (code >= 400) throw new Error('HTTP ' + code);
    const data = JSON.parse(response.getContentText());
    const st = data.response && data.response.stations;
    if (!st) throw new Error('ไม่พบข้อมูลราคาน้ำมัน');

    function priceOf(stationKey, fuelKey) {
      const s = st[stationKey];
      return (s && s[fuelKey] && s[fuelKey].price) ? s[fuelKey].price : '-';
    }

    const summary = [
      '⛽ ราคาน้ำมันวันนี้ (' + (data.response.date || '') + ')',
      '',
      '🔴 ปตท (PTT)',
      '  แก๊สโซฮอล์ 95: ' + priceOf('ptt', 'gasohol_95') + ' บ./ล.',
      '  แก๊สโซฮอล์ 91: ' + priceOf('ptt', 'gasohol_91') + ' บ./ล.',
      '  ดีเซล B7: ' + priceOf('ptt', 'diesel_b7') + ' บ./ล.',
      '',
      '🟢 บางจาก (Bangchak)',
      '  แก๊สโซฮอล์ 95: ' + priceOf('bcp', 'gasohol_95') + ' บ./ล.',
      '  แก๊สโซฮอล์ 91: ' + priceOf('bcp', 'gasohol_91') + ' บ./ล.',
      '  ดีเซล B7: ' + priceOf('bcp', 'diesel_b7') + ' บ./ล.'
    ].join('\n');

    return {
      forModel: { date: data.response.date, ptt: st.ptt, bcp: st.bcp },
      summary: summary,
      sent: false
    };
  } catch (e) {
    Logger.log('❌ toolGetOilPrice_ error: ' + e.message);
    return { forModel: { error: e.message }, summary: '❌ ดึงราคาน้ำมันไม่สำเร็จ: ' + e.message, sent: false };
  }
}

/**
 * 🆕 สร้างรูปด้วย Gemini หรือ OpenAI (ตาม AI_IMAGE_PROVIDER หรือเดาจาก key ที่มี)
 * แล้วอัปโหลดขึ้น Google Drive + แชร์ลิงก์ เพื่อให้ LINE โหลดรูปได้
 */
function toolGenerateImage_(prompt, context) {
  context = context || {};
  if (!prompt) {
    return { forModel: { error: 'prompt is required' }, summary: '❌ ไม่มีคำอธิบายภาพ (prompt)', sent: false };
  }

  const props = PropertiesService.getScriptProperties();
  const imageProvider = (props.getProperty('AI_IMAGE_PROVIDER') || (props.getProperty('GEMINI_API_KEY') ? 'gemini' : 'openai')).toLowerCase();

  if (context.dryRun) {
    return { forModel: { status: 'preview', prompt: prompt, provider: imageProvider }, summary: '🖼️ (พรีวิว) จะสร้างรูป [' + imageProvider + ']: "' + prompt + '"', sent: false };
  }

  try {
    let bytes, mime;
    if (imageProvider === 'openai') {
      const apiKey = props.getProperty('OPENAI_API_KEY');
      if (!apiKey) throw new Error('OPENAI_API_KEY ยังไม่ได้ตั้งค่า');
      const model = props.getProperty('OPENAI_IMAGE_MODEL') || 'gpt-image-1';
      const res = httpPostWithRetry_('https://api.openai.com/v1/images/generations', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + apiKey },
        payload: JSON.stringify({ model: model, prompt: prompt, size: '1024x1024', n: 1 })
      });
      if (!res.ok) throw new Error('สร้างภาพไม่สำเร็จ (HTTP ' + res.code + '): ' + res.raw);
      const b64 = res.data.data && res.data.data[0] && res.data.data[0].b64_json;
      if (!b64) throw new Error('ไม่ได้รับข้อมูลภาพจาก OpenAI');
      bytes = Utilities.base64Decode(b64);
      mime = 'image/png';
    } else {
      const apiKey = props.getProperty('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY ยังไม่ได้ตั้งค่า');
      const model = props.getProperty('GEMINI_IMAGE_MODEL') || 'gemini-3.1-flash-image-preview';
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
      const res = httpPostWithRetry_(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      });
      if (!res.ok) throw new Error('สร้างภาพไม่สำเร็จ (HTTP ' + res.code + ') — ตรวจสอบว่าโมเดล "' + model + '" รองรับ image generation: ' + res.raw);
      const parts = (res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content && res.data.candidates[0].content.parts) || [];
      const imgPart = parts.filter(function (p) { return p.inlineData && p.inlineData.data; })[0];
      if (!imgPart) throw new Error('ไม่ได้รับข้อมูลภาพจาก Gemini');
      bytes = Utilities.base64Decode(imgPart.inlineData.data);
      mime = imgPart.inlineData.mimeType || 'image/png';
    }

    const blob = Utilities.newBlob(bytes, mime, 'ai_image_' + new Date().getTime() + '.png');
    const folder = getAiImageFolder_();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const imageUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1024';
    const previewUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w240';

    let sentVia = null;
    if (context.replyToken && !context.replyTokenUsed) {
      replyImageToLine_(context.replyToken, imageUrl, previewUrl);
      context.replyTokenUsed = true;
      context.messageSent = true;
      sentVia = 'reply';
    } else {
      const targetId = context.userId || getConfig_().targetUserId;
      if (!targetId) throw new Error('ไม่มีผู้รับ (userId/targetUserId)');
      pushImageToUser_(targetId, imageUrl, previewUrl);
      context.messageSent = true;
      sentVia = 'push';
    }

    const logUserId = context.userId || getConfig_().targetUserId;
    if (logUserId) {
      const profile = fetchUserProfileCached_(logUserId);
      logMessage_(logUserId, profile.displayName, profile.pictureUrl, 'out', '[รูปภาพ AI (' + imageProvider + '): ' + prompt + ']', '', '');
    }

    return {
      forModel: { status: 'sent', via: sentVia, imageUrl: imageUrl, provider: imageProvider },
      summary: '✅ สร้างและส่งรูปภาพ "' + prompt + '" เข้า LINE เรียบร้อยแล้ว (' + imageProvider + ')',
      sent: true
    };
  } catch (e) {
    Logger.log('❌ toolGenerateImage_ error: ' + e.message);
    return { forModel: { status: 'error', error: e.message }, summary: '❌ สร้างภาพไม่สำเร็จ: ' + e.message, sent: false };
  }
}

function getAiImageFolder_() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('AI_IMAGE_FOLDER_ID');
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) { /* ถ้าหาไม่เจอ ให้สร้างใหม่ด้านล่าง */ }
  }
  const folder = DriveApp.createFolder('LINE Bot MCP - AI Images');
  props.setProperty('AI_IMAGE_FOLDER_ID', folder.getId());
  return folder;
}

function toolSendFlexNotification_(title, message, context) {
  context = context || {};
  title = title || 'แจ้งเตือน';
  message = message || '';

  if (context.dryRun) {
    return {
      forModel: { status: 'preview', title: title, message: message },
      summary: '📢 (พรีวิว) จะส่งการ์ดแจ้งเตือน: "' + title + '"',
      sent: false
    };
  }

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: title, weight: 'bold', size: 'lg', color: '#06C755', wrap: true },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: message, size: 'sm', color: '#333333', wrap: true, margin: 'md' },
        { type: 'text', text: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm'), size: 'xxs', color: '#999999', margin: 'md', align: 'end' }
      ]
    }
  };

  try {
    let sentVia = null;
    if (context.replyToken && !context.replyTokenUsed) {
      replyFlexToLine_(context.replyToken, title, bubble);
      context.replyTokenUsed = true;
      context.messageSent = true;
      sentVia = 'reply';
    } else {
      const targetId = context.userId || getConfig_().targetUserId;
      if (!targetId) throw new Error('ไม่มีผู้รับ (userId/targetUserId)');
      lineApiPost_('/message/push', {
        to: targetId,
        messages: [{ type: 'flex', altText: title, contents: bubble }]
      });
      context.messageSent = true;
      sentVia = 'push';
    }

    const logUserId = context.userId || getConfig_().targetUserId;
    if (logUserId) {
      const profile = fetchUserProfileCached_(logUserId);
      logMessage_(logUserId, profile.displayName, profile.pictureUrl, 'out', '[Flex Message: ' + title + ']', '', '');
    }

    return {
      forModel: { status: 'sent', via: sentVia },
      summary: '✅ ส่งการ์ดแจ้งเตือน "' + title + '" เรียบร้อยแล้ว',
      sent: true
    };
  } catch (e) {
    Logger.log('❌ toolSendFlexNotification_ error: ' + e.message);
    return { forModel: { status: 'error', error: e.message }, summary: '❌ ส่งการ์ดแจ้งเตือนไม่สำเร็จ: ' + e.message, sent: false };
  }
}

/**
 * askAI: เรียก AI (รองรับ tool use เต็มรูปแบบ + เลือกผู้ให้บริการ/รุ่นได้) แล้ว push
 * ผลลัพธ์เข้า LINE ของ TARGET_USER_ID
 */
function askAI(question, provider, model) {
  const cfg = getConfig_();
  const context = { userId: cfg.targetUserId };
  const result = generateAIAnswer_(question, provider, model, context);
  if (!result.success) return result;

  if (!context.messageSent) {
    const pushResult = pushToUser_(result.answer);
    return {
      success: true,
      answer: result.answer,
      provider: result.provider,
      model: result.model,
      actions: result.actions,
      lineSent: pushResult.lineSent,
      lineError: pushResult.lineError
    };
  }

  return {
    success: true,
    answer: result.answer,
    provider: result.provider,
    model: result.model,
    actions: result.actions,
    lineSent: true,
    lineError: null
  };
}

function getMessageQuota() {
  try {
    const quota = lineApiGet_('/message/quota');
    const consumption = lineApiGet_('/message/quota/consumption');
    const limit = quota.value;
    const used = consumption.totalUsage;
    const summary = '📊 Message Quota\nLimit: ' + limit + '\nUsed: ' + used +
      '\nRemaining: ' + (limit - used);
    const pushResult = pushToUser_(summary);
    return {
      success: true,
      quota: { limit: limit, used: used },
      lineSent: pushResult.lineSent,
      lineError: pushResult.lineError
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// Inbox — Google Sheet
// ============================================================

function getInboxSheet_() {
  Logger.log('📊 getInboxSheet_(): เริ่มต้น...');
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('INBOX_SPREADSHEET_ID');
  Logger.log('📊 getInboxSheet_(): ssId=' + ssId);

  let ss = null;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
      Logger.log('📊 getInboxSheet_(): เปิด Spreadsheet สำเร็จ');
    } catch (e) {
      Logger.log('📊 getInboxSheet_(): เปิด Spreadsheet ไม่สำเร็จ: ' + e.message);
      ss = null;
    }
  }

  if (!ss) {
    Logger.log('📊 getInboxSheet_(): กำลังสร้าง Spreadsheet ใหม่...');
    ss = SpreadsheetApp.create('LINE Bot MCP - Inbox');
    props.setProperty('INBOX_SPREADSHEET_ID', ss.getId());
    Logger.log('📊 getInboxSheet_(): สร้าง Spreadsheet สำเร็จ ID=' + ss.getId());
  }

  let sheet = ss.getSheetByName('Messages');
  if (!sheet) {
    Logger.log('📊 getInboxSheet_(): กำลังสร้าง Sheet "Messages"...');
    sheet = ss.insertSheet('Messages');
    sheet.appendRow(['Timestamp', 'UserId', 'DisplayName', 'PictureUrl', 'Direction', 'Text', 'QuoteToken', 'MessageId', 'Read', 'MarkAsReadToken']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:J1').setFontWeight('bold');
    sheet.autoResizeColumns(1, 10);
    Logger.log('📊 getInboxSheet_(): สร้าง Sheet สำเร็จ');
  } else {
    // migrate: ถ้า sheet เก่ายังไม่มีคอลัมน์ Read (I) / MarkAsReadToken (J) ให้เพิ่ม
    try {
      const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (header.length < 9 || String(header[8] || '').trim() !== 'Read') {
        sheet.getRange(1, 9).setValue('Read');
        sheet.getRange('A1:I1').setFontWeight('bold');
        Logger.log('📊 getInboxSheet_(): เพิ่มคอลัมน์ Read แล้ว');
      }
      const header2 = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (header2.length < 10 || String(header2[9] || '').trim() !== 'MarkAsReadToken') {
        sheet.getRange(1, 10).setValue('MarkAsReadToken');
        sheet.getRange('A1:J1').setFontWeight('bold');
        Logger.log('📊 getInboxSheet_(): เพิ่มคอลัมน์ MarkAsReadToken แล้ว');
      }
    } catch (e) { Logger.log('⚠️ migrate Read/Mark col: ' + e.message); }
  }

  Logger.log('📊 getInboxSheet_(): เสร็จสิ้น URL=' + ss.getUrl());
  return sheet;
}

function logMessage_(userId, displayName, pictureUrl, direction, text, quoteToken, messageId, markAsReadToken) {
  Logger.log('📝 logMessage_(): เริ่มต้น userId=' + userId + ' dir=' + direction + ' text=' + (text ? text.substring(0, 50) : ''));

  try {
    if (messageId) {
      Logger.log('📝 logMessage_(): เช็ค messageId=' + messageId);
      const sheet = getInboxSheet_();
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (values[i][7] === messageId) {
          Logger.log('📝 logMessage_(): ข้าม — messageId ซ้ำ');
          return;
        }
      }
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      Logger.log('📝 logMessage_(): กำลัง appendRow...');
      // คอลัมน์ Read: ใช้สำหรับ in เท่านั้น (แอดมินอ่าน) — out เก็บ FALSE ไว้ก่อน แต่สถานะอ่านของผู้รับจะคำนวณจาก hasLaterIn (ปลายทางตอบกลับ)
      const isRead = false;
      const tokenToSave = markAsReadToken || '';
      getInboxSheet_().appendRow([
        new Date().toISOString(),
        userId,
        displayName || '',
        pictureUrl || '',
        direction,
        text || '',
        quoteToken || '',
        messageId || '',
        isRead,
        tokenToSave
      ]);
      Logger.log('✅ logMessage_(): appendRow สำเร็จ!');
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('❌ logMessage_(): ERROR = ' + e.message);
    Logger.log('❌ logMessage_(): stack = ' + e.stack);
  }
}

function markMessagesAsRead_(userId) {
  if (!userId) return { success: false, error: 'userId is required' };
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(8000);
    let updated = 0;
    let latestToken = '';
    try {
      const sheet = getInboxSheet_();
      const values = sheet.getDataRange().getValues();
      // หา markAsReadToken ล่าสุดของ user นี้เพื่อเรียก LINE API (อ้างอิง LINE API จริง)
      for (let i = values.length - 1; i >= 1; i--) {
        if (values[i][1] === userId && values[i][4] === 'in' && values[i][9]) {
          const t = String(values[i][9]).trim();
          if (t) { latestToken = t; break; }
        }
      }
      // batch เก็บ range ที่ต้องอัปเดตเพื่อลดเรียก setValue ทีละแถว
      const toUpdate = [];
      for (let i = 1; i < values.length; i++) {
        const rowUserId = values[i][1];
        const direction = values[i][4];
        const isRead = values[i][8];
        const alreadyRead = isRead === true || String(isRead).toUpperCase() === 'TRUE';
        // มาร์คเฉพาะ in (แอดมินเปิดอ่าน) — out (ปลายทางอ่าน) ต้องรอ hasLaterIn (ผู้รับตอบกลับ) ถึงจะขึ้น อ่านแล้ว
        // ไม่มาร์ค out ตอนแอดมินเปิด inbox เพื่อไม่ให้ขึ้น ปลายทางอ่านแล้ว ผิด
        if (rowUserId === userId && direction === 'in' && !alreadyRead) {
          toUpdate.push(i + 1);
        }
      }
      toUpdate.forEach(function (r) {
        sheet.getRange(r, 9).setValue(true);
        updated++;
      });
      if (updated > 0) SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
    Logger.log('✅ markMessagesAsRead_(' + userId + '): sheet updated ' + updated + ' token=' + (latestToken ? latestToken.substring(0, 10) + '...' : 'none'));
    // อ้างอิง LINE API จริง: เรียก markAsRead เพื่อให้ฝั่ง LINE ของผู้ใช้ขึ้น "อ่านแล้ว"
    // ต้องเปิด Chat ใน OA Manager (https://manager.line.biz) → Response settings → Chat = ON
    if (latestToken) {
      try {
        lineApiPost_('/chat/markAsRead', { markAsReadToken: latestToken });
        Logger.log('✅ LINE API markAsRead success');
      } catch (e) {
        Logger.log('⚠️ LINE markAsRead failed (อาจต้องเปิด Chat ใน OA Manager): ' + e.message);
      }
    } else {
      Logger.log('ℹ️ No markAsReadToken for ' + userId + ' — ข้ามเรียก LINE API (ข้อความเก่าก่อนเพิ่มคอลัมน์)');
    }
    return { success: true, updated: updated, lineMarked: !!latestToken };
  } catch (e) {
    Logger.log('❌ markMessagesAsRead_ error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function fetchUserProfileCached_(userId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'profile_' + userId;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fallthrough */ }
  }
  try {
    const profile = lineApiGet_('/profile/' + userId);
    const result = { displayName: profile.displayName || 'Unknown', pictureUrl: profile.pictureUrl || '' };
    cache.put(cacheKey, JSON.stringify(result), 3600);
    return result;
  } catch (e) {
    return { displayName: 'Unknown', pictureUrl: '' };
  }
}

function getConversations() {
  try {
    const sheet = getInboxSheet_();
    const values = sheet.getDataRange().getValues();
    values.shift();
    const map = {};
    const perUser = {}; // userId -> array of {timestamp, direction, isRead}
    values.forEach(function (row) {
      const timestamp = row[0], userId = row[1], displayName = row[2], pictureUrl = row[3], direction = row[4], text = row[5], isRead = row[8];
      if (!userId) return;
      if (!perUser[userId]) perUser[userId] = [];
      const isReadBool = isRead === true || String(isRead).toUpperCase() === 'TRUE';
      perUser[userId].push({ timestamp: new Date(timestamp).getTime(), direction: direction, isRead: isReadBool });
      const existing = map[userId];
      if (!existing || new Date(timestamp) > new Date(existing.lastTimestamp)) {
        map[userId] = {
          userId: userId,
          displayName: displayName || 'Unknown',
          pictureUrl: pictureUrl || '',
          lastText: text,
          lastDirection: direction,
          lastTimestamp: timestamp
        };
      }
    });
    // คำนวณสถานะอ่าน + จำนวนยังไม่อ่าน (สมบูรณ์: unreadCount ต่อห้อง + total)
    let totalUnread = 0;
    Object.keys(map).forEach(function (uid) {
      const info = map[uid];
      const rows = perUser[uid] || [];
      // unreadCount = จำนวน in ที่แอดมินยังไม่ได้เปิดอ่าน (คอลัมน์ Read)
      let unreadCount = 0;
      rows.forEach(function (r) { if (r.direction === 'in' && !r.isRead) unreadCount++; });
      info.unreadCount = unreadCount;
      info.isUnread = unreadCount > 0;
      totalUnread += unreadCount;
      // lastOutStatus: ปลายทางอ่านจริง = มี in ตอบกลับหลัง out ล่าสุด (อ้างอิง LINE) — ไม่เกี่ยวกับแอดมินเปิด inbox
      // หา out ล่าสุดที่เรียงตาม timestamp จริง (sort ก่อนเพื่อกัน sheet ไม่เรียง)
      rows.sort(function (a, b) { return a.timestamp - b.timestamp; });
      let lastOut = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].direction === 'out') { lastOut = rows[i]; break; }
      }
      if (lastOut) {
        let hasLaterIn = false;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].direction === 'in' && rows[i].timestamp > lastOut.timestamp) { hasLaterIn = true; break; }
        }
        info.lastOutStatus = hasLaterIn ? 'read' : 'sent';
        info.lastOutTime = lastOut.timestamp;
      } else {
        info.lastOutStatus = null;
      }
    });
    const list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) { return new Date(b.lastTimestamp) - new Date(a.lastTimestamp); });
    return { success: true, conversations: list, totalUnread: totalUnread, totalConversations: list.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getMessagesForUser(userId) {
  if (!userId) return { success: false, error: 'userId is required' };
  try {
    const sheet = getInboxSheet_();
    const values = sheet.getDataRange().getValues();
    values.shift();
    const messages = values
      .filter(function (row) { return row[1] === userId; })
      .map(function (row) {
        const text = row[5] || '';
        const isReadRaw = row[8];
        const isRead = isReadRaw === true || String(isReadRaw).toUpperCase() === 'TRUE';
        // ดึง imageUrl ที่ฝังใน Text เช่น "[รูปภาพ: https://lh3.googleusercontent.com/d/...]"
        let imageUrl = '';
        const m = String(text).match(/https:\/\/lh3\.googleusercontent\.com\/d\/[a-zA-Z0-9_-]+[^\s\]\)]*/);
        if (m) imageUrl = m[0];
        else {
          const m2 = String(text).match(/https:\/\/drive\.google\.com\/[^\s\]\)]+/);
          if (m2) imageUrl = m2[0];
        }
        // ลบ prefix image url ออกจาก text สำหรับแสดงผล ถ้ามีเฉพาะรูป
        let displayText = text;
        // ถ้า text เป็น "[รูปภาพ: url]" ให้แสดงเป็น ""
        if (imageUrl && text.indexOf('[รูปภาพ') !== -1) {
          displayText = text.replace(/\[รูปภาพ[^\]]*\]/, '').trim() || (text.indexOf('📷') !== -1 ? text.split('[รูปภาพ')[0].trim() : '');
          // ถ้าหลังลบแล้วว่าง ให้เหลือคำว่า "📷 รูปภาพ"
          if (!displayText) displayText = '📷 รูปภาพ';
        }
        return {
          timestamp: row[0],
          direction: row[4],
          text: displayText || text,
          rawText: text,
          imageUrl: imageUrl || '',
          quoteToken: row[6] || '',
          messageId: row[7] || '',
          isRead: isRead
        };
      })
      .sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    // คำนวณสถานะอ่าน (สมบูรณ์):
    // - out: ปลายทางอ่านจริง = มี in ตอบกลับหลัง out (อ้างอิง LINE webhook) — ถ้ามี in หลัง out ใดๆ ให้ถือว่าทุก out ก่อนหน้า อ่านแล้ว
    // - in: แอดมินเปิดอ่าน = isRead จาก Sheet (true = แอดมินเปิดอ่านแล้ว)
    // หา timestamp ของ in ล่าสุด เพื่อเทียบกับ out ทั้งหมด (ประสิทธิภาพดีกว่า loop ซ้อนทุกตัว)
    let latestInTime = -1;
    for (let k = messages.length - 1; k >= 0; k--) {
      if (messages[k].direction === 'in') { latestInTime = new Date(messages[k].timestamp).getTime(); break; }
    }
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.direction === 'out') {
        const curTime = new Date(msg.timestamp).getTime();
        // ถ้ามี in ใดๆ หลัง out นี้ -> อ่านแล้ว (ถือว่า user เห็นทุก out ก่อนหน้า)
        let hasLaterIn = false;
        // ถ้า latestInTime > curTime ก็พอสรุปได้เร็ว, แต่เพื่อความชัวร์กรณี out หลังสุดก่อน latestIn
        if (latestInTime > curTime) {
          // ตรวจสอบว่ามี in หลัง curTime จริง (ไม่ใช่แค่ latest)
          for (let j = i + 1; j < messages.length; j++) {
            if (messages[j].direction === 'in' && new Date(messages[j].timestamp).getTime() > curTime) { hasLaterIn = true; break; }
          }
        }
        msg.readStatus = hasLaterIn ? 'read' : 'sent';
      } else {
        msg.readStatus = msg.isRead ? 'read' : 'unread';
      }
    }
    // สรุปจำนวนยังไม่อ่านในห้องนี้
    const unreadInThread = messages.filter(function (m) { return m.direction === 'in' && !m.isRead; }).length;
    return { success: true, messages: messages, unreadCount: unreadInThread };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function isChatHistorySyncEnabled_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ENABLE_CHAT_HISTORY_SYNC') === 'true';
}

function syncChatHistoryForUser_(userId, limit) {
  if (!isChatHistorySyncEnabled_()) {
    return { success: false, error: 'Chat History Sync ยังไม่ได้เปิดใช้งาน' };
  }
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }

  const syncLimit = limit || parseInt(PropertiesService.getScriptProperties().getProperty('CHAT_HISTORY_SYNC_LIMIT') || '50');

  try {
    const path = '/conversation/' + userId + '/messages?limit=' + syncLimit;
    const response = lineApiGet_(path);

    const messages = response.messages || [];
    if (messages.length === 0) {
      return { success: true, syncedCount: 0, note: 'ไม่พบข้อความย้อนหลัง' };
    }

    const profile = fetchUserProfileCached_(userId);
    let syncedCount = 0;
    const existingMessageIds = getExistingMessageIds_();

    messages.forEach(function (msg) {
      const messageId = msg.id;
      if (existingMessageIds.has(messageId)) return;

      let text = '';
      let direction = 'in';
      let quoteToken = '';

      switch (msg.type) {
        case 'text': text = msg.text; break;
        case 'image': text = '[รูปภาพ]'; break;
        case 'video': text = '[วิดีโอ]'; break;
        case 'audio': text = '[ข้อความเสียง]'; break;
        case 'file': text = '[ไฟล์: ' + (msg.fileName || 'unknown') + ']'; break;
        case 'location': text = '[ตำแหน่งที่ตั้ง: ' + (msg.address || 'unknown') + ']'; break;
        case 'sticker': text = '[สติกเกอร์]'; break;
        default: text = '[ข้อความประเภท: ' + msg.type + ']';
      }

      if (msg.source && msg.source.type === 'user' && msg.source.userId === userId) {
        direction = 'in';
      } else if (msg.source && msg.source.type === 'user' && msg.source.userId !== userId) {
        direction = 'out';
      }

      if (msg.quoteToken) quoteToken = msg.quoteToken;

      logMessage_(userId, profile.displayName, profile.pictureUrl, direction, text, quoteToken, messageId);
      syncedCount++;
    });

    return { success: true, syncedCount: syncedCount, totalMessages: messages.length };
  } catch (e) {
    const errorMsg = e.message;
    if (errorMsg.indexOf('403') > -1 || errorMsg.indexOf('forbidden') > -1) {
      return {
        success: false,
        error: 'ไม่มีสิทธิ์เรียก Chat History API — ต้องใช้บัญชี LINE Premium/Premium Trial',
        originalError: errorMsg
      };
    }
    return { success: false, error: errorMsg };
  }
}

function getExistingMessageIds_() {
  const messageIds = new Set();
  try {
    const sheet = getInboxSheet_();
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const msgId = values[i][7];
      if (msgId) messageIds.add(msgId);
    }
  } catch (e) {
    Logger.log('getExistingMessageIds_ failed: ' + e.message);
  }
  return messageIds;
}

function syncChatHistoryAllUsers_() {
  if (!isChatHistorySyncEnabled_()) {
    return { success: false, error: 'Chat History Sync ยังไม่ได้เปิดใช้งาน' };
  }

  try {
    const conversations = getConversations();
    if (!conversations.success) {
      return { success: false, error: 'ไม่สามารถดึงรายชื่อผู้ใช้จาก Sheet ได้: ' + conversations.error };
    }

    const userIds = (conversations.conversations || []).map(function (c) { return c.userId; });

    if (userIds.length === 0) {
      return { success: true, message: 'ไม่มี userId ในระบบ', results: [] };
    }

    const results = [];
    const limit = parseInt(PropertiesService.getScriptProperties().getProperty('CHAT_HISTORY_SYNC_LIMIT') || '50');

    userIds.forEach(function (userId) {
      const result = syncChatHistoryForUser_(userId, limit);
      results.push(Object.assign({ userId: userId }, result));
    });

    const totalSynced = results.reduce(function (sum, r) { return sum + (r.syncedCount || 0); }, 0);

    return {
      success: true,
      totalUsers: userIds.length,
      totalSynced: totalSynced,
      results: results
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function installChatHistorySyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncChatHistoryTrigger_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncChatHistoryTrigger_')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('✅ ติดตั้ง Chat History Sync Trigger สำเร็จ — จะรันทุก 6 ชั่วโมง');
}

function syncChatHistoryTrigger_() {
  Logger.log('🔄 เริ่ม sync Chat History อัตโนมัติ...');
  const result = syncChatHistoryAllUsers_();
  Logger.log('✅ sync เสร็จสิ้น: ' + JSON.stringify(result));
}

// ============================================================
// Inbox Image — อัปโหลดรูปไปยัง Google Drive + ส่งกลับแบบ type image (lh3)
// ============================================================

/**
 * แปลง Drive fileId เป็น lh3 URL สำหรับ LINE image message
 * LINE ต้องใช้ https + รูป jpg/png ขนาดไม่เกิน 1MB (preview) — ใช้ lh3 จะถูกบีบอัดอัตโนมัติ
 */
function driveFileIdToLh3_(fileId) {
  // lh3.googleusercontent.com/d/<id> จะ serve รูปที่แชร์แบบ ANYONE_WITH_LINK
  // เติม =s1024 เพื่อจำกัดขนาดสูงสุด 1024px ช่วยลดไฟล์ไม่ให้ใหญ่เกิน
  return 'https://lh3.googleusercontent.com/d/' + fileId + '=s1024';
}

/**
 * ดึง fileId จาก URL หลายรูปแบบ (lh3 / drive.google.com/thumbnail / uc?id=)
 */
function extractDriveFileId_(url) {
  if (!url) return null;
  let m = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return null;
}

/**
 * บีบอัด/ย่อรูปถ้าไฟล์ใหญ่เกิน — ใช้ blob เดิมแต่ถ้าไฟล์ใหญ่มากอาจแจ้งเตือน
 * Apps Script ไม่มี image resize native จึงพึ่งการจำกัดขนาดบน lh3 (param =s1024) แทน
 * แต่จะตั้งชื่อไฟล์ใหม่และ mime เป็น image/jpeg เสมอเพื่อลดขนาด
 */
function ensureDriveFolder_(folderId) {
  const targetId = folderId || INBOX_IMAGE_FOLDER_ID;
  try {
    return DriveApp.getFolderById(targetId);
  } catch (e) {
    // fallback: ถ้าโฟลเดอร์ที่ระบุเปิดไม่ได้ ให้ใช้โฟลเดอร์ inbox
    try {
      return DriveApp.getFolderById(INBOX_IMAGE_FOLDER_ID);
    } catch (e2) {
      throw new Error('ไม่สามารถเปิดโฟลเดอร์ Drive ได้: ' + e2.message + ' (folderId=' + targetId + ')');
    }
  }
}

/**
 * uploadToDrive — อัปโหลดรูป (base64) ไปยัง Google Drive โฟลเดอร์ที่กำหนด
 * payload: { folderId?, image (base64), filename?, mimeType? }
 * return: { success, fileId, lh3Url, previewUrl, driveUrl, size }
 */
function uploadToDrive(payload) {
  try {
    payload = payload || {};
    const folderId = payload.folderId || INBOX_IMAGE_FOLDER_ID;
    const base64 = payload.image;
    const mimeType = payload.mimeType || 'image/jpeg';
    let filename = payload.filename || ('inbox_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss') + '.jpg');

    if (!base64) return { success: false, error: 'image (base64) is required' };

    // ตัด prefix data:image/...;base64, ถ้ามี
    let cleanBase64 = String(base64).trim();
    if (cleanBase64.indexOf(',') !== -1 && cleanBase64.indexOf('base64') !== -1) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    // ลบ whitespace/newline
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    let bytes;
    try {
      bytes = Utilities.base64Decode(cleanBase64);
    } catch (e) {
      return { success: false, error: 'base64 decode failed: ' + e.message };
    }

    // ป้องกันไฟล์ใหญ่เกิน (LINE จำกัด ~10MB แต่ Drive upload ควรไม่เกิน 10MB)
    if (bytes.length > 10 * 1024 * 1024) {
      return { success: false, error: 'ไฟล์ใหญ่เกิน 10MB (' + Math.round(bytes.length / 1024) + 'KB)' };
    }

    // ปรับชื่อไฟล์ให้เป็น .jpg เพื่อให้เบราว์เซอร์บีบอัดได้ดี (ถ้าต้นทางเป็น png ก็เก็บ png ไว้)
    // แต่ถ้า frontend บีบอัดเป็น jpeg มาแล้ว จะได้ไฟล์เล็ก
    if (!filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      filename += (mimeType.indexOf('png') !== -1 ? '.png' : '.jpg');
    }

    const blob = Utilities.newBlob(bytes, mimeType, filename);
    // บีบอัดเชิง logic: ถ้าไฟล์ > 2MB ให้ log เตือน แต่ยังอัปโหลด (lh3 จะย่อให้)
    if (bytes.length > 2 * 1024 * 1024) {
      Logger.log('⚠️ uploadToDrive: ไฟล์ค่อนข้างใหญ่ ' + Math.round(bytes.length / 1024) + 'KB — lh3 จะย่อให้เหลือ s1024');
    }

    const folder = ensureDriveFolder_(folderId);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const lh3Url = driveFileIdToLh3_(fileId);
    const previewUrl = lh3Url; // ใช้ URL เดียวกันสำหรับ preview (LINE ต้องการทั้ง originalContentUrl และ previewImageUrl)
    const driveUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';

    Logger.log('✅ uploadToDrive: fileId=' + fileId + ' size=' + bytes.length + ' -> ' + lh3Url);

    return {
      success: true,
      fileId: fileId,
      lh3Url: lh3Url,
      previewUrl: previewUrl,
      driveUrl: driveUrl,
      thumbnailUrl: thumbnailUrl,
      imageUrl: lh3Url,
      size: bytes.length,
      folderId: folder.getId(),
      filename: filename
    };
  } catch (e) {
    Logger.log('❌ uploadToDrive error: ' + e.message + ' | stack: ' + e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * sendImageMessage — ส่งรูป (lh3) เข้า LINE แบบ type image
 * payload: { imageUrl, message?, userId? }
 * ถ้าไม่มี userId จะใช้ TARGET_USER_ID
 */
function sendImageMessage(imageUrl, message, userId) {
  try {
    if (!imageUrl) return { success: false, error: 'imageUrl is required' };
    const cfg = getConfig_();
    const targetId = userId || cfg.targetUserId;
    if (!targetId) return { success: false, error: 'TARGET_USER_ID ยังไม่ได้ตั้งค่า' };

    // แปลงเป็น lh3 ถ้าเป็น drive url อื่น — ถ้าเป็น lh3 อยู่แล้วใช้เลย
    let fileId = extractDriveFileId_(imageUrl);
    let lh3Url = imageUrl;
    if (fileId && imageUrl.indexOf('lh3.googleusercontent.com') === -1) {
      lh3Url = driveFileIdToLh3_(fileId);
    }
    // ถ้าไม่ใช่ drive url เลย ก็ใช้ url เดิมตรงๆ (เผื่อส่ง external image)

    const messages = [];
    if (message) messages.push({ type: 'text', text: message });
    messages.push({ type: 'image', originalContentUrl: lh3Url, previewImageUrl: lh3Url });

    lineApiPost_('/message/push', { to: targetId, messages: messages });

    const profile = fetchUserProfileCached_(targetId);
    const logText = (message ? message + ' ' : '') + '[รูปภาพ: ' + lh3Url + ']';
    logMessage_(targetId, profile.displayName, profile.pictureUrl, 'out', logText, '', '');

    return { success: true, lh3Url: lh3Url, imageUrl: lh3Url };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function replyToUser(userId, message, quoteToken, imageUrl) {
  if (!userId) return { success: false, error: 'userId is required' };
  const hasText = !!(message && String(message).trim());
  const hasImage = !!(imageUrl && String(imageUrl).trim());
  if (!hasText && !hasImage) return { success: false, error: 'message or imageUrl is required' };
  try {
    const messages = [];
    if (hasText) {
      const messageObj = { type: 'text', text: message };
      if (quoteToken) messageObj.quoteToken = quoteToken;
      messages.push(messageObj);
    }
    if (hasImage) {
      let fileId = extractDriveFileId_(imageUrl);
      let lh3Url = imageUrl;
      if (fileId && imageUrl.indexOf('lh3.googleusercontent.com') === -1) {
        lh3Url = driveFileIdToLh3_(fileId);
      }
      // LINE image ต้องมี originalContentUrl + previewImageUrl เป็น https
      messages.push({ type: 'image', originalContentUrl: lh3Url, previewImageUrl: lh3Url });
    }

    lineApiPost_('/message/push', {
      to: userId,
      messages: messages
    });
    const profile = fetchUserProfileCached_(userId);
    let logText = '';
    if (hasText) logText += message;
    if (hasImage) logText += (logText ? ' ' : '') + '[รูปภาพ: ' + imageUrl + ']';
    logMessage_(userId, profile.displayName, profile.pictureUrl, 'out', logText, quoteToken || '', '');
    return { success: true, imageUrl: hasImage ? imageUrl : null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// ฟังก์ชันทดสอบ (เลือกฟังก์ชัน -> กด Run -> ดู Logger)
// ============================================================

function testInboxLogging() {
  Logger.log('========================================');
  Logger.log('🧪 เริ่มทดสอบระบบ Inbox Logging');
  Logger.log('========================================');

  const sheet = getInboxSheet_();
  Logger.log('📊 Spreadsheet URL: ' + sheet.getParent().getUrl());

  logMessage_('U_TEST_001', 'ทดสอบ ผู้ใช้ 1', '', 'in', 'สวัสดีครับ นี่คือข้อความทดสอบจาก LINE', 'qt_test_001', 'msg_test_001');
  logMessage_('U_TEST_001', 'ทดสอบ ผู้ใช้ 1', '', 'out', 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ?', '', '');
  logMessage_('U_TEST_002', 'ทดสอบ ผู้ใช้ 2', '', 'in', '[รูปภาพ]', '', 'msg_test_002');
  logMessage_('U_TEST_003', 'ทดสอบ ผู้ใช้ 3', '', 'in', '[สติกเกอร์: 12345]', '', 'msg_test_003');
  logMessage_('U_TEST_001', 'ทดสอบ ผู้ใช้ 1', '', 'in', 'สวัสดีครับ นี่คือข้อความทดสอบจาก LINE', 'qt_test_001', 'msg_test_001'); // ควรถูกข้าม (ซ้ำ)

  const fakeRaw = JSON.stringify({ error: { code: 429, message: 'You exceeded your current quota. Please retry in 56.38s.', status: 'RESOURCE_EXHAUSTED' } });
  Logger.log('👉 friendlyAIError_ (429): ' + friendlyAIError_('Gemini', 429, fakeRaw, 'gemini-3.5-flash'));

  const values = sheet.getDataRange().getValues();
  Logger.log('✅ ทดสอบเสร็จสิ้น! จำนวนแถวทั้งหมด: ' + values.length + ' (รวม header)');
}

/**
 * 🆕 ทดสอบระบบ AI หลายผู้ให้บริการพร้อม Tool Use
 * แก้ provider ในบรรทัด provider ด้านล่างเป็น 'gemini' / 'openai' / 'anthropic' เพื่อทดสอบแต่ละเจ้า
 * ⚠️ จะส่งเข้า LINE จริงไปยัง TARGET_USER_ID
 */
function testAiTools() {
  Logger.log('========================================');
  Logger.log('🧪 เริ่มทดสอบระบบ AI Tool Use หลายผู้ให้บริการ');
  Logger.log('========================================');

  const cfg = getConfig_();
  const provider = 'gemini'; // เปลี่ยนเป็น 'openai' หรือ 'anthropic' เพื่อทดสอบเจ้าอื่น

  Logger.log('--- ทดสอบ 1: ราคาน้ำมัน + ส่งเป็นการ์ดแจ้งเตือน (' + provider + ') ---');
  const result1 = generateAIAnswer_('ช่วยดึงราคาน้ำมันวันนี้ แล้วส่งสรุปเป็นการ์ดแจ้งเตือนให้หน่อย', provider, null, { userId: cfg.targetUserId });
  Logger.log('👉 result1 = ' + JSON.stringify(result1));

  Logger.log('--- ทดสอบ 2: สั่งสร้างรูปภาพ (' + provider + ') ---');
  const result2 = generateAIAnswer_('วาดรูปแมวสีส้มใส่หมวกไหมพรมให้หน่อย', provider, null, { userId: cfg.targetUserId });
  Logger.log('👉 result2 = ' + JSON.stringify(result2));

  Logger.log('✅ ทดสอบ AI Tool Use เสร็จสิ้น');
}