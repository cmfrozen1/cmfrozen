const LINE_ACCESS_TOKEN = 'RA3XHFAk0E16MpeUMSFYqEyS0a8EPwWH4dQKHdhbaSnY40tHMsnsNigLJCVqKgSB/zZ8TS+7hQRz8a5XTGgyBCSh5aoFyMKbSdcIuII47cvzGQsL9kNpWLN1gnRaMYNVekLIJbsUTx21Evn3uepWgAdB04t89/1O/w1cDnyilFU='; // ใส่ Access Token ของคุณที่นี่

const SUPABASE_PROJECT_URL = 'https://uyhxymwunejdwnrnqruf.supabase.co';
const SUPABASE_REST_URL = SUPABASE_PROJECT_URL + '/rest/v1/';
const SUPABASE_STORAGE_URL = SUPABASE_PROJECT_URL + '/storage/v1/';
const SUPABASE_KEY = 'sb_publishable_54jpNesP66qRt8owGyy0Kg_XzmN744u';
const BUCKET_NAME = 'files';

/**
 * Webhook for Line Messaging API
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      console.error("No postData received");
      return ContentService.createTextOutput("No data received");
    }

    const contents = JSON.parse(e.postData.contents);
    console.log("Full Event: ", JSON.stringify(contents));

    if (!contents.events || contents.events.length === 0) {
      return ContentService.createTextOutput("No events");
    }

    contents.events.forEach(event => {
      const replyToken = event.replyToken;
      if (!replyToken) return; // Skip events without reply token (like beacon)

      const userId = (event.source && event.source.userId) ? event.source.userId : null;

      if (event.type === 'follow' && userId) {
        const profile = getUserProfile(userId);
        // Save user to Supabase (Upsert)
        supabaseRequest('users', 'POST', {
          id: userId,
          display_name: profile.displayName || "คุณลูกค้า",
          picture_url: profile.pictureUrl || ""
        }, { 'Prefer': 'resolution=merge-duplicates' });

        // Send Welcome Flex Message
        const flexMessage = createWelcomeFlex(profile.displayName || "คุณลูกค้า", profile.pictureUrl);
        lineReply(replyToken, [flexMessage]);
      } 
      else if (event.type === 'message' && event.message && event.message.type === 'text') {
        const userMessage = event.message.text.trim().toLowerCase();
        // Search in Supabase
        const records = supabaseRequest('records?keyword=eq.' + encodeURIComponent(userMessage), 'GET');
        
        let foundRecord = (records && records.length > 0) ? records[0] : null;

        if (foundRecord && foundRecord.file_url) {
          lineReply(replyToken, [{
            type: 'image',
            originalContentUrl: foundRecord.file_url,
            previewImageUrl: foundRecord.file_url
          }]);
        }
      }
    });

    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Critical Webhook Error: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * TEST FUNCTION: Run this manually in Apps Script to verify your settings
 */
function testConfig() {
  try {
    console.log("--- Testing Supabase Connection ---");
    const sbTest = supabaseRequest('users', 'GET', null, { 'Range': '0-0' });
    console.log("Supabase Result:", JSON.stringify(sbTest));

    console.log("--- Testing Line Token (Bot Info) ---");
    const infoResponse = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
      muteHttpExceptions: true
    });
    console.log("Line Bot Info (" + infoResponse.getResponseCode() + "):", infoResponse.getContentText());
    
    if (infoResponse.getResponseCode() === 200) {
      console.log("✅ การตั้งค่าถูกต้อง! Supabase และ Line Token ใช้งานได้");
    } else {
      console.error("❌ Line Token อาจไม่ถูกต้อง (Response Code: " + infoResponse.getResponseCode() + ")");
    }
  } catch (e) {
    console.error("❌ การตั้งค่าผิดพลาด: " + e.toString());
  }
}

/**
 * Line API Helpers
 */
function lineReply(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    })
  });
}

function getUserProfile(userId) {
  try {
    const url = 'https://api.line.me/v2/bot/profile/' + userId;
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 
        'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    const resCode = response.getResponseCode();
    const resText = response.getContentText();
    console.log("Profile Response (" + resCode + "): " + resText);
    
    if (resCode !== 200) {
      console.warn("Could not fetch profile for user: " + userId + ". Using default.");
      return { displayName: "คุณลูกค้า", pictureUrl: "" };
    }
    
    return JSON.parse(resText);
  } catch (e) {
    console.error("Critical Profile Fetch Error: " + e.toString());
    return { displayName: "คุณลูกค้า", pictureUrl: "" };
  }
}

/**
 * Supabase REST API Helper
 */
function supabaseRequest(path, method, data = null, customHeaders = {}) {
  const url = SUPABASE_REST_URL + path;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  
  // Merge custom headers
  Object.assign(headers, customHeaders);

  const options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };
  
  if (data) options.payload = JSON.stringify(data);
  
  const response = UrlFetchApp.fetch(url, options);
  const resText = response.getContentText();
  
  if (response.getResponseCode() >= 400) {
    console.error("Supabase Error (" + path + "): " + resText);
  }

  try {
    return resText ? JSON.parse(resText) : null;
  } catch (e) {
    return resText;
  }
}

/**
 * Welcome Flex Message Template
 */
function createWelcomeFlex(name, picture) {
  return {
    type: "flex",
    altText: "ยินดีต้อนรับคุณ " + name,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: picture || "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png",
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ยินดีต้อนรับ!",
            weight: "bold",
            size: "xl",
            color: "#1DB446"
          },
          {
            type: "text",
            text: name,
            weight: "bold",
            size: "md",
            margin: "md"
          },
          {
            type: "text",
            text: "ขอบคุณที่เป็นเพื่อนกับเราครับ หากมีคำถามสามารถพิมพ์สอบถามได้เลย!",
            wrap: true,
            color: "#666666",
            size: "sm",
            margin: "md"
          }
        ]
      }
    }
  };
}

/**
 * Serves the HTML file 'index.html' to the web app.
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  template.supabaseConfig = JSON.stringify({
    url: SUPABASE_PROJECT_URL,
    key: SUPABASE_KEY
  });
  return template.evaluate()
    .setTitle('CRUD WebApp with Supabase Storage')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Uploads a base64 file to Supabase Storage.
 */
function uploadFile(base64Data, fileName) {
  try {
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    
    // Unique filename to prevent overwriting
    const uniqueFileName = Date.now() + '_' + fileName;
    const url = SUPABASE_STORAGE_URL + 'object/' + BUCKET_NAME + '/' + encodeURIComponent(uniqueFileName);
    
    const options = {
      method: 'post',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': contentType
      },
      payload: bytes,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const resText = response.getContentText();
    
    if (response.getResponseCode() !== 200) {
      throw new Error('Supabase Storage Upload Failed: ' + resText);
    }
    
    // Public URL format
    const publicUrl = SUPABASE_STORAGE_URL + 'object/public/' + BUCKET_NAME + '/' + uniqueFileName;
    
    return {
      url: publicUrl,
      id: uniqueFileName // We use filename as ID for storage objects
    };
  } catch (e) {
    throw new Error('File upload failed: ' + e.toString());
  }
}

/**
 * Deletes a file from Supabase Storage.
 */
function deleteFile(fileId) {
  if (!fileId) return;
  try {
    const url = SUPABASE_STORAGE_URL + 'object/' + BUCKET_NAME;
    const options = {
      method: 'delete',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ prefixes: [fileId] }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
       console.error('Storage Delete Error: ' + response.getContentText());
    }
    return "File deleted";
  } catch (e) {
    console.error('File delete failed: ' + e.toString());
    return "Delete failed";
  }
}
