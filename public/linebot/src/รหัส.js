const FOLDER_ID = '1icvTKqeLMceMR88DVIJHV6z4GMqaLgSM';
const LINE_ACCESS_TOKEN = 'RA3XHFAk0E16MpeUMSFYqEyS0a8EPwWH4dQKHdhbaSnY40tHMsnsNigLJCVqKgSB/zZ8TS+7hQRz8a5XTGgyBCSh5aoFyMKbSdcIuII47cvzGQsL9kNpWLN1gnRaMYNVekLIJbsUTx21Evn3uepWgAdB04t89/1O/w1cDnyilFU='; // ใส่ Access Token ของคุณที่นี่
const FIREBASE_DB_URL = 'https://domo-bot-344b6-default-rtdb.firebaseio.com/'; // URL ของ Firebase Realtime Database

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAOA-mE0TCl5QvoHnXTZKqT0zM-EDoNVgg",
  authDomain: "domo-bot-344b6.firebaseapp.com",
  projectId: "domo-bot-344b6",
  storageBucket: "domo-bot-344b6.firebasestorage.app",
  messagingSenderId: "985191494360",
  appId: "1:985191494360:web:633e940ad2b0f66ea29dad",
  measurementId: "G-CQPTH5QZ6P"
};

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
        // Save user to Firebase
        firebaseRequest('users/' + userId, 'PUT', {
          displayName: profile.displayName || "คุณลูกค้า",
          pictureUrl: profile.pictureUrl || "",
          timestamp: { ".sv": "timestamp" } // Firebase Server Timestamp
        });
        // Send Welcome Flex Message
        const flexMessage = createWelcomeFlex(profile.displayName || "คุณลูกค้า", profile.pictureUrl);
        lineReply(replyToken, [flexMessage]);
      } 
      else if (event.type === 'message' && event.message && event.message.type === 'text') {
        const userMessage = event.message.text.trim().toLowerCase();
        const records = firebaseRequest('records', 'GET');
        
        // Find matching keyword
        let foundRecord = null;
        if (records) {
          for (let key in records) {
            if (records[key] && records[key].keyword && records[key].keyword.toLowerCase() === userMessage) {
              foundRecord = records[key];
              break;
            }
          }
        }

        if (foundRecord && foundRecord.fileUrl) {
          lineReply(replyToken, [{
            type: 'image',
            originalContentUrl: foundRecord.fileUrl,
            previewImageUrl: foundRecord.fileUrl
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
    console.log("--- Testing Firebase Connection ---");
    const fbTest = firebaseRequest('test_connection', 'PUT', { status: 'ok', time: new Date().toString() });
    console.log("Firebase Result:", JSON.stringify(fbTest));

    console.log("--- Testing Line Token (Bot Info) ---");
    const infoResponse = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
      muteHttpExceptions: true
    });
    console.log("Line Bot Info (" + infoResponse.getResponseCode() + "):", infoResponse.getContentText());
    
    if (infoResponse.getResponseCode() === 200) {
      console.log("✅ การตั้งค่าถูกต้อง! Firebase และ Line Token ใช้งานได้");
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
 * Firebase REST API Helper
 */
function firebaseRequest(path, method, data = null) {
  const url = FIREBASE_DB_URL + path + '.json';
  const options = {
    method: method,
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (data) options.payload = JSON.stringify(data);
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
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
  template.firebaseConfig = JSON.stringify(FIREBASE_CONFIG);
  return template.evaluate()
    .setTitle('CRUD WebApp with Firebase & Drive')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Uploads a base64 file to Google Drive.
 */
function uploadFile(base64Data, fileName) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Direct link format
    const directLink = 'https://lh3.googleusercontent.com/d/' + file.getId();
    
    return {
      url: directLink,
      id: file.getId()
    };
  } catch (e) {
    throw new Error('File upload failed: ' + e.toString());
  }
}

/**
 * Deletes a file from Google Drive.
 */
function deleteFile(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return "File deleted";
  } catch (e) {
    console.error('File not found: ' + fileId);
    return "File not found";
  }
}
